import { notFound } from "next/navigation";

import { BoardHeader } from "@/components/board/board-header";
import { ColumnView } from "@/components/board/column";
import { AddColumnButton } from "@/components/board/add-column-button";
import { requireUser } from "@/lib/auth";
import { NotFoundError, canMutateContent } from "@/lib/auth/permissions";
import { getBoard } from "@/server/board-actions";

type Props = {
  params: Promise<{ boardId: string }>;
};

export default async function BoardPage({ params }: Props) {
  const { boardId } = await params;
  const user = await requireUser();

  let data;
  try {
    data = await getBoard(boardId);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  const { board, role } = data;
  const canEdit = canMutateContent(role);

  return (
    <div className="min-h-dvh flex flex-col">
      <BoardHeader
        user={user}
        board={{ id: board.id, title: board.title }}
        members={board.members}
        canEdit={role === "OWNER"}
      />

      <main className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="px-4 md:px-8 py-6 flex items-stretch gap-4 h-full min-h-[60vh]">
          {board.columns.map((col) => (
            <ColumnView
              key={col.id}
              column={{
                id: col.id,
                title: col.title,
                cardsCount: col._count.cards,
              }}
              canEdit={canEdit}
            />
          ))}
          {canEdit ? <AddColumnButton boardId={board.id} /> : null}
        </div>
      </main>
    </div>
  );
}
