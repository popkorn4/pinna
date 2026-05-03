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
import { POSITION_STEP } from "@/lib/position";
import {
  midpoint,
  needsRebalance,
  rebalancedPositions,
} from "@/lib/position-strategy";
import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/types/action-result";

const createSchema = z.object({
  title: z.string().trim().min(1, "Введите название").max(200),
  description: z.string().trim().max(20000).optional(),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(20000).nullable().optional(),
  dueDate: z
    .union([z.string().datetime(), z.date(), z.null()])
    .optional()
    .transform((v) => (v == null || v === "" ? null : new Date(v))),
});

const moveSchema = z
  .object({
    cardId: z.string().min(1),
    targetColumnId: z.string().min(1),
    beforeCardId: z.string().nullish(),
    afterCardId: z.string().nullish(),
    toEnd: z.boolean().optional(),
  })
  // ровно один из вариантов позиционирования
  .refine(
    (d) =>
      [d.beforeCardId, d.afterCardId, d.toEnd].filter(Boolean).length <= 1,
    "Укажите только один вариант позиции",
  );

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
  console.error("[card-actions]", err);
  return actionError("Не удалось выполнить действие");
}

async function getColumnBoard(columnId: string): Promise<{ boardId: string }> {
  const col = await prisma.column.findUnique({
    where: { id: columnId },
    select: { boardId: true },
  });
  if (!col) throw new NotFoundError();
  return col;
}

async function getCardBoard(
  cardId: string,
): Promise<{ boardId: string; columnId: string; position: number }> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { columnId: true, position: true, column: { select: { boardId: true } } },
  });
  if (!card) throw new NotFoundError();
  return {
    boardId: card.column.boardId,
    columnId: card.columnId,
    position: card.position,
  };
}

// ============================================================
// Card CRUD
// ============================================================

