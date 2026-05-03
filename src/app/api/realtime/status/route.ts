import { NextResponse } from "next/server";

import { isRealtimeConfigured } from "@/lib/realtime/pusher-server";

export const dynamic = "force-dynamic";

// Используется клиентом, чтобы решить — подписываться или нет.
// Без этого пришлось бы пробовать подписку и ловить 503.
export async function GET() {
  return NextResponse.json({
    enabled: isRealtimeConfigured(),
    key: process.env.NEXT_PUBLIC_PUSHER_KEY ?? null,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "eu",
  });
}
