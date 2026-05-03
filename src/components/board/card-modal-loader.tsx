"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";

import { CardModal } from "./card-modal";
import type { ColumnView, LabelView } from "./types";

type Props = {
  openCardId: string | null;
  columns: ColumnView[];
  boardLabels: LabelView[];
  canEdit: boolean;
};

export function CardModalLoader({
  openCardId,
  columns,
  boardLabels,
  canEdit,
}: Props) {
  const params = useParams<{ boardId: string }>();
  const boardId = params.boardId ?? "";

  const found = useMemo(() => {
    if (!openCardId) return null;
    for (const col of columns) {
      const card = col.cards.find((c) => c.id === openCardId);
      if (card) return { card, columnTitle: col.title };
    }
    return null;
  }, [openCardId, columns]);

  return (
    <CardModal
      open={!!found}
      card={found?.card ?? null}
      columnTitle={found?.columnTitle}
      boardId={boardId}
      boardLabels={boardLabels}
      canEdit={canEdit}
    />
  );
}
