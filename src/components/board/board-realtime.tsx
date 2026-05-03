"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type Pusher from "pusher-js";

import { REALTIME_EVENT, type RealtimeEvent } from "@/lib/realtime/events";

type Props = {
  boardId: string;
};

/**
 * Подписывает текущую вкладку на realtime-канал доски.
 * При получении события «board:changed» — вызывает router.refresh(),
 * чтобы RSC перезапросил getBoard и подменил props у BoardDnd
 * (а тот уже умеет синхронизировать локальный state).
 *
 * Если Pusher не настроен — компонент молча ничего не делает.
 * Если две вкладки одного юзера — обе обновятся.
 */
export function BoardRealtime({ boardId }: Props) {
  const router = useRouter();
  // Ленивая инициализация: pusher-js — клиентский, импортируем динамически.
  const pusherRef = useRef<Pusher | null>(null);
  // Дебаунс — два события подряд не запускают два refresh'а.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const status = await fetch("/api/realtime/status").then((r) => r.json());
      if (cancelled || !status.enabled || !status.key) return;

      const PusherClient = (await import("pusher-js")).default;
      const pusher = new PusherClient(status.key, {
        cluster: status.cluster,
        authEndpoint: "/api/pusher/auth",
        forceTLS: true,
      });
      pusherRef.current = pusher;

      const channelName = `private-board-${boardId}`;
      const channel = pusher.subscribe(channelName);
      channel.bind(REALTIME_EVENT, (data: RealtimeEvent) => {
        if (data.type === "board:changed") {
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = setTimeout(() => {
            router.refresh();
            refreshTimerRef.current = null;
          }, 150);
        }
      });

      cleanup = () => {
        channel.unbind_all();
        pusher.unsubscribe(channelName);
        pusher.disconnect();
      };
    })();

    return () => {
      cancelled = true;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      cleanup?.();
    };
  }, [boardId, router]);

  return null;
}
