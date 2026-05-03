"use client";

import { useSortable } from "@dnd-kit/sortable";

import { CardPreview } from "./card-preview";
import type { CardView } from "./types";

type Props = {
  card: CardView;
  disabled?: boolean;
};

export function SortableCard({ card, disabled }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", card },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      // Вся карточка — drag-handle. Клик при отсутствии drag всё равно
      // долетает до CardPreview (PointerSensor с distance=5 их различает).
    >
      <CardPreview card={card} isDragging={isDragging} />
    </div>
  );
}
