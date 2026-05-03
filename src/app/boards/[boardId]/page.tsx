import { notFound } from "next/navigation";

import { BoardHeader } from "@/components/board/board-header";
import { BoardDnd } from "@/components/board/board-dnd";
import { CardModalLoader } from "@/components/board/card-modal-loader";
import { requireUser } from "@/lib/auth";
import { NotFoundError, canMutateContent } from "@/lib/auth/permissions";
import { getBoard } from "@/server/board-actions";
import type { ColumnView, LabelView } from "@/components/board/types";

type Props = {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ card?: string }>;
};

export default async function BoardPage({ params, searchParams }: Props) {
  const { boardId } = await params;
  const { card: openCardId } = await searchParams;
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

  // Маппим в чистый сериализуемый вид (Date оставляем — RSC сериализует)
  const columns: ColumnView[] = board.columns.map((c) => ({
    id: c.id,
    title: c.title,
    position: c.position,
    cards: c.cards.map((card) => ({
      id: card.id,
      title: card.title,
      description: card.description,
      position: card.position,
      dueDate: card.dueDate,
      assignee: card.assignee,
      labels: card.labels.map((cl) => cl.label),
    })),
  }));
  const boardLabels: LabelView[] = board.labels;

  return (
    <div className="min-h-dvh flex flex-col">
      <BoardHeader
        user={user}
        board={{ id: board.id, title: board.title }}
        members={board.members}
        labels={boardLabels}
        myRole={role}
        canEdit={role === "OWNER"}
        canMutate={canEdit}
      />

      <main className="flex-1 overflow-x-auto overflow-y-hidden">
        <BoardDnd
          boardId={board.id}
          initialColumns={columns}
          canEdit={canEdit}
        />
      </main>

      <CardModalLoader
        openCardId={openCardId ?? null}
        columns={columns}
        boardLabels={boardLabels}
        canEdit={canEdit}
      />
    </div>
  );
}
