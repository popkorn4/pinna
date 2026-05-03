import "server-only";

import Pusher from "pusher";

import { REALTIME_EVENT, type RealtimeEvent } from "@/lib/realtime/events";

// Singleton — Pusher SDK сам управляет HTTP-пулом.
// Если ENV не задан — клиент = null, и notifyBoard молча скипнет.
// почему так: realtime опционален; если ключа нет — приложение работает,
// просто без межклиентской синхронизации.
let cachedClient: Pusher | null | undefined;

function getClient(): Pusher | null {
  if (cachedClient !== undefined) return cachedClient;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER ?? "eu";

  if (!appId || !key || !secret) {
    cachedClient = null;
    return null;
  }
  cachedClient = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
  return cachedClient;
}

export function isRealtimeConfigured(): boolean {
  return getClient() !== null;
}

export function boardChannel(boardId: string): string {
  // private-* требует авторизации через /api/pusher/auth
  return `private-board-${boardId}`;
}

/**
 * Триггерит realtime-событие на канал доски.
 * Никогда не throw — если Pusher не настроен или сеть упала, мы просто
 * логируем и идём дальше. Realtime — приятный бонус, не должен ломать
 * основные мутации.
 */
export async function notifyBoard(
  boardId: string,
  event: RealtimeEvent = { type: "board:changed" },
): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.trigger(boardChannel(boardId), REALTIME_EVENT, event);
  } catch (e) {
    console.warn("[pusher] trigger failed", e);
  }
}

export function pusherAuthorizeChannel(
  socketId: string,
  channel: string,
): string | null {
  const client = getClient();
  if (!client) return null;
  // authorizeChannel возвращает { auth: string }
  const result = client.authorizeChannel(socketId, channel);
  return JSON.stringify(result);
}
