import "server-only";

import { prisma } from "@/lib/db/prisma";

// Типы событий, которые попадают в ленту активности.
// почему перечисляем явно: чтобы клиент мог рендерить каждое событие
// человеческим текстом в одном switch.
export type ActivityType =
  | "CARD_CREATED"
  | "CARD_MOVED"
  | "CARD_RENAMED"
  | "CARD_DUE_SET"
  | "CARD_DUE_REMOVED"
  | "CARD_ARCHIVED"
  | "CARD_DELETED"
  | "CHECKLIST_ITEM_TOGGLED"
  | "COMMENT_CREATED"
  | "MEMBER_JOINED"
  | "AI_ACTION";

type LogParams = {
  boardId: string;
  userId: string;
  cardId?: string | null;
  type: ActivityType;
  payload: Record<string, unknown>;
};

/**
 * Записать событие в ленту активности.
 * Не throw'ит — если упало, просто логируем (главные данные уже сохранены).
 */
export async function logActivity(p: LogParams): Promise<void> {
  try {
    await prisma.activity.create({
      data: {
        boardId: p.boardId,
        userId: p.userId,
        cardId: p.cardId ?? null,
        type: p.type,
        payload: p.payload as object,
      },
    });
  } catch (e) {
    console.warn("[activity]", e);
  }
}
