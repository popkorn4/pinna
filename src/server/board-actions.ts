"use server";

import { revalidatePath } from "next/cache";
import { revalidateAndNotifyBoard } from "@/lib/realtime/notify";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import {
  ForbiddenError,
  NotFoundError,
  assertBoardAccess,
  canDeleteBoard,
  canEditBoard,
  canMutateContent,
} from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { POSITION_STEP } from "@/lib/position";
import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/types/action-result";

const boardCreateSchema = z.object({
  title: z.string().trim().min(1, "Введите название").max(120),
  description: z.string().trim().max(2000).optional(),
});

const boardUpdateSchema = boardCreateSchema.partial();

const columnCreateSchema = z.object({
  title: z.string().trim().min(1, "Введите название").max(80),
});

const columnUpdateSchema = z.object({
  title: z.string().trim().min(1).max(80),
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
  if (err instanceof NotFoundError) return actionError("Доска не найдена");
  if (err instanceof ForbiddenError) return actionError("Недостаточно прав");
  console.error("[board-actions]", err);
  return actionError("Не удалось выполнить действие");
}

// ============================================================
// Boards
// ============================================================

export async function createBoard(input: {
  title: string;
  description?: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = boardCreateSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Проверьте поля", fieldErrorsFromZod(parsed.error));
  }

  try {
    const board = await prisma.$transaction(async (tx) => {
      const b = await tx.board.create({
        data: {
          title: parsed.data.title,
          description: parsed.data.description,
          ownerId: user.id,
        },
        select: { id: true },
      });
      await tx.boardMember.create({
        data: { boardId: b.id, userId: user.id, role: "OWNER" },
      });
      return b;
    });
    revalidatePath("/boards");
    return actionOk({ id: board.id });
  } catch (e) {
    return handle(e);
  }
}

export async function listMyBoards() {
  const user = await requireUser();
  // почему через memberships: владелец и член — оба видят доску, без OR
  const memberships = await prisma.boardMember.findMany({
    where: { userId: user.id, board: { archivedAt: null } },
    orderBy: { board: { updatedAt: "desc" } },
    select: {
      role: true,
      board: {
        select: {
          id: true,
          title: true,
          description: true,
          updatedAt: true,
          ownerId: true,
          _count: { select: { columns: true, members: true } },
        },
      },
    },
  });

  // Подсчёт карточек одним запросом, чтобы не ловить N+1
  const boardIds = memberships.map((m) => m.board.id);
  const counts = await prisma.card.groupBy({
    by: ["columnId"],
    where: { archivedAt: null, column: { boardId: { in: boardIds } } },
    _count: true,
  });
  const columnsByBoard = await prisma.column.findMany({
    where: { boardId: { in: boardIds } },
    select: { id: true, boardId: true },
  });
  const cardCountByBoard = new Map<string, number>();
  for (const c of counts) {
    const col = columnsByBoard.find((x) => x.id === c.columnId);
    if (col) {
      cardCountByBoard.set(
        col.boardId,
        (cardCountByBoard.get(col.boardId) ?? 0) + c._count,
      );
    }
  }

  return memberships.map((m) => ({
    id: m.board.id,
    title: m.board.title,
    description: m.board.description,
    updatedAt: m.board.updatedAt,
    role: m.role,
    columnsCount: m.board._count.columns,
    membersCount: m.board._count.members,
    cardsCount: cardCountByBoard.get(m.board.id) ?? 0,
  }));
}

export async function getBoard(boardId: string) {
  const user = await requireUser();
  const role = await assertBoardAccess(user.id, boardId);

  const board = await prisma.board.findUnique({
    // почему включаем archivedAt в where-условие: чтобы не показывать
    // архив по прямому URL (404 как для несуществующей)
    where: { id: boardId, archivedAt: null },
    include: {
      members: {
        select: {
          role: true,
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      columns: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          position: true,
          cards: {
            where: { archivedAt: null },
            orderBy: { position: "asc" },
            select: {
              id: true,
              title: true,
              description: true,
              position: true,
              dueDate: true,
              assignee: {
                select: { id: true, name: true, email: true, image: true },
              },
              labels: {
                select: {
                  label: { select: { id: true, name: true, color: true } },
                },
              },
            },
          },
          _count: { select: { cards: { where: { archivedAt: null } } } },
        },
      },
      labels: {
        orderBy: [{ position: "asc" }, { name: "asc" }],
        select: { id: true, name: true, color: true },
      },
    },
  });
  if (!board) throw new NotFoundError();
  return { board, role };
}

export async function updateBoard(
  boardId: string,
  input: { title?: string; description?: string },
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const role = await assertBoardAccess(user.id, boardId);
    if (!canEditBoard(role)) throw new ForbiddenError();

    const parsed = boardUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return actionError("Проверьте поля", fieldErrorsFromZod(parsed.error));
    }
    await prisma.board.update({ where: { id: boardId }, data: parsed.data });
    await revalidateAndNotifyBoard(boardId);
    revalidatePath("/boards");
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function archiveBoard(
  boardId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const role = await assertBoardAccess(user.id, boardId);
    if (!canEditBoard(role)) throw new ForbiddenError();
    await prisma.board.update({
      where: { id: boardId },
      data: { archivedAt: new Date() },
    });
    revalidatePath("/boards");
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function unarchiveBoard(
  boardId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const role = await assertBoardAccess(user.id, boardId);
    if (!canEditBoard(role)) throw new ForbiddenError();
    await prisma.board.update({
      where: { id: boardId },
      data: { archivedAt: null },
    });
    revalidatePath("/boards");
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function deleteBoard(
  boardId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const role = await assertBoardAccess(user.id, boardId);
    if (!canDeleteBoard(role)) throw new ForbiddenError();
    await prisma.board.delete({ where: { id: boardId } });
    revalidatePath("/boards");
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

// ============================================================
// Columns
// ============================================================

export async function createColumn(
  boardId: string,
  input: { title: string },
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    const parsed = columnCreateSchema.safeParse(input);
    if (!parsed.success) {
      return actionError("Проверьте поля", fieldErrorsFromZod(parsed.error));
    }

    const last = await prisma.column.findFirst({
      where: { boardId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (last?.position ?? 0) + POSITION_STEP;

    const col = await prisma.column.create({
      data: { boardId, title: parsed.data.title, position },
      select: { id: true },
    });
    await revalidateAndNotifyBoard(boardId);
    return actionOk({ id: col.id });
  } catch (e) {
    return handle(e);
  }
}

export async function updateColumn(
  columnId: string,
  input: { title: string },
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const col = await prisma.column.findUnique({
      where: { id: columnId },
      select: { boardId: true },
    });
    if (!col) throw new NotFoundError();
    const role = await assertBoardAccess(user.id, col.boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    const parsed = columnUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return actionError("Проверьте поля", fieldErrorsFromZod(parsed.error));
    }
    await prisma.column.update({
      where: { id: columnId },
      data: { title: parsed.data.title },
    });
    await revalidateAndNotifyBoard(col.boardId);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function deleteColumn(
  columnId: string,
  options?: { force?: boolean },
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const col = await prisma.column.findUnique({
      where: { id: columnId },
      select: {
        boardId: true,
        _count: { select: { cards: true } },
      },
    });
    if (!col) throw new NotFoundError();
    const role = await assertBoardAccess(user.id, col.boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    // почему force: дефолт — безопасный, нельзя случайно стереть колонку с
    // карточками. UI должен явно подтвердить удаление с ним.
    if (col._count.cards > 0 && !options?.force) {
      return actionError(
        "Колонка не пуста. Удалить вместе с карточками?",
      );
    }

    await prisma.column.delete({ where: { id: columnId } });
    await revalidateAndNotifyBoard(col.boardId);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function reorderColumns(
  boardId: string,
  columnIds: string[],
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const role = await assertBoardAccess(user.id, boardId);
    if (!canMutateContent(role)) throw new ForbiddenError();

    // Проверим, что все колонки принадлежат этой доске — не доверяем входу
    const cols = await prisma.column.findMany({
      where: { boardId, id: { in: columnIds } },
      select: { id: true },
    });
    if (cols.length !== columnIds.length) {
      throw new ForbiddenError();
    }

    await prisma.$transaction(
      columnIds.map((id, idx) =>
        prisma.column.update({
          where: { id },
          data: { position: (idx + 1) * POSITION_STEP },
        }),
      ),
    );
    await revalidateAndNotifyBoard(boardId);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}
