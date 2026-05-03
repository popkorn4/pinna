import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { runAgent } from "@/lib/ai/agent";
import { assertBoardAccess, NotFoundError, ForbiddenError } from "@/lib/auth/permissions";
import { checkAiRateLimit, recordAiHit } from "@/lib/ai/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  conversationId: z.string().min(1),
  boardId: z.string().min(1),
  message: z.string().trim().min(1).max(8000),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    await assertBoardAccess(user.id, body.boardId);
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const limit = await checkAiRateLimit(user.id, body.boardId);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        reason: limit.reason,
        retry_after_sec: limit.retryAfterSec,
      },
      { status: 429 },
    );
  }
  await recordAiHit(user.id, body.boardId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }
      try {
        for await (const ev of runAgent({
          conversationId: body.conversationId,
          userId: user.id,
          boardId: body.boardId,
          userMessage: body.message,
        })) {
          send(ev.type, ev);
        }
      } catch (e) {
        console.error("[ai/chat]", e);
        send("error", {
          type: "error",
          message: e instanceof Error ? e.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
