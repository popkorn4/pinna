"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

const MAX_PER_GROUP = 8;

export type SearchResult = {
  boards: Array<{
    id: string;
    title: string;
    description: string | null;
  }>;
  cards: Array<{
    id: string;
    title: string;
    boardId: string;
    boardTitle: string;
    columnTitle: string;
  }>;
};

/**
 * Поиск по доскам и карточкам, доступным пользователю.
 * Подстрока case-insensitive в title и description.
 * Возвращает не более MAX_PER_GROUP в каждой группе — для UI Cmd+K.
 */
export async function searchEverything(query: string): Promise<SearchResult> {
  const user = await requireUser();
  const q = query.trim();
  if (q.length < 2) return { boards: [], cards: [] };

  // userIds доступа: где он member или owner (BoardMember и так покрывает обе роли)
  const memberOf = await prisma.boardMember.findMany({
    where: { userId: user.id },
    select: { boardId: true },
  });
  const boardIds = memberOf.map((m) => m.boardId);
  if (boardIds.length === 0) return { boards: [], cards: [] };

  const [boards, cards] = await Promise.all([
    prisma.board.findMany({
      where: {
        id: { in: boardIds },
        archivedAt: null,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_PER_GROUP,
      select: { id: true, title: true, description: true },
    }),
    prisma.card.findMany({
      where: {
        archivedAt: null,
        column: { boardId: { in: boardIds } },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_PER_GROUP * 2,
      select: {
        id: true,
        title: true,
        column: {
          select: {
            title: true,
            board: { select: { id: true, title: true } },
          },
        },
      },
    }),
  ]);

  return {
    boards,
    cards: cards.map((c) => ({
      id: c.id,
      title: c.title,
      boardId: c.column.board.id,
      boardTitle: c.column.board.title,
      columnTitle: c.column.title,
    })),
  };
}
