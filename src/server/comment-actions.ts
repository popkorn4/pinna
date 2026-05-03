"use server";

import { revalidatePath } from "next/cache";
import { revalidateAndNotifyBoard } from "@/lib/realtime/notify";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import {
  ForbiddenError,
  NotFoundError,
  assertBoardAccess,
  canReportProgress,
} from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db/prisma";
import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/types/action-result";

const bodySchema = z
  .string()
  .trim()
  .min(1, "Комментарий пуст")
  .max(20000, "Слишком длинно");

function handle(err: unknown): ActionResult<never> {
  if (err instanceof NotFoundError) return actionError("Не найдено");
  if (err instanceof ForbiddenError) return actionError("Недостаточно прав");
  console.error("[comment-actions]", err);
  return actionError("Не удалось выполнить действие");
}

async function boardOfCard(cardId: string): Promise<string> {
  const c = await prisma.card.findUnique({
    where: { id: cardId },
    select: { column: { select: { boardId: true } } },
  });
  if (!c) throw new NotFoundError();
  return c.column.boardId;
}

export async function createComment(
  cardId: string,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const boardId = await boardOfCard(cardId);
    const role = await assertBoardAccess(user.id, boardId);
    // почему canReportProgress: комментарии — главный способ отчёта;
    // исполнители должны иметь возможность писать о выполненной работе
    if (!canReportProgress(role)) throw new ForbiddenError();

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return actionError("Проверьте поля", { body: parsed.error.issues[0].message });
    }

    const c = await prisma.comment.create({
      data: { cardId, authorId: user.id, body: parsed.data },
      select: { id: true },
    });
    const cardData = await prisma.card.findUnique({
      where: { id: cardId },
      select: { title: true },
    });
    await logActivity({
      boardId,
      userId: user.id,
      cardId,
      type: "COMMENT_CREATED",
      payload: {
        cardTitle: cardData?.title,
        preview: parsed.data.slice(0, 200),
      },
    });
    await revalidateAndNotifyBoard(boardId);
    return actionOk({ id: c.id });
  } catch (e) {
    return handle(e);
  }
}

export async function updateComment(
  commentId: string,
  body: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const c = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        authorId: true,
        card: { select: { column: { select: { boardId: true } } } },
      },
    });
    if (!c) throw new NotFoundError();
    if (c.authorId !== user.id) throw new ForbiddenError();
    const role = await assertBoardAccess(user.id, c.card.column.boardId);
    // править свой комментарий может любой, кто может отчитываться
    if (!canReportProgress(role)) throw new ForbiddenError();

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return actionError("Проверьте поля");

    await prisma.comment.update({
      where: { id: commentId },
      data: { body: parsed.data },
    });
    await revalidateAndNotifyBoard(c.card.column.boardId);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function deleteComment(
  commentId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const c = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        authorId: true,
        card: { select: { column: { select: { boardId: true } } } },
      },
    });
    if (!c) throw new NotFoundError();
    const boardId = c.card.column.boardId;
    const role = await assertBoardAccess(user.id, boardId);
    // Удалить может автор или OWNER доски
    if (c.authorId !== user.id && role !== "OWNER") {
      throw new ForbiddenError();
    }
    await prisma.comment.delete({ where: { id: commentId } });
    await revalidateAndNotifyBoard(boardId);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}