export async function createCard(
  columnId: string,
  input: { title: string; description?: string },
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const { boardId } = await getColumnBoard(columnId);
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return actionError("Проверьте поля", fieldErrorsFromZod(parsed.error));
    }

    const last = await prisma.card.findFirst({
      where: { columnId, archivedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (last?.position ?? 0) + POSITION_STEP;

    const card = await prisma.card.create({
      data: {
        columnId,
        title: parsed.data.title,
        description: parsed.data.description,
        position,
        createdById: user.id,
      },
      select: { id: true },
    });

    revalidatePath(`/boards/${boardId}`);
    return actionOk({ id: card.id });
  } catch (e) {
    return handle(e);
  }
}

export async function updateCard(
  cardId: string,
  input: {
    title?: string;
    description?: string | null;
    dueDate?: string | Date | null;
  },
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const { boardId } = await getCardBoard(cardId);
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) {
      return actionError("Проверьте поля", fieldErrorsFromZod(parsed.error));
    }

    await prisma.card.update({
      where: { id: cardId },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description ?? null }
          : {}),
        ...(parsed.data.dueDate !== undefined
          ? { dueDate: parsed.data.dueDate }
          : {}),
      },
    });

    revalidatePath(`/boards/${boardId}`);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function archiveCard(
  cardId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const { boardId } = await getCardBoard(cardId);
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    await prisma.card.update({
      where: { id: cardId },
      data: { archivedAt: new Date() },
    });
    revalidatePath(`/boards/${boardId}`);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function unarchiveCard(
  cardId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const { boardId } = await getCardBoard(cardId);
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    await prisma.card.update({
      where: { id: cardId },
      data: { archivedAt: null },
    });
    revalidatePath(`/boards/${boardId}`);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function deleteCard(
  cardId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const { boardId } = await getCardBoard(cardId);
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    await prisma.card.delete({ where: { id: cardId } });
    revalidatePath(`/boards/${boardId}`);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

// ============================================================
// Move card (DnD)
// ============================================================

export async function moveCard(input: {
  cardId: string;
  targetColumnId: string;
  beforeCardId?: string | null;
  afterCardId?: string | null;
  toEnd?: boolean;
}): Promise<ActionResult<{ position: number }>> {
  try {
    const user = await requireUser();
    const parsed = moveSchema.safeParse(input);
    if (!parsed.success) {
      return actionError("Некорректный запрос");
    }
    const { cardId, targetColumnId, beforeCardId, afterCardId, toEnd } =
      parsed.data;

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: {
        columnId: true,
        position: true,
        column: { select: { boardId: true } },
      },
    });
    if (!card) throw new NotFoundError();

    const targetCol = await prisma.column.findUnique({
      where: { id: targetColumnId },
      select: { boardId: true },
    });
    if (!targetCol) throw new NotFoundError();

    // Перемещение возможно только в пределах одной доски
    if (card.column.boardId !== targetCol.boardId) {
      throw new ForbiddenError();
    }
    const role = await assertBoardAccess(user.id, targetCol.boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    // Считаем новую позицию
    let newPos: number;
    if (beforeCardId) {
      const before = await prisma.card.findUnique({
        where: { id: beforeCardId },
        select: { position: true, columnId: true },
      });
      if (!before || before.columnId !== targetColumnId) {
        throw new ForbiddenError();
      }
      const prev = await prisma.card.findFirst({
        where: {
          columnId: targetColumnId,
          position: { lt: before.position },
          id: { not: cardId },
        },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      newPos = midpoint(prev?.position ?? null, before.position);
    } else if (afterCardId) {
      const after = await prisma.card.findUnique({
        where: { id: afterCardId },
        select: { position: true, columnId: true },
      });
      if (!after || after.columnId !== targetColumnId) {
        throw new ForbiddenError();
      }
      const next = await prisma.card.findFirst({
        where: {
          columnId: targetColumnId,
          position: { gt: after.position },
          id: { not: cardId },
        },
        orderBy: { position: "asc" },
        select: { position: true },
      });
      newPos = midpoint(after.position, next?.position ?? null);
    } else {
      // toEnd или нет ничего → в конец
      const last = await prisma.card.findFirst({
        where: { columnId: targetColumnId, id: { not: cardId } },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      newPos = midpoint(last?.position ?? null, null);
    }

    // Если мы и так на этой позиции и в той же колонке — ничего не делаем
    if (
      card.columnId === targetColumnId &&
      Math.abs(card.position - newPos) < 0.0001
    ) {
      return actionOk({ position: card.position });
    }

    await prisma.card.update({
      where: { id: cardId },
      data: { columnId: targetColumnId, position: newPos },
    });

    // Ребаланс если соседи слиплись
    const neighbors = await prisma.card.findMany({
      where: { columnId: targetColumnId },
      orderBy: { position: "asc" },
      select: { id: true, position: true },
    });
    const collision = neighbors.some(
      (c, i) => i > 0 && needsRebalance(neighbors[i - 1].position, c.position),
    );
    if (collision) {
      const positions = rebalancedPositions(neighbors.length);
      await prisma.$transaction(
        neighbors.map((c, i) =>
          prisma.card.update({
            where: { id: c.id },
            data: { position: positions[i] },
          }),
        ),
      );
      newPos = positions[neighbors.findIndex((c) => c.id === cardId)];
    }

    revalidatePath(`/boards/${targetCol.boardId}`);
    return actionOk({ position: newPos });
  } catch (e) {
    return handle(e);
  }
}

export async function reorderCardsInColumn(
  columnId: string,
  cardIds: string[],
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const { boardId } = await getColumnBoard(columnId);
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    const cards = await prisma.card.findMany({
      where: { columnId, id: { in: cardIds } },
      select: { id: true },
    });
    if (cards.length !== cardIds.length) throw new ForbiddenError();

    await prisma.$transaction(
      cardIds.map((id, idx) =>
        prisma.card.update({
          where: { id },
          data: { position: (idx + 1) * POSITION_STEP },
        }),
      ),
    );
    revalidatePath(`/boards/${boardId}`);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}
