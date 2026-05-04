import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { assertBoardAccess } from "@/lib/auth/permissions";
import { fetchBoardForExport } from "@/lib/export/data";
import { generateBoardXlsx } from "@/lib/export/xlsx";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  const user = await requireUser();
  await assertBoardAccess(user.id, boardId);
  const board = await fetchBoardForExport(boardId);
  if (!board) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const xlsx = await generateBoardXlsx(board);
  return new Response(new Uint8Array(xlsx), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="board.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
