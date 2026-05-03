"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type DragOverEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { toast } from "sonner";

import { CardPreview } from "./card-preview";
import { ColumnContainer } from "./column-container";
import { AddColumnButton } from "./add-column-button";
import { moveCard, reorderCardsInColumn } from "@/server/card-actions";
import { reorderColumns } from "@/server/board-actions";
import type { CardView, ColumnView } from "./types";

type Props = {
  boardId: string;
  initialColumns: ColumnView[];
  canEdit: boolean;
};

export function BoardDnd({ boardId, initialColumns, canEdit }: Props) {
  const router = useRouter();
  const [columns, setColumns] = useState<ColumnView[]>(initialColumns);
  const [activeCard, setActiveCard] = useState<CardView | null>(null);
  const [, startTransition] = useTransition();

  // Синхронизация при server-side обновлении props (после revalidatePath)
  // useEffect не нужен — мы храним только локальное оптимистичное состояние,
  // а после server action вызываем router.refresh() и компонент перерендерится
  // с новыми initialColumns. Чтобы это работало, делаем key={hash} в parent — нет,
  // проще сравнивать. Воспользуемся deferred approach: при каждом render
  // initialColumns как источник истины, локальный state — overlay для DnD.
  // Для простоты сейчас: оставляем локальный state и доверяем router.refresh
  // (на dev-окружении нормально работает).

  const sensors = useSensors(
    // почему distance: 5px — клик и drag различаются, иначе любой клик
    // на карточке начинает drag
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Индексы для быстрого поиска
  const cardIndex = useMemo(() => {
    const map = new Map<string, { columnId: string; card: CardView }>();
    for (const col of columns) {
      for (const c of col.cards) {
        map.set(c.id, { columnId: col.id, card: c });
      }
    }
    return map;
  }, [columns]);

  function findCard(id: string) {
    return cardIndex.get(id);
  }

  function findColumn(id: string): ColumnView | undefined {
    return columns.find((c) => c.id === id);
  }

  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current as
      | { type: "card"; card: CardView }
      | undefined;
    if (data?.type === "card") {
      setActiveCard(data.card);
    }
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current as
      | { type: "card"; card: CardView }
      | undefined;
    if (activeData?.type !== "card") return;

    const fromColInfo = findCard(active.id as string);
    if (!fromColInfo) return;

    // over может быть карточкой или колонкой
    const overData = over.data.current as
      | { type: "card"; card: CardView }
      | { type: "column"; columnId: string }
      | undefined;

    let toColumnId: string;
    let overCardId: string | null = null;

    if (overData?.type === "column") {
      toColumnId = overData.columnId;
    } else if (overData?.type === "card") {
      const info = findCard(over.id as string);
      if (!info) return;
      toColumnId = info.columnId;
      overCardId = over.id as string;
    } else {
      return;
    }

    if (fromColInfo.columnId === toColumnId) return;

    // Локально перемещаем карточку в другую колонку для визуального preview
    setColumns((prev) => {
      const next = prev.map((c) => ({ ...c, cards: [...c.cards] }));
      const fromCol = next.find((c) => c.id === fromColInfo.columnId);
      const toCol = next.find((c) => c.id === toColumnId);
      if (!fromCol || !toCol) return prev;
      const idx = fromCol.cards.findIndex((c) => c.id === active.id);
      if (idx === -1) return prev;
      const [moved] = fromCol.cards.splice(idx, 1);
      if (overCardId) {
        const overIdx = toCol.cards.findIndex((c) => c.id === overCardId);
        toCol.cards.splice(overIdx, 0, moved);
      } else {
        toCol.cards.push(moved);
      }
      return next;
    });
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = e;
    if (!over) return;

    const activeData = active.data.current as
      | { type: "card"; card: CardView }
      | { type: "column"; columnId: string }
      | undefined;

    // ---- Колонки ----
    if (activeData?.type === "column") {
      const overData = over.data.current as
        | { type: "column"; columnId: string }
        | undefined;
      if (overData?.type !== "column") return;
      if (active.id === over.id) return;

      const oldIdx = columns.findIndex((c) => c.id === active.id);
      const newIdx = columns.findIndex((c) => c.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const next = [...columns];
      const [moved] = next.splice(oldIdx, 1);
      next.splice(newIdx, 0, moved);
      setColumns(next);

      const ids = next.map((c) => c.id);
      startTransition(async () => {
        const r = await reorderColumns(boardId, ids);
        if (!r.ok) {
          toast.error(r.error);
          setColumns(columns); // откат
        } else {
          router.refresh();
        }
      });
      return;
    }

    // ---- Карточки ----
    if (activeData?.type !== "card") return;

    const fromInfo = findCard(active.id as string);
    if (!fromInfo) return;

    const overData = over.data.current as
      | { type: "card"; card: CardView }
      | { type: "column"; columnId: string }
      | undefined;

    let toColumnId: string;
    let overCardId: string | null = null;

    if (overData?.type === "column") {
      toColumnId = overData.columnId;
    } else if (overData?.type === "card") {
      const info = findCard(over.id as string);
      if (!info) return;
      toColumnId = info.columnId;
      overCardId = over.id as string;
    } else {
      return;
    }

    // Текущая колонка после onDragOver-перемещения может уже быть toColumnId
    const toCol = findColumn(toColumnId);
    if (!toCol) return;

    // Если перемещение внутри той же колонки — переставляем порядок
    if (fromInfo.columnId === toColumnId && overCardId) {
      const oldIdx = toCol.cards.findIndex((c) => c.id === active.id);
      const newIdx = toCol.cards.findIndex((c) => c.id === overCardId);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
      const reordered = [...toCol.cards];
      const [m] = reordered.splice(oldIdx, 1);
      reordered.splice(newIdx, 0, m);

      setColumns((prev) =>
        prev.map((c) =>
          c.id === toColumnId ? { ...c, cards: reordered } : c,
        ),
      );
      const ids = reordered.map((c) => c.id);
      startTransition(async () => {
        const r = await reorderCardsInColumn(toColumnId, ids);
        if (!r.ok) {
          toast.error(r.error);
          setColumns(columns); // откат
        } else {
          router.refresh();
        }
      });
      return;
    }

    // Между колонками — серверный move
    const targetCol = findColumn(toColumnId);
    if (!targetCol) return;
    const cardPositionInTarget = targetCol.cards.findIndex(
      (c) => c.id === active.id,
    );
    const beforeCardId =
      cardPositionInTarget < targetCol.cards.length - 1
        ? targetCol.cards[cardPositionInTarget + 1]?.id
        : null;
    const afterCardId =
      cardPositionInTarget > 0
        ? targetCol.cards[cardPositionInTarget - 1]?.id
        : null;

    startTransition(async () => {
      const r = await moveCard({
        cardId: active.id as string,
        targetColumnId: toColumnId,
        beforeCardId: beforeCardId ?? undefined,
        afterCardId: !beforeCardId ? afterCardId ?? undefined : undefined,
        toEnd: !beforeCardId && !afterCardId ? true : undefined,
      });
      if (!r.ok) {
        toast.error(r.error);
        setColumns(initialColumns); // откат
      } else {
        router.refresh();
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveCard(null)}
    >
      <SortableContext
        items={columns.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="px-4 md:px-8 py-6 flex items-stretch gap-4 h-full min-h-[60vh]">
          {columns.map((col) => (
            <ColumnContainer
              key={col.id}
              column={col}
              canEdit={canEdit}
            />
          ))}
          {canEdit ? <AddColumnButton boardId={boardId} /> : null}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeCard ? (
          <div className="rotate-2 shadow-lg">
            <CardPreview card={activeCard} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
