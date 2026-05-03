import { prisma } from "@/lib/db/prisma";

// Простой rate-limiter на Postgres-таблице Activity (повторно используем тип
// AI_RATE_HIT). Считаем хиты пользователя за час и доски за день.
// почему так: не хочу заводить Redis ради MVP — Activity всё равно есть,
// и индекс по boardId+createdAt уже есть.

const PER_USER_HOUR = 30;
const PER_BOARD_DAY = 100;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: "user_hour" | "board_day"; retryAfterSec: number };

export async function checkAiRateLimit(
  userId: string,
  boardId: string,
): Promise<RateLimitResult> {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [userHits, boardHits] = await Promise.all([
    prisma.activity.count({
      where: {
        userId,
        type: "AI_RATE_HIT",
        createdAt: { gte: hourAgo },
      },
    }),
    prisma.activity.count({
      where: {
        boardId,
        type: "AI_RATE_HIT",
        createdAt: { gte: dayAgo },
      },
    }),
  ]);

  if (userHits >= PER_USER_HOUR) {
    return { ok: false, reason: "user_hour", retryAfterSec: 3600 };
  }
  if (boardHits >= PER_BOARD_DAY) {
    return { ok: false, reason: "board_day", retryAfterSec: 86_400 };
  }
  return { ok: true };
}

export async function recordAiHit(userId: string, boardId: string) {
  await prisma.activity.create({
    data: {
      type: "AI_RATE_HIT",
      userId,
      boardId,
      payload: {},
    },
  });
}

export const RATE_LIMITS = { PER_USER_HOUR, PER_BOARD_DAY };
