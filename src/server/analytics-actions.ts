"use server";

import { format, startOfWeek, subWeeks } from "date-fns";

import { requireUser } from "@/lib/auth";
import { assertBoardAccess } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

const WEEKS_TO_SHOW = 8;

export type BoardAnalytics = {
  throughput: Array<{
    week: string;
    created: number;
    archived: number;
    restored: number;
  }>;
  byLabel: Array<{ name: string; color: string; count: number }>;
  byAssignee: Array<{
    name: string;
    userId: string | null;
    count: number;
  }>;
  totals: {
    activeCards: number;
    archivedCards: number;
    totalColumns: number;
    activeMembers: number;
  };
};

export async function getBoardAnalytics(
  boardId: string,
): Promise<BoardAnalytics> {
  const user = await requireUser();
  await assertBoardAccess(user.id, boardId);

  const since = startOfWeek(subWeeks(new Date(), WEEKS_TO_SHOW - 1), {
    weekStartsOn: 1,
  });

  // Throughput: считаем created vs archived по неделям
  // (берём все события CARD_CREATED/CARD_ARCHIVED из Activity).
  const events = await prisma.activity.findMany({
    where: {
      boardId,
      type: { in: ["CARD_CREATED", "CARD_ARCHIVED", "CARD_RESTORED"] },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "asc" },
    select: { type: true, createdAt: true },
  });

  const weekKey = (d: Date) =>
    format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const throughputMap = new Map<
    string,
    { created: number; archived: number; restored: number }
  >();
  for (let i = 0; i < WEEKS_TO_SHOW; i++) {
    const k = weekKey(subWeeks(new Date(), WEEKS_TO_SHOW - 1 - i));
    throughputMap.set(k, { created: 0, archived: 0, restored: 0 });
  }
  for (const e of events) {
    const k = weekKey(e.createdAt);
    const slot = throughputMap.get(k);
    if (!slot) continue;
    if (e.type === "CARD_CREATED") slot.created++;
    else if (e.type === "CARD_ARCHIVED") slot.archived++;
    else if (e.type === "CARD_RESTORED") slot.restored++;
  }
  const throughput = Array.from(throughputMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({
      week: format(new Date(week), "d MMM"),
      created: v.created,
      archived: v.archived,
      restored: v.restored,
    }));

  // По меткам
  const byLabelRaw = await prisma.label.findMany({
    where: { boardId },
    select: {
      name: true,
      color: true,
      _count: {
        select: { cards: { where: { card: { archivedAt: null } } } },
      },
    },
  });
  const byLabel = byLabelRaw
    .map((l) => ({
      name: l.name || "(без имени)",
      color: l.color,
      count: l._count.cards,
    }))
    .filter((l) => l.count > 0)
    .sort((a, b) => b.count - a.count);

  // По исполнителю
  const byAssigneeRaw = await prisma.card.groupBy({
    by: ["assigneeId"],
    where: {
      archivedAt: null,
      column: { boardId },
    },
    _count: true,
  });
  const userIds = byAssigneeRaw
    .map((r) => r.assigneeId)
    .filter((x): x is string => Boolean(x));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const byAssignee = byAssigneeRaw
    .map((r) => {
      const u = users.find((x) => x.id === r.assigneeId);
      return {
        userId: r.assigneeId,
        name: u ? (u.name || u.email) : "Без назначения",
        count: r._count,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Тоталы
  const [activeCards, archivedCards, totalColumns, activeMembers] =
    await Promise.all([
      prisma.card.count({
        where: { archivedAt: null, column: { boardId } },
      }),
      prisma.card.count({
        where: { archivedAt: { not: null }, column: { boardId } },
      }),
      prisma.column.count({ where: { boardId } }),
      prisma.boardMember.count({ where: { boardId } }),
    ]);

  return {
    throughput,
    byLabel,
    byAssignee,
    totals: {
      activeCards,
      archivedCards,
      totalColumns,
      activeMembers,
    },
  };
}
