"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import {
  ForbiddenError,
  NotFoundError,
  assertBoardAccess,
  canMutateContent,
} from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/types/action-result";

function handle(err: unknown): ActionResult<never> {
  if (err instanceof NotFoundError) return actionError("Не найдено");
  if (err instanceof ForbiddenError) return actionError("Недостаточно прав");
  console.error("[ai-actions]", err);
  return actionError("Не удалось выполнить");
}

/**
 * Применить отложенное деструктивное действие AI-агента.
 * Только тот, кто его инициировал, может применить.
 */
export async function applyPendingAction(
  actionId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const pending = await prisma.pendingAiAction.findUnique({
      where: { id: actionId },
    });
    if (!pending) throw new NotFoundError();
    if (pending.userId !== user.id) throw new ForbiddenError();
    if (pending.status !== "PENDING")
      return actionError("Действие уже обработано");
    if (pending.expiresAt < new Date())
      return actionError("Срок подтверждения истёк");

    const role = await assertBoardAccess(user.id, pending.boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    const action = pending.action as { type: string } & Record<string, unknown>;

    await prisma.$transaction(async (tx) => {
      switch (action.type) {
        case "delete_card": {
          await tx.card.delete({ where: { id: action.card_id as string } });
          break;
        }
        case "delete_column": {
          await tx.column.delete({
            where: { id: action.column_id as string },
          });
          break;
        }
        default:
          throw new Error(`Unknown action: ${action.type}`);
      }
      await tx.pendingAiAction.update({
        where: { id: actionId },
        data: { status: "APPLIED" },
      });
    });

    revalidatePath(`/boards/${pending.boardId}`);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function rejectPendingAction(
  actionId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const pending = await prisma.pendingAiAction.findUnique({
      where: { id: actionId },
    });
    if (!pending) throw new NotFoundError();
    if (pending.userId !== user.id) throw new ForbiddenError();
    await prisma.pendingAiAction.update({
      where: { id: actionId },
      data: { status: "REJECTED" },
    });
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function listConversations(boardId: string) {
  const user = await requireUser();
  await assertBoardAccess(user.id, boardId);
  return prisma.aiConversation.findMany({
    where: { userId: user.id, boardId },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { id: true, title: true, updatedAt: true },
  });
}

export async function ensureConversation(
  boardId: string,
  conversationId?: string,
): Promise<ActionResult<{ conversationId: string }>> {
  try {
    const user = await requireUser();
    await assertBoardAccess(user.id, boardId);

    if (conversationId) {
      const existing = await prisma.aiConversation.findUnique({
        where: { id: conversationId },
        select: { userId: true, boardId: true },
      });
      if (
        existing &&
        existing.userId === user.id &&
        existing.boardId === boardId
      ) {
        return actionOk({ conversationId });
      }
    }

    const created = await prisma.aiConversation.create({
      data: { userId: user.id, boardId, title: "Новый разговор" },
      select: { id: true },
    });
    return actionOk({ conversationId: created.id });
  } catch (e) {
    return handle(e);
  }
}

export async function getConversationMessages(conversationId: string) {
  const user = await requireUser();
  const conv = await prisma.aiConversation.findUnique({
    where: { id: conversationId },
    select: { userId: true, boardId: true },
  });
  if (!conv || conv.userId !== user.id) throw new NotFoundError();
  return prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      toolCalls: true,
      toolResults: true,
      createdAt: true,
    },
  });
}
