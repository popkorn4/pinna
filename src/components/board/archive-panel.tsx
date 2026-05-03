"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  deleteCard,
  listArchivedCards,
  unarchiveCard,
} from "@/server/card-actions";

type Row = Awaited<ReturnType<typeof listArchivedCards>>[number];

type Props = {
  boardId: string;
  canEdit: boolean;
};

export function ArchivePanel({ boardId, canEdit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Row[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    listArchivedCards(boardId).then(setItems);
  }, [open, boardId]);

  function refresh() {
    listArchivedCards(boardId).then(setItems);
    router.refresh();
  }

  function restore(id: string) {
    startTransition(async () => {
      const r = await unarchiveCard(id);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Карточка восстановлена");
        refresh();
      }
    });
  }

  function purge(id: string) {
    startTransition(async () => {
      const r = await deleteCard(id);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Удалено навсегда");
        setConfirmDeleteId(null);
        refresh();
      }
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="default">
            <Archive className="size-4" /> Архив
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md flex flex-col p-0 gap-0"
        >
          <SheetHeader className="px-4 py-3 border-b border-border/60">
            <SheetTitle className="font-display text-xl tracking-tight">
              Архив карточек
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {items === null ? (
              <p className="text-sm text-muted-foreground">Загрузка…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                В архиве пусто.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {items.map((c) => (
                  <li key={c.id} className="py-3 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm leading-snug">
                        {c.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        из «{c.column.title}» ·{" "}
                        {c.archivedAt
                          ? format(c.archivedAt, "d MMM yyyy", { locale: ru })
                          : ""}
                      </div>
                    </div>
                    {canEdit ? (
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => restore(c.id)}
                          aria-label="Восстановить"
                        >
                          <RotateCcw className="size-3.5" />
                          <span className="text-xs">Вернуть</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => setConfirmDeleteId(c.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                          <span className="text-xs">Удалить</span>
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить навсегда?</AlertDialogTitle>
            <AlertDialogDescription>
              Карточка с чек-листами и комментариями исчезнет навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteId && purge(confirmDeleteId)}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
