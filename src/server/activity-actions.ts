"use server";

import { requireUser } from "@/lib/auth";
import { assertBoardAccess } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

/**
 * Лента активности доски — последние 100 событий.
 * почему 100: для MVP хватает; пагинация — позже.
 * Фильтруем системные AI_RATE_HIT (это техническое для rate-limit'а).
 */
export async function listCardActivity(cardId: string) {
  const user = await requireUser();
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { column: { select: { boardId: true } } },
  });
  if (!card) return [];
  await assertBoardAccess(user.id, card.column.boardId);
  return prisma.activity.findMany({
    where: { cardId, type: { not: "AI_RATE_HIT" } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      type: true,
      payload: true,
      createdAt: true,
      cardId: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });
}

export async function listBoardActivity(
  boardId: string,
  filterUserId?: string,
) {
  const user = await requireUser();
  await assertBoardAccess(user.id, boardId);

  return prisma.activity.findMany({
    where: {
      boardId,
      type: { not: "AI_RATE_HIT" },
      ...(filterUserId ? { userId: filterUserId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      payload: true,
      createdAt: true,
      cardId: true,
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });
}
