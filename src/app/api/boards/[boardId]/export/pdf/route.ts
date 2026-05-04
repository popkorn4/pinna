import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { assertBoardAccess } from "@/lib/auth/permissions";
import { fetchBoardForExport } from "@/lib/export/data";
import { generateBoardPdf } from "@/lib/export/pdf";

// PDF — бинарь, не помещается в server action как строка → отдельный
// API route. Авторизация через ту же requireUser + assertBoardAccess.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  const user = await requireUser();
  await assertBoardAccess(user.id, boardId);
  const board = await fetchBoardForExport(boardId);
  if (!board) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const pdf = await generateBoardPdf(board);
  // pdfkit отдаёт Node Buffer; в Web Response передаём как Uint8Array
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="board.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
