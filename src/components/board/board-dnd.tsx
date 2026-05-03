"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
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
  const [pending, startTransition] = useTransition();
  // почему храним отдельно: onDragOver мутирует локальное `columns`,
  // и к onDragEnd мы уже не знаем, в какой колонке карточка БЫЛА в БД.
  // Без этого "same column reorder" срабатывает для cross-column drag,
  // и сервер кидает ForbiddenError (карточки нет в целевой колонке).
  const dragOriginColumnRef = useRef<string | null>(null);

  // Синхронизация: когда initialColumns обновился из RSC (после router.refresh),
  // подменяем локальный state — но только если в данный момент нет активного
  // drag и нет pending-действия (иначе перебьём оптимистичную перестановку
  // и карточка "прыгнет" обратно).
  const dragInProgress = activeCard !== null;
  const initialRef = useRef(initialColumns);
  useEffect(() => {
    if (initialRef.current === initialColumns) return;
    initialRef.current = initialColumns;
    if (!dragInProgress && !pending) {
      setColumns(initialColumns);
    }
  }, [initialColumns, dragInProgress, pending]);

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
      const info = findCard(e.active.id as string);
      dragOriginColumnRef.current = info?.columnId ?? null;
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

    const originColumnId = dragOriginColumnRef.current;
    dragOriginColumnRef.current = null;

    // Если перемещение внутри той же колонки (по СОСТОЯНИЮ В БД, не по локальной мутации) —
    // переставляем порядок одним батч-апдейтом.
    if (originColumnId === toColumnId && overCardId) {
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

    // Между колонками — серверный move.
    // почему берём решение прямо из over-события (а не из локально
    // переставленного state): onDragOver мог не успеть отработать перед
    // быстрым drop, и активная карточка ещё лежит в исходной колонке локально.
    let beforeCardId: string | undefined;
    let afterCardId: string | undefined;
    let toEnd: boolean | undefined;

    if (overData?.type === "card" && over.id !== active.id) {
      // дропнули поверх карточки — встаём НАД ней
      beforeCardId = over.id as string;
    } else {
      // дропнули в пустую часть колонки — в конец
      toEnd = true;
    }

    startTransition(async () => {
      const r = await moveCard({
        cardId: active.id as string,
        targetColumnId: toColumnId,
        beforeCardId,
        afterCardId,
        toEnd,
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
        strategy={horizontalListSortingStrategy}
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
