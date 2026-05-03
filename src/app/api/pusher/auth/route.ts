import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  ForbiddenError,
  NotFoundError,
  assertBoardAccess,
} from "@/lib/auth/permissions";
import {
  isRealtimeConfigured,
  pusherAuthorizeChannel,
} from "@/lib/realtime/pusher-server";

export const runtime = "nodejs";

/**
 * Pusher auth endpoint для приватных каналов.
 * Pusher-клиент сам шлёт сюда socket_id и channel_name (form-encoded).
 * Мы проверяем что канал — board-channel и что юзер имеет к ней доступ,
 * затем возвращаем подпись.
 */
export async function POST(req: Request) {
  if (!isRealtimeConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const form = await req.formData();
  const socketId = String(form.get("socket_id") ?? "");
  const channel = String(form.get("channel_name") ?? "");

  if (!socketId || !channel.startsWith("private-board-")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const boardId = channel.replace(/^private-board-/, "");
  try {
    await assertBoardAccess(user.id, boardId);
  } catch (e) {
    if (e instanceof NotFoundError)
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (e instanceof ForbiddenError)
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const auth = pusherAuthorizeChannel(socketId, channel);
  if (!auth)
    return NextResponse.json({ error: "not_configured" }, { status: 503 });

  return new Response(auth, {
    headers: { "Content-Type": "application/json" },
  });
}
