import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Возвращает наличие ключа — используется AiPanel'ю чтобы решить,
// показать сразу баннер «вставь ключ» или попробовать запрос.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  return NextResponse.json({
    has_key: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7",
  });
}
