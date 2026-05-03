import Anthropic from "@anthropic-ai/sdk";

import { prisma } from "@/lib/db/prisma";
import { assertBoardAccess } from "@/lib/auth/permissions";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import {
  type AiToolContext,
  executeTool,
  getToolDefinitions,
} from "@/lib/ai/tools";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";
const MAX_ITERATIONS = 10;

// Событие, которое мы транслируем клиенту через SSE.
export type AgentStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call_start"; tool: string; input: Record<string, unknown> }
  | { type: "tool_call_result"; tool: string; result: unknown }
  | { type: "pending_action"; action_id: string; summary: string }
  | { type: "done"; usage?: Record<string, number> }
  | { type: "error"; message: string };

type RunInput = {
  conversationId: string;
  userId: string;
  boardId: string;
  userMessage: string;
};

/**
 * Главный цикл агента: загружает историю → шлёт в Claude → выполняет
 * tool_use'ы → повторяет до stop_reason: end_turn (или max iterations).
 *
 * Использует адаптивное мышление (auto). Стримит текст и события tool-use
 * через async generator — ниже их подхватывает SSE-роут.
 */
export async function* runAgent(input: RunInput): AsyncGenerator<AgentStreamEvent> {
  if (!process.env.ANTHROPIC_API_KEY) {
    yield {
      type: "error",
      message: "ANTHROPIC_API_KEY не задан в .env.local",
    };
    return;
  }

  // Сохраняем сообщение пользователя в БД сразу
  await prisma.aiMessage.create({
    data: {
      conversationId: input.conversationId,
      role: "USER",
      content: input.userMessage,
    },
  });

  await assertBoardAccess(input.userId, input.boardId);
  const myRole = await prisma.boardMember.findUnique({
    where: {
      boardId_userId: { boardId: input.boardId, userId: input.userId },
    },
    select: { role: true, user: { select: { name: true, email: true } } },
  });
  if (!myRole) {
    yield { type: "error", message: "Нет доступа к доске" };
    return;
  }

  const system = await buildSystemPrompt({
    boardId: input.boardId,
    user: { name: myRole.user.name, email: myRole.user.email },
    role: myRole.role,
  });

  // Восстановим историю последних N сообщений (без контента tool-результатов
  // — они уже отыграли своё, для агента важна свежая структура).
  const recentMessages = await prisma.aiMessage.findMany({
    where: { conversationId: input.conversationId },
    orderBy: { createdAt: "asc" },
    take: 40,
    select: { role: true, content: true, toolCalls: true, toolResults: true },
  });

  // Сборка messages в формате Anthropic. Только USER/ASSISTANT, TOOL-роли
  // зашиваем в content-blocks внутри ASSISTANT/USER сообщений по правилам API.
  type Block =
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
    | { type: "tool_result"; tool_use_id: string; content: string };
  const messages: Anthropic.MessageParam[] = [];
  for (const m of recentMessages) {
    if (m.role === "USER") {
      messages.push({ role: "user", content: m.content });
    } else if (m.role === "ASSISTANT") {
      const blocks: Block[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      if (m.toolCalls && Array.isArray(m.toolCalls)) {
        for (const tc of m.toolCalls as Array<{
          id: string;
          name: string;
          input: Record<string, unknown>;
        }>) {
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.input,
          });
        }
      }
      messages.push({ role: "assistant", content: blocks as never });
    } else if (m.role === "TOOL") {
      // tool_result оборачиваем в user-сообщение
      const results = (m.toolResults ?? []) as Array<{
        tool_use_id: string;
        content: string;
      }>;
      messages.push({
        role: "user",
        content: results.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.tool_use_id,
          content: r.content,
        })) as never,
      });
    }
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tools = getToolDefinitions();
  const ctx: AiToolContext = { userId: input.userId, boardId: input.boardId };

  let iteration = 0;
  let totalUsage = { input: 0, output: 0 };

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 2000,
      system,
      tools,
      messages,
      thinking: { type: "adaptive" } as never,
    });

    // Стримим текст через event'ы
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { type: "text_delta", text: event.delta.text };
      }
    }

    const finalMessage = await stream.finalMessage();
    totalUsage.input += finalMessage.usage.input_tokens;
    totalUsage.output += finalMessage.usage.output_tokens;

    // Извлекаем tool_use и текст
    const toolUses: Array<{
      id: string;
      name: string;
      input: Record<string, unknown>;
    }> = [];
    let assistantText = "";
    for (const block of finalMessage.content) {
      if (block.type === "text") assistantText += block.text;
      if (block.type === "tool_use") {
        toolUses.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    // Сохраняем ассистентский ход в БД (Prisma не любит явный null в Json — пропускаем поле)
    await prisma.aiMessage.create({
      data: {
        conversationId: input.conversationId,
        role: "ASSISTANT",
        content: assistantText,
        ...(toolUses.length > 0
          ? { toolCalls: toolUses as unknown as object }
          : {}),
      },
    });

    if (toolUses.length === 0 || finalMessage.stop_reason === "end_turn") {
      yield { type: "done", usage: totalUsage };
      return;
    }

    // Эхо ассистентского хода в локальный messages
    const assistantBlocks: Block[] = [];
    if (assistantText) assistantBlocks.push({ type: "text", text: assistantText });
    for (const tu of toolUses) {
      assistantBlocks.push({
        type: "tool_use",
        id: tu.id,
        name: tu.name,
        input: tu.input,
      });
    }
    messages.push({ role: "assistant", content: assistantBlocks as never });

    // Выполняем все tool_use последовательно
    const toolResults: Array<{ tool_use_id: string; content: string }> = [];
    for (const tu of toolUses) {
      yield { type: "tool_call_start", tool: tu.name, input: tu.input };
      const r = await executeTool(tu.name, tu.input, ctx);
      yield { type: "tool_call_result", tool: tu.name, result: r };

      // Если pending — отдельное событие для UI
      if (
        r.ok &&
        typeof r.data === "object" &&
        r.data !== null &&
        "status" in r.data &&
        (r.data as { status?: string }).status === "pending_confirmation"
      ) {
        const d = r.data as unknown as {
          action_id: string;
          summary: string;
        };
        yield {
          type: "pending_action",
          action_id: d.action_id,
          summary: d.summary,
        };
      }

      toolResults.push({
        tool_use_id: tu.id,
        content: JSON.stringify(r),
      });
    }

    // Сохраняем tool-результаты в БД отдельным сообщением
    await prisma.aiMessage.create({
      data: {
        conversationId: input.conversationId,
        role: "TOOL",
        content: "",
        toolResults,
      },
    });

    messages.push({
      role: "user",
      content: toolResults.map((r) => ({
        type: "tool_result" as const,
        tool_use_id: r.tool_use_id,
        content: r.content,
      })) as never,
    });
  }

  yield { type: "done", usage: totalUsage };
}
