"use server";

import { requireUser } from "@/lib/auth";
import { assertBoardAccess } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

/**
 * Карточки доски с дедлайном — для календарного вида.
 * Возвращаем только нужные поля + цвета меток для левой полоски.
 */
export async function listCalendarCards(boardId: string) {
  const user = await requireUser();
  await assertBoardAccess(user.id, boardId);
  return prisma.card.findMany({
    where: {
      archivedAt: null,
      dueDate: { not: null },
      column: { boardId },
    },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      title: true,
      dueDate: true,
      columnId: true,
      column: { select: { title: true } },
      labels: { select: { label: { select: { color: true } } } },
      assignee: { select: { id: true, name: true, email: true, image: true } },
    },
  });
}
