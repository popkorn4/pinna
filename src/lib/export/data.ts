import { prisma } from "@/lib/db/prisma";

/**
 * Один Prisma-запрос со всеми вложенностями для экспорта доски.
 * Используют все форматы (Markdown, JSON, XML, PDF).
 */
export async function fetchBoardForExport(boardId: string) {
  return prisma.board.findUnique({
    where: { id: boardId },
    include: {
      labels: { orderBy: { position: "asc" } },
      columns: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            where: { archivedAt: null },
            orderBy: { position: "asc" },
            include: {
              labels: { include: { label: true } },
              checklists: {
                orderBy: { position: "asc" },
                include: {
                  items: { orderBy: { position: "asc" } },
                },
              },
              comments: {
                orderBy: { createdAt: "asc" },
                include: {
                  author: { select: { name: true, email: true } },
                },
              },
              assignee: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
  });
}

export type BoardForExport = NonNullable<
  Awaited<ReturnType<typeof fetchBoardForExport>>
>;
