"use server";

import { revalidatePath } from "next/cache";
import { revalidateAndNotifyBoard } from "@/lib/realtime/notify";
import { z } from "zod";

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

const titleSchema = z.string().trim().min(1, "Введите название").max(120);
const itemSchema = z.string().trim().min(1, "Не пусто").max(200);

function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const p = issue.path.join(".");
    if (p && !out[p]) out[p] = issue.message;
  }
  return out;
}

function handle(err: unknown): ActionResult<never> {
  if (err instanceof NotFoundError) return actionError("Не найдено");
  if (err instanceof ForbiddenError) return actionError("Недостаточно прав");
  console.error("[checklist-actions]", err);
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

async function boardOfChecklist(checklistId: string): Promise<{
  boardId: string;
  cardId: string;
}> {
  const cl = await prisma.checklist.findUnique({
    where: { id: checklistId },
    select: { cardId: true, card: { select: { column: { select: { boardId: true } } } } },
  });
  if (!cl) throw new NotFoundError();
  return { boardId: cl.card.column.boardId, cardId: cl.cardId };
}

async function boardOfItem(itemId: string): Promise<{
  boardId: string;
  cardId: string;
}> {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    select: {
      checklist: {
        select: {
          cardId: true,
          card: { select: { column: { select: { boardId: true } } } },
        },
      },
    },
  });
  if (!item) throw new NotFoundError();
  return {
    boardId: item.checklist.card.column.boardId,
    cardId: item.checklist.cardId,
  };
}

export async function createChecklist(
  cardId: string,
  title: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const boardId = await boardOfCard(cardId);
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    const parsed = titleSchema.safeParse(title);
    if (!parsed.success) {
      return actionError("Проверьте поля", { title: parsed.error.issues[0].message });
    }

    const last = await prisma.checklist.findFirst({
      where: { cardId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const cl = await prisma.checklist.create({
      data: {
        cardId,
        title: parsed.data,
        position: (last?.position ?? -1) + 1,
      },
      select: { id: true },
    });

    await revalidateAndNotifyBoard(boardId);
    return actionOk({ id: cl.id });
  } catch (e) {
    return handle(e);
  }
}

export async function updateChecklist(
  checklistId: string,
  title: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const { boardId } = await boardOfChecklist(checklistId);
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    const parsed = titleSchema.safeParse(title);
    if (!parsed.success) {
      return actionError("Проверьте поля");
    }
    await prisma.checklist.update({
      where: { id: checklistId },
      data: { title: parsed.data },
    });
    await revalidateAndNotifyBoard(boardId);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function deleteChecklist(
  checklistId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const { boardId } = await boardOfChecklist(checklistId);
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();
    await prisma.checklist.delete({ where: { id: checklistId } });
    await revalidateAndNotifyBoard(boardId);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function addChecklistItem(
  checklistId: string,
  text: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const { boardId } = await boardOfChecklist(checklistId);
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    const parsed = itemSchema.safeParse(text);
    if (!parsed.success) {
      return actionError("Проверьте поля", { text: parsed.error.issues[0].message });
    }
    const last = await prisma.checklistItem.findFirst({
      where: { checklistId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const item = await prisma.checklistItem.create({
      data: {
        checklistId,
        text: parsed.data,
        position: (last?.position ?? -1) + 1,
      },
      select: { id: true },
    });
    await revalidateAndNotifyBoard(boardId);
    return actionOk({ id: item.id });
  } catch (e) {
    return handle(e);
  }
}

export async function toggleChecklistItem(
  itemId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const { boardId } = await boardOfItem(itemId);
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    const item = await prisma.checklistItem.findUnique({
      where: { id: itemId },
      select: { done: true },
    });
    if (!item) throw new NotFoundError();
    await prisma.checklistItem.update({
      where: { id: itemId },
      data: { done: !item.done },
    });
    await revalidateAndNotifyBoard(boardId);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function updateChecklistItem(
  itemId: string,
  text: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const { boardId } = await boardOfItem(itemId);
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    const parsed = itemSchema.safeParse(text);
    if (!parsed.success) return actionError("Проверьте поля");
    await prisma.checklistItem.update({
      where: { id: itemId },
      data: { text: parsed.data },
    });
    await revalidateAndNotifyBoard(boardId);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function deleteChecklistItem(
  itemId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const { boardId } = await boardOfItem(itemId);
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();
    await prisma.checklistItem.delete({ where: { id: itemId } });
    await revalidateAndNotifyBoard(boardId);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}
