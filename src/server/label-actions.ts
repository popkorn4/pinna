"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import {
  ForbiddenError,
  NotFoundError,
  assertBoardAccess,
  canMutateContent,
} from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { LABEL_COLORS } from "@/lib/labels";
import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/types/action-result";

const colorSchema = z.enum(LABEL_COLORS);

const createSchema = z.object({
  name: z.string().trim().max(40).optional(),
  color: colorSchema,
});

const updateSchema = z.object({
  name: z.string().trim().max(40).nullable().optional(),
  color: colorSchema.optional(),
});

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
  console.error("[label-actions]", err);
  return actionError("Не удалось выполнить действие");
}

export async function listBoardLabels(boardId: string) {
  const user = await requireUser();
  await assertBoardAccess(user.id, boardId);
  return prisma.label.findMany({
    where: { boardId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

export async function createLabel(
  boardId: string,
  input: { name?: string; color: string },
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return actionError("Проверьте поля", fieldErrorsFromZod(parsed.error));
    }

    const last = await prisma.label.findFirst({
      where: { boardId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const label = await prisma.label.create({
      data: {
        boardId,
        name: parsed.data.name ?? "",
        color: parsed.data.color,
        position: (last?.position ?? -1) + 1,
      },
      select: { id: true },
    });

    revalidatePath(`/boards/${boardId}`);
    return actionOk({ id: label.id });
  } catch (e) {
    return handle(e);
  }
}

export async function updateLabel(
  labelId: string,
  input: { name?: string | null; color?: string },
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const label = await prisma.label.findUnique({
      where: { id: labelId },
      select: { boardId: true },
    });
    if (!label) throw new NotFoundError();
    const role = await assertBoardAccess(user.id, label.boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) {
      return actionError("Проверьте поля", fieldErrorsFromZod(parsed.error));
    }

    await prisma.label.update({
      where: { id: labelId },
      data: {
        ...(parsed.data.name !== undefined
          ? { name: parsed.data.name ?? "" }
          : {}),
        ...(parsed.data.color !== undefined
          ? { color: parsed.data.color }
          : {}),
      },
    });

    revalidatePath(`/boards/${label.boardId}`);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function deleteLabel(
  labelId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const label = await prisma.label.findUnique({
      where: { id: labelId },
      select: { boardId: true },
    });
    if (!label) throw new NotFoundError();
    const role = await assertBoardAccess(user.id, label.boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    // Каскадно убираем со всех карточек (в схеме CardLabel onDelete Cascade)
    await prisma.label.delete({ where: { id: labelId } });

    revalidatePath(`/boards/${label.boardId}`);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function addLabelToCard(
  cardId: string,
  labelId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const [card, label] = await Promise.all([
      prisma.card.findUnique({
        where: { id: cardId },
        select: { column: { select: { boardId: true } } },
      }),
      prisma.label.findUnique({
        where: { id: labelId },
        select: { boardId: true },
      }),
    ]);
    if (!card || !label) throw new NotFoundError();
    if (card.column.boardId !== label.boardId) throw new ForbiddenError();
    const role = await assertBoardAccess(user.id, card.column.boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    await prisma.cardLabel.upsert({
      where: { cardId_labelId: { cardId, labelId } },
      create: { cardId, labelId },
      update: {},
    });

    revalidatePath(`/boards/${card.column.boardId}`);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function removeLabelFromCard(
  cardId: string,
  labelId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { column: { select: { boardId: true } } },
    });
    if (!card) throw new NotFoundError();
    const role = await assertBoardAccess(user.id, card.column.boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    await prisma.cardLabel.deleteMany({ where: { cardId, labelId } });

    revalidatePath(`/boards/${card.column.boardId}`);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}
