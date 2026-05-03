import type Anthropic from "@anthropic-ai/sdk";

import { prisma } from "@/lib/db/prisma";
import {
  ForbiddenError,
  NotFoundError,
  assertBoardAccess,
  canMutateContent,
} from "@/lib/auth/permissions";
import { POSITION_STEP } from "@/lib/position";
import { LABEL_COLORS } from "@/lib/labels";

// Контекст, передаваемый каждому хендлеру: id пользователя и доски.
// почему: сервер ВСЕГДА фиксирует контекст. LLM не передаёт board_id —
// агент жёстко привязан к доске, на которой запущен.
export type AiToolContext = {
  userId: string;
  boardId: string;
};

// Стандартный результат tool — текстовый ответ Claude'у.
type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string }
  | { ok: true; data: { status: "pending_confirmation"; action_id: string; summary: string } };

type ToolHandler = (
  input: Record<string, unknown>,
  ctx: AiToolContext,
) => Promise<ToolResult>;

type AiTool = {
  definition: Anthropic.Tool;
  handler: ToolHandler;
  destructive?: boolean;
};

function ok<T>(data: T): ToolResult {
  return { ok: true, data };
}
function err(message: string): ToolResult {
  return { ok: false, error: message };
}

async function ensureMutate(ctx: AiToolContext) {
  const role = await assertBoardAccess(ctx.userId, ctx.boardId);
  if (!canMutateContent(role)) throw new ForbiddenError();
  return role;
}

// =====================================================================
// Read-only tools
// =====================================================================

const list_columns: AiTool = {
  definition: {
    name: "list_columns",
    description: "Список всех колонок текущей доски с количеством карточек.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  handler: async (_input, ctx) => {
    await assertBoardAccess(ctx.userId, ctx.boardId);
    const cols = await prisma.column.findMany({
      where: { boardId: ctx.boardId },
      orderBy: { position: "asc" },
      select: {
        id: true,
        title: true,
        _count: { select: { cards: { where: { archivedAt: null } } } },
      },
    });
    return ok(
      cols.map((c) => ({
        id: c.id,
        title: c.title,
        cards_count: c._count.cards,
      })),
    );
  },
};

