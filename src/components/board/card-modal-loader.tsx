"use client";

import { useMemo } from "react";

import { CardModal } from "./card-modal";
import type { ColumnView } from "./types";

type Props = {
  openCardId: string | null;
  columns: ColumnView[];
  canEdit: boolean;
};

export function CardModalLoader({ openCardId, columns, canEdit }: Props) {
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
      canEdit={canEdit}
    />
  );
}
