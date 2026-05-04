"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type DragOverEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

// Колонки и карточки используют общую стратегию "ничего не делать":
// соседи стоят на месте, перетаскиваемый элемент показывает DragOverlay,
// конечная позиция определяется на drop. Без неё дёргается на больших
// списках и при rapid-drag.
const noopSortingStrategy = () => null;
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
  const [activeColumn, setActiveColumn] = useState<ColumnView | null>(null);
  const [pending, startTransition] = useTransition();
  // почему mounted: dnd-kit генерирует aria-describedby="DndDescribedBy-N",
  // где N — глобальный счётчик. На сервере и клиенте N может расходиться,
  // что выдаёт hydration mismatch. Рендерим DnD только после mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
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

  // Кастомный collision-детектор:
  // — Для карточки: сначала ищем другую карточку под курсором (pointerWithin
  //   среди карточек). Если нет — берём колонку, чтобы дроп в пустую часть
  //   срабатывал в "конец колонки".
  // — Для колонки: только колонки.
  // почему: с дефолтным closestCorners колонка-контейнер часто "перебивает"
  // карточку как ближайшая цель, и карточка прилетает в конец колонки.
  const collisionDetection: CollisionDetection = (args) => {
    const activeType = (args.active.data.current as { type?: string } | undefined)
      ?.type;

    if (activeType === "card") {
      // ВАЖНО: исключаем саму активную карточку из кандидатов,
      // иначе closestCenter всегда вернёт её (она прямо под overlay)
      const cardContainers = args.droppableContainers.filter(
        (c) =>
          (c.data.current as { type?: string } | undefined)?.type === "card" &&
          c.id !== args.active.id,
      );
      const columnContainers = args.droppableContainers.filter(
        (c) =>
          (c.data.current as { type?: string } | undefined)?.type === "column",
      );

      // 1) Курсор точно над карточкой?
      const cardHits = pointerWithin({
        ...args,
        droppableContainers: cardContainers,
      });
      if (cardHits.length > 0) return cardHits;

      // 2) Курсор над колонкой? Если в этой колонке есть карточки,
      //    выбираем ближайшую карточку В ЭТОЙ колонке (а не во всём boards).
      const colHits = pointerWithin({
        ...args,
        droppableContainers: columnContainers,
      });
      if (colHits.length > 0) {
        const overColId = colHits[0].id;
        const cardsInThisCol = cardContainers.filter((c) => {
          const data = c.data.current as
            | { type: "card"; card: { id: string } }
            | undefined;
          // ColumnContainer имеет id колонки; карточки этой колонки находим по
          // sortableContainerId (родительский SortableContext id = column id)
          const sortable = (c.data.current as { sortable?: { containerId?: string } })
            ?.sortable;
          return sortable?.containerId === overColId || data?.card?.id === overColId;
        });
        if (cardsInThisCol.length > 0) {
          const closest = closestCenter({
            ...args,
            droppableContainers: cardsInThisCol,
          });
          if (closest.length > 0) return closest;
        }
        return colHits; // пустая колонка — дроп в конец
      }

      // 3) Фоллбек — ближайшая карточка по дистанции от центра
      const closest = closestCenter({
        ...args,
        droppableContainers: cardContainers,
      });
      if (closest.length > 0) return closest;

      // 4) Совсем фоллбек — колонки
      return rectIntersection({
        ...args,
        droppableContainers: columnContainers,
      });
    }

    if (activeType === "column") {
      const columnContainers = args.droppableContainers.filter(
        (c) =>
          (c.data.current as { type?: string } | undefined)?.type === "column" &&
          c.id !== args.active.id,
      );
      return closestCenter({ ...args, droppableContainers: columnContainers });
    }

    return closestCenter(args);
  };

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
      | { type: "column"; columnId: string }
      | undefined;
    if (data?.type === "card") {
      setActiveCard(data.card);
      const info = findCard(e.active.id as string);
      dragOriginColumnRef.current = info?.columnId ?? null;
    } else if (data?.type === "column") {
      const col = findColumn(data.columnId);
      if (col) setActiveColumn(col);
    }
  }

  // почему onDragOver сейчас пуст:
  // оптимистическая перестановка между колонок до drop'а ломала плавность —
  // карточки расступались слишком рано, а после server move + router.refresh
  // случался "прыжок". DragOverlay сам показывает плывущую карточку, а
  // соседи в исходной колонке остаются на месте до фактического дропа.
  // Intra-column reordering обрабатывается автоматически через
  // verticalListSortingStrategy в SortableContext колонки.
  function onDragOver(_e: DragOverEvent) {
    return;
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    setActiveColumn(null);
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

      const next = arrayMove(columns, oldIdx, newIdx);
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

    // Если перемещение внутри той же колонки —
    // arrayMove даёт корректный целевой индекс с учётом удаления исходного.
    if (originColumnId === toColumnId && overCardId) {
      const oldIdx = toCol.cards.findIndex((c) => c.id === active.id);
      const newIdx = toCol.cards.findIndex((c) => c.id === overCardId);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
      const reordered = arrayMove(toCol.cards, oldIdx, newIdx);

      // Оптимистично применяем — sortable плавно расставит соседей
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
      // По положению центра активного бокса относительно центра over —
      // выбираем "над" или "под" целевой карточкой
      const activeRect = active.rect.current.translated ?? active.rect.current.initial;
      const overRect = over.rect;
      const above =
        activeRect && overRect
          ? activeRect.top + activeRect.height / 2 <
            overRect.top + overRect.height / 2
          : true;
      if (above) beforeCardId = over.id as string;
      else afterCardId = over.id as string;
    } else {
      // дропнули в пустую часть колонки — в конец
      toEnd = true;
    }

    // Оптимистично перемещаем карточку в целевую колонку, чтобы UI
    // отреагировал мгновенно. Сервер вернёт точную позицию — useEffect
    // подхватит её при следующем рендере.
    const cardObj = fromInfo.card;
    setColumns((prev) => {
      const next = prev.map((c) => ({ ...c, cards: [...c.cards] }));
      const fromCol = next.find((c) => c.id === fromInfo.columnId);
      const toColLocal = next.find((c) => c.id === toColumnId);
      if (!fromCol || !toColLocal) return prev;
      const idx = fromCol.cards.findIndex((c) => c.id === active.id);
      if (idx === -1) return prev;
      fromCol.cards.splice(idx, 1);
      let insertAt: number;
      if (beforeCardId) {
        insertAt = toColLocal.cards.findIndex((c) => c.id === beforeCardId);
        if (insertAt === -1) insertAt = toColLocal.cards.length;
      } else if (afterCardId) {
        const after = toColLocal.cards.findIndex((c) => c.id === afterCardId);
        insertAt = after === -1 ? toColLocal.cards.length : after + 1;
      } else {
        insertAt = toColLocal.cards.length;
      }
      toColLocal.cards.splice(insertAt, 0, cardObj);
      return next;
    });

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

  // SSR-фоллбек: те же колонки, без DnD-обёртки. Идентичная разметка
  // важна для гидратации SortableContext-детей.
  if (!mounted) {
    return (
      <div className="px-4 md:px-8 py-6 flex flex-col lg:flex-row lg:items-stretch gap-4 lg:h-full min-h-[60vh]">
        {columns.map((col) => (
          <section
            key={col.id}
            className="w-full lg:w-80 shrink-0 rounded-lg border border-border/60 bg-card h-32 lg:h-auto"
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveCard(null);
        setActiveColumn(null);
      }}
    >
      <SortableContext
        items={columns.map((c) => c.id)}
        strategy={noopSortingStrategy}
      >
        <div className="px-4 md:px-8 py-6 flex flex-col lg:flex-row lg:items-stretch gap-4 lg:h-full min-h-[60vh]">
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
        ) : activeColumn ? (
          <div className="w-80 rotate-1 shadow-2xl">
            <div className="rounded-lg border border-border bg-card/80 backdrop-blur p-3">
              <div className="font-display text-lg tracking-tight truncate">
                {activeColumn.title}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {activeColumn.cards.length} карточек
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