const list_cards: AiTool = {
  definition: {
    name: "list_cards",
    description:
      "Список карточек доски, опционально с фильтром по колонке или текстовому поиску в названии/описании.",
    input_schema: {
      type: "object",
      properties: {
        column_id: { type: "string" },
        query: { type: "string", description: "Подстрока в title/description" },
        only_with_due: { type: "boolean", description: "Только с дедлайном" },
        only_overdue: { type: "boolean", description: "Только просроченные" },
      },
      required: [],
    },
  },
  handler: async (input, ctx) => {
    await assertBoardAccess(ctx.userId, ctx.boardId);
    const where: Record<string, unknown> = {
      column: { boardId: ctx.boardId },
      archivedAt: null,
    };
    if (typeof input.column_id === "string") where.columnId = input.column_id;
    if (typeof input.query === "string" && input.query.trim()) {
      where.OR = [
        { title: { contains: input.query, mode: "insensitive" } },
        { description: { contains: input.query, mode: "insensitive" } },
      ];
    }
    if (input.only_with_due) where.dueDate = { not: null };
    if (input.only_overdue) where.dueDate = { lt: new Date() };

    const cards = await prisma.card.findMany({
      where,
      orderBy: [{ columnId: "asc" }, { position: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        columnId: true,
        dueDate: true,
        labels: { select: { label: { select: { id: true, name: true } } } },
        assignee: { select: { id: true, name: true, email: true } },
      },
      take: 200,
    });
    return ok(
      cards.map((c) => ({
        id: c.id,
        title: c.title,
        column_id: c.columnId,
        description_preview: c.description?.slice(0, 200) ?? null,
        due_date: c.dueDate?.toISOString() ?? null,
        labels: c.labels.map((l) => ({ id: l.label.id, name: l.label.name })),
        assignee: c.assignee
          ? { id: c.assignee.id, name: c.assignee.name ?? c.assignee.email }
          : null,
      })),
    );
  },
};

const get_card: AiTool = {
  definition: {
    name: "get_card",
    description: "Полная информация по карточке.",
    input_schema: {
      type: "object",
      properties: { card_id: { type: "string" } },
      required: ["card_id"],
    },
  },
  handler: async (input, ctx) => {
    await assertBoardAccess(ctx.userId, ctx.boardId);
    const card = await prisma.card.findUnique({
      where: { id: input.card_id as string },
      include: {
        column: { select: { id: true, title: true, boardId: true } },
        labels: { select: { label: { select: { id: true, name: true } } } },
        assignee: { select: { id: true, name: true, email: true } },
        checklists: {
          select: {
            id: true,
            title: true,
            items: { select: { text: true, done: true } },
          },
        },
      },
    });
    if (!card) return err("Карточка не найдена");
    if (card.column.boardId !== ctx.boardId) return err("Карточка с другой доски");
    return ok({
      id: card.id,
      title: card.title,
      description: card.description,
      column: { id: card.column.id, title: card.column.title },
      due_date: card.dueDate?.toISOString() ?? null,
      labels: card.labels.map((l) => ({ id: l.label.id, name: l.label.name })),
      assignee: card.assignee
        ? { id: card.assignee.id, name: card.assignee.name ?? card.assignee.email }
        : null,
      checklists: card.checklists.map((cl) => ({
        id: cl.id,
        title: cl.title,
        progress: `${cl.items.filter((i) => i.done).length}/${cl.items.length}`,
      })),
    });
  },
};

const list_members: AiTool = {
  definition: {
    name: "list_members",
    description: "Участники доски (для назначений).",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  handler: async (_input, ctx) => {
    await assertBoardAccess(ctx.userId, ctx.boardId);
    const m = await prisma.boardMember.findMany({
      where: { boardId: ctx.boardId },
      select: {
        role: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return ok(
      m.map((x) => ({
        id: x.user.id,
        name: x.user.name ?? x.user.email,
        role: x.role,
      })),
    );
  },
};

const list_labels: AiTool = {
  definition: {
    name: "list_labels",
    description: "Метки доски с цветами.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  handler: async (_input, ctx) => {
    await assertBoardAccess(ctx.userId, ctx.boardId);
    const labels = await prisma.label.findMany({
      where: { boardId: ctx.boardId },
      orderBy: { position: "asc" },
      select: { id: true, name: true, color: true },
    });
    return ok(labels);
  },
};

const get_today_date: AiTool = {
  definition: {
    name: "get_today_date",
    description:
      "Текущая дата в формате YYYY-MM-DD. Использовать для расчёта 'сегодня', 'завтра', 'через неделю'.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  handler: async () => {
    const d = new Date();
    return ok({
      today: d.toISOString().slice(0, 10),
      iso: d.toISOString(),
      weekday: d.toLocaleDateString("ru-RU", { weekday: "long" }),
    });
  },
};

// =====================================================================
// Mutating tools
// =====================================================================

const create_card: AiTool = {
  definition: {
    name: "create_card",
    description: "Создать карточку в указанной колонке.",
    input_schema: {
      type: "object",
      properties: {
        column_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        due_date: {
          type: "string",
          description: "ISO 8601 (YYYY-MM-DD или полная дата)",
        },
        label_ids: { type: "array", items: { type: "string" } },
        assignee_id: { type: "string" },
      },
      required: ["column_id", "title"],
    },
  },
  handler: async (input, ctx) => {
    await ensureMutate(ctx);
    const col = await prisma.column.findUnique({
      where: { id: input.column_id as string },
      select: { boardId: true },
    });
    if (!col || col.boardId !== ctx.boardId) return err("Колонка не найдена");

    const last = await prisma.card.findFirst({
      where: { columnId: input.column_id as string, archivedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (last?.position ?? 0) + POSITION_STEP;

    const card = await prisma.card.create({
      data: {
        columnId: input.column_id as string,
        title: input.title as string,
        description: (input.description as string | undefined) ?? null,
        position,
        createdById: ctx.userId,
        dueDate: input.due_date
          ? new Date(input.due_date as string)
          : null,
        assigneeId: (input.assignee_id as string | undefined) ?? null,
      },
      select: { id: true, title: true },
    });

    if (Array.isArray(input.label_ids) && input.label_ids.length > 0) {
      await prisma.cardLabel.createMany({
        data: (input.label_ids as string[]).map((labelId) => ({
          cardId: card.id,
          labelId,
        })),
        skipDuplicates: true,
      });
    }

    return ok({ id: card.id, title: card.title });
  },
};

const update_card: AiTool = {
  definition: {
    name: "update_card",
    description: "Обновить поля карточки (title, description, due_date, assignee_id).",
    input_schema: {
      type: "object",
      properties: {
        card_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        due_date: { type: "string", description: "ISO или null чтобы убрать" },
        assignee_id: { type: "string", description: "Передать null чтобы снять" },
      },
      required: ["card_id"],
    },
  },
  handler: async (input, ctx) => {
    await ensureMutate(ctx);
    const card = await prisma.card.findUnique({
      where: { id: input.card_id as string },
      select: { column: { select: { boardId: true } } },
    });
    if (!card || card.column.boardId !== ctx.boardId)
      return err("Карточка не найдена");

    const data: Record<string, unknown> = {};
    if (typeof input.title === "string") data.title = input.title;
    if ("description" in input) data.description = input.description ?? null;
    if ("due_date" in input)
      data.dueDate = input.due_date ? new Date(input.due_date as string) : null;
    if ("assignee_id" in input) data.assigneeId = input.assignee_id ?? null;

    await prisma.card.update({
      where: { id: input.card_id as string },
      data,
    });
    return ok({ updated: true });
  },
};

const move_card: AiTool = {
  definition: {
    name: "move_card",
    description: "Переместить карточку в другую колонку (в начало, конец или к указанной позиции).",
    input_schema: {
      type: "object",
      properties: {
        card_id: { type: "string" },
        target_column_id: { type: "string" },
        position: {
          type: "string",
          enum: ["start", "end"],
          description: "Куда вставить — в начало или в конец колонки",
        },
      },
      required: ["card_id", "target_column_id"],
    },
  },
  handler: async (input, ctx) => {
    await ensureMutate(ctx);
    const [card, col] = await Promise.all([
      prisma.card.findUnique({
        where: { id: input.card_id as string },
        select: { column: { select: { boardId: true } } },
      }),
      prisma.column.findUnique({
        where: { id: input.target_column_id as string },
        select: { boardId: true },
      }),
    ]);
    if (!card || card.column.boardId !== ctx.boardId)
      return err("Карточка не найдена");
    if (!col || col.boardId !== ctx.boardId)
      return err("Целевая колонка не найдена");

    const isStart = input.position === "start";
    const ref = isStart
      ? await prisma.card.findFirst({
          where: { columnId: input.target_column_id as string },
          orderBy: { position: "asc" },
          select: { position: true },
        })
      : await prisma.card.findFirst({
          where: { columnId: input.target_column_id as string },
          orderBy: { position: "desc" },
          select: { position: true },
        });
    const newPos = isStart
      ? (ref?.position ?? POSITION_STEP) / 2
      : (ref?.position ?? 0) + POSITION_STEP;

    await prisma.card.update({
      where: { id: input.card_id as string },
      data: {
        columnId: input.target_column_id as string,
        position: newPos,
      },
    });
    return ok({ moved: true });
  },
};

const add_label_to_card: AiTool = {
  definition: {
    name: "add_label_to_card",
    description: "Назначить существующую метку доски на карточку.",
    input_schema: {
      type: "object",
      properties: {
        card_id: { type: "string" },
        label_id: { type: "string" },
      },
      required: ["card_id", "label_id"],
    },
  },
  handler: async (input, ctx) => {
    await ensureMutate(ctx);
    await prisma.cardLabel.upsert({
      where: {
        cardId_labelId: {
          cardId: input.card_id as string,
          labelId: input.label_id as string,
        },
      },
      create: {
        cardId: input.card_id as string,
        labelId: input.label_id as string,
      },
      update: {},
    });
    return ok({ added: true });
  },
};

const create_label: AiTool = {
  definition: {
    name: "create_label",
    description: "Создать новую метку доски.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        color: {
          type: "string",
          enum: [...LABEL_COLORS],
          description: "Цвет из палитры",
        },
      },
      required: ["color"],
    },
  },
  handler: async (input, ctx) => {
    await ensureMutate(ctx);
    const last = await prisma.label.findFirst({
      where: { boardId: ctx.boardId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const label = await prisma.label.create({
      data: {
        boardId: ctx.boardId,
        name: (input.name as string | undefined) ?? "",
        color: input.color as string,
        position: (last?.position ?? -1) + 1,
      },
      select: { id: true, name: true, color: true },
    });
    return ok(label);
  },
};

const add_checklist: AiTool = {
  definition: {
    name: "add_checklist",
    description: "Добавить чек-лист на карточку с готовыми пунктами.",
    input_schema: {
      type: "object",
      properties: {
        card_id: { type: "string" },
        title: { type: "string" },
        items: { type: "array", items: { type: "string" } },
      },
      required: ["card_id", "title", "items"],
    },
  },
  handler: async (input, ctx) => {
    await ensureMutate(ctx);
    const card = await prisma.card.findUnique({
      where: { id: input.card_id as string },
      select: { column: { select: { boardId: true } } },
    });
    if (!card || card.column.boardId !== ctx.boardId)
      return err("Карточка не найдена");

    const last = await prisma.checklist.findFirst({
      where: { cardId: input.card_id as string },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const cl = await prisma.checklist.create({
      data: {
        cardId: input.card_id as string,
        title: input.title as string,
        position: (last?.position ?? -1) + 1,
        items: {
          create: (input.items as string[]).map((text, idx) => ({
            text,
            position: idx,
          })),
        },
      },
      select: { id: true, items: { select: { id: true } } },
    });
    return ok({ id: cl.id, items_count: cl.items.length });
  },
};

// =====================================================================
// Destructive tools — создают PendingAiAction вместо немедленного действия
// =====================================================================

const delete_card: AiTool = {
  destructive: true,
  definition: {
    name: "delete_card",
    description:
      "Удалить карточку. ВАЖНО: возвращает pending_confirmation — пользователь должен явно подтвердить.",
    input_schema: {
      type: "object",
      properties: { card_id: { type: "string" } },
      required: ["card_id"],
    },
  },
  handler: async (input, ctx) => {
    await ensureMutate(ctx);
    const card = await prisma.card.findUnique({
      where: { id: input.card_id as string },
      select: { title: true, column: { select: { boardId: true } } },
    });
    if (!card || card.column.boardId !== ctx.boardId)
      return err("Карточка не найдена");

    const pending = await prisma.pendingAiAction.create({
      data: {
        userId: ctx.userId,
        boardId: ctx.boardId,
        action: { type: "delete_card", card_id: input.card_id as string },
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      select: { id: true },
    });

    return {
      ok: true,
      data: {
        status: "pending_confirmation",
        action_id: pending.id,
        summary: `Будет удалена карточка «${card.title}». Подтвердите действие в UI.`,
      },
    };
  },
};

const delete_column: AiTool = {
  destructive: true,
  definition: {
    name: "delete_column",
    description:
      "Удалить колонку (вместе со всеми её карточками). Возвращает pending_confirmation.",
    input_schema: {
      type: "object",
      properties: { column_id: { type: "string" } },
      required: ["column_id"],
    },
  },
  handler: async (input, ctx) => {
    await ensureMutate(ctx);
    const col = await prisma.column.findUnique({
      where: { id: input.column_id as string },
      select: {
        title: true,
        boardId: true,
        _count: { select: { cards: { where: { archivedAt: null } } } },
      },
    });
    if (!col || col.boardId !== ctx.boardId) return err("Колонка не найдена");

    const pending = await prisma.pendingAiAction.create({
      data: {
        userId: ctx.userId,
        boardId: ctx.boardId,
        action: { type: "delete_column", column_id: input.column_id as string },
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      select: { id: true },
    });

    return {
      ok: true,
      data: {
        status: "pending_confirmation",
        action_id: pending.id,
        summary: `Будет удалена колонка «${col.title}» вместе с ${col._count.cards} карточками. Подтвердите действие.`,
      },
    };
  },
};

// =====================================================================
// Реестр
// =====================================================================

export const AI_TOOLS: AiTool[] = [
  list_columns,
  list_cards,
  get_card,
  list_members,
  list_labels,
  get_today_date,
  create_card,
  update_card,
  move_card,
  add_label_to_card,
  create_label,
  add_checklist,
  delete_card,
  delete_column,
];

const TOOL_BY_NAME = new Map(AI_TOOLS.map((t) => [t.definition.name, t]));

export function getToolDefinitions(): Anthropic.Tool[] {
  return AI_TOOLS.map((t) => t.definition);
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: AiToolContext,
): Promise<ToolResult> {
  const tool = TOOL_BY_NAME.get(name);
  if (!tool) return err(`Неизвестный инструмент: ${name}`);
  try {
    return await tool.handler(input, ctx);
  } catch (e) {
    if (e instanceof NotFoundError) return err("Не найдено");
    if (e instanceof ForbiddenError) return err("Недостаточно прав");
    console.error("[ai-tool]", name, e);
    return err("Внутренняя ошибка инструмента");
  }
}
