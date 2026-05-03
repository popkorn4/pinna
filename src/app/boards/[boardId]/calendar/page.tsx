import { notFound } from "next/navigation";

import { BoardHeader } from "@/components/board/board-header";
import { CalendarView } from "@/components/board/calendar-view";
import { CardModalLoader } from "@/components/board/card-modal-loader";
import { requireUser } from "@/lib/auth";
import {
  NotFoundError,
  canMutateContent,
  canReportProgress,
} from "@/lib/auth/permissions";
import { getBoard } from "@/server/board-actions";
import { listCalendarCards } from "@/server/calendar-actions";
import type { ColumnView, LabelView } from "@/components/board/types";

type Props = {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ card?: string; m?: string }>;
};

export default async function BoardCalendarPage({ params, searchParams }: Props) {
  const { boardId } = await params;
  const { card: openCardId, m: monthParam } = await searchParams;
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
  const canReport = canReportProgress(role);

  const cards = await listCalendarCards(board.id);

  // Колонки и метки нужны для CardModalLoader
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
        view="calendar"
      />
      <main className="flex-1 px-4 md:px-8 py-6">
        <CalendarView
          boardId={board.id}
          cards={cards}
          monthParam={monthParam}
          canEdit={canEdit}
        />
      </main>
      <CardModalLoader
        openCardId={openCardId ?? null}
        columns={columns}
        boardLabels={boardLabels}
        canEdit={canEdit}
        canReport={canReport}
      />
    </div>
  );
}
