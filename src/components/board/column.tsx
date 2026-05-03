"use client";

import { useTransition } from "react";
import { MoreHorizontal, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

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
import { deleteColumn, updateColumn } from "@/server/board-actions";
import { useState } from "react";

type Props = {
  column: {
    id: string;
    title: string;
    cardsCount: number;
  };
  canEdit: boolean;
};

export function ColumnView({ column, canEdit }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<null | { force: boolean }>(null);

  return (
    <section className="w-80 shrink-0 rounded-lg border border-border/60 bg-card/40 flex flex-col max-h-full">
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
            {column.cardsCount}
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
                  setConfirm({ force: false });
                }}
              >
                <Trash2 className="size-4" /> Удалить колонку
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      <div className="flex-1 px-2 py-2 space-y-2 overflow-y-auto min-h-32">
        <div className="text-xs text-muted-foreground text-center py-6">
          Карточек пока нет
        </div>
      </div>

      {canEdit ? (
        <footer className="p-2 border-t border-border/60">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            disabled
          >
            <Plus className="size-4" /> Карточка
          </Button>
        </footer>
      ) : null}

      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить колонку?</AlertDialogTitle>
            <AlertDialogDescription>
              {column.cardsCount > 0
                ? `В колонке ${column.cardsCount} карточек. Они будут удалены вместе с колонкой.`
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
                    force: column.cardsCount > 0,
                  });
                  if (!r.ok) toast.error(r.error);
                  else toast.success("Колонка удалена");
                  setConfirm(null);
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
