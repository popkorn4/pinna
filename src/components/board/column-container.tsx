"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext } from "@dnd-kit/sortable";

// Стратегия "ничего не делать": соседи не расступаются во время drag.
// Карточка-overlay сама показывает, куда летит, а место вставки определяется
// курсором при дропе (см. board-dnd.tsx onDragEnd: верх/низ половина).
// почему: дефолтная verticalListSortingStrategy создавала ощущение "прыжков
// через несколько позиций" из-за непрерывной переоценки displacement'а.
const noopSortingStrategy = () => null;

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineTextEdit } from "@/components/board/inline-text-edit";
import { AddCardComposer } from "@/components/board/add-card-composer";
import { SortableCard } from "@/components/board/sortable-card";
import { deleteColumn, updateColumn } from "@/server/board-actions";
import type { ColumnView } from "./types";

type Props = {
  column: ColumnView;
  canEdit: boolean;
};

export function ColumnContainer({ column, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  // useSortable заодно даёт droppable для drag карточек поверх колонки.
  // type=column в data — чтобы BoardDnd различал перенос колонок и карточек.
  const { setNodeRef, attributes, listeners, isDragging, isOver } = useSortable({
    id: column.id,
    data: { type: "column", columnId: column.id },
    disabled: !canEdit,
  });

  return (
    <section
      ref={setNodeRef}
      className={`w-full lg:w-80 shrink-0 rounded-lg border bg-card flex flex-col max-h-full transition-colors duration-200 ${
        isOver ? "border-ring" : "border-border/60"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60">
        <div className="min-w-0 flex items-baseline gap-2">
          {canEdit ? (
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label="Перетащить колонку"
              className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing -ml-1"
            >
              <GripVertical className="size-4" />
            </button>
          ) : null}
          <InlineTextEdit
            initial={column.title}
            disabled={!canEdit}
            ariaLabel="Название колонки"
            className="font-display text-lg tracking-tight truncate"
            inputClassName="font-display text-lg tracking-tight"
            onSubmit={async (next) => {
              const r = await updateColumn(column.id, { title: next });
              if (r.ok) router.refresh();
              return { ok: r.ok, error: r.ok ? undefined : r.error };
            }}
          />
          <span className="text-xs text-muted-foreground font-mono shrink-0">
            {column.cards.length}
          </span>
        </div>
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 -mr-1"
                aria-label="Действия с колонкой"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirm(true);
                }}
              >
                <Trash2 className="size-4" /> Удалить колонку
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      <div className="flex-1 px-2 py-2 space-y-2 overflow-y-auto min-h-32">
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={noopSortingStrategy}
        >
          {column.cards.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6">
              Пусто
            </div>
          ) : (
            column.cards.map((card) => (
              <SortableCard key={card.id} card={card} disabled={!canEdit} />
            ))
          )}
        </SortableContext>
      </div>

      {canEdit ? (
        <footer className="p-2 border-t border-border/60">
          <AddCardComposer columnId={column.id} />
        </footer>
      ) : null}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить колонку?</AlertDialogTitle>
            <AlertDialogDescription>
              {column.cards.length > 0
                ? `В колонке ${column.cards.length} карточек. Они будут удалены вместе с колонкой.`
                : "Колонка пуста. Удалить?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteColumn(column.id, {
                    force: column.cards.length > 0,
                  });
                  if (!r.ok) toast.error(r.error);
                  else {
                    toast.success("Колонка удалена");
                    router.refresh();
                  }
                  setConfirm(false);
                })
              }
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
