"use client";

import { useTransition, useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

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
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: `col:${column.id}`,
    data: { type: "column", columnId: column.id },
  });

  return (
    <section
      ref={setNodeRef}
      className={`w-80 shrink-0 rounded-lg border bg-card/40 flex flex-col max-h-full transition-colors ${
        isOver ? "border-ring" : "border-border/60"
      }`}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60">
        <div className="min-w-0 flex items-baseline gap-2">
          <InlineTextEdit
            initial={column.title}
            disabled={!canEdit}
            ariaLabel="Название колонки"
            className="font-display text-lg tracking-tight truncate"
            inputClassName="font-display text-lg tracking-tight"
            onSubmit={async (next) => {
              const r = await updateColumn(column.id, { title: next });
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
          strategy={verticalListSortingStrategy}
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
                  else toast.success("Колонка удалена");
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
