import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Healthcheck для мониторинга. Возвращает:
 *  - status ok если БД достижима
 *  - версию сборки (из git sha если задана через ENV)
 *  - какие интеграции включены (без секретов)
 */
export async function GET() {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return NextResponse.json(
    {
      status: dbOk ? "ok" : "degraded",
      db: dbOk,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
      integrations: {
        ai: Boolean(process.env.ANTHROPIC_API_KEY),
        realtime: Boolean(process.env.PUSHER_APP_ID),
        email: Boolean(process.env.RESEND_API_KEY),
      },
      time: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 },
  );
}
