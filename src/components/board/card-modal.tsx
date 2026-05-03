"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Archive, Calendar as CalIcon, Trash2 } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { InlineTextEdit } from "@/components/board/inline-text-edit";
import {
  archiveCard,
  deleteCard,
  updateCard,
} from "@/server/card-actions";
import type { CardView } from "./types";

type Props = {
  open: boolean;
  card: CardView | null;
  columnTitle?: string;
  canEdit: boolean;
};

export function CardModal({ open, card, columnTitle, canEdit }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Локальные черновики (description редактируется как textarea с превью)
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(card?.description ?? "");

  useEffect(() => {
    setDesc(card?.description ?? "");
    setEditingDesc(false);
  }, [card?.id, card?.description]);

  function close() {
    const next = new URLSearchParams(params);
    next.delete("card");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  if (!card) return null;

  function commitDesc() {
    if (!card) return;
    startTransition(async () => {
      const r = await updateCard(card.id, { description: desc.trim() || null });
      if (!r.ok) toast.error(r.error);
      setEditingDesc(false);
      router.refresh();
    });
  }

  function setDue(date: Date | undefined) {
    if (!card) return;
    startTransition(async () => {
      const r = await updateCard(card.id, {
        dueDate: date ? date.toISOString() : null,
      });
      if (!r.ok) toast.error(r.error);
      else router.refresh();
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle asChild>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {columnTitle ? `в колонке «${columnTitle}»` : null}
                </p>
                <InlineTextEdit
                  initial={card.title}
                  disabled={!canEdit}
                  ariaLabel="Название карточки"
                  className="font-display text-2xl tracking-tight"
                  inputClassName="font-display text-2xl tracking-tight"
                  onSubmit={async (next) => {
                    const r = await updateCard(card.id, { title: next });
                    if (r.ok) router.refresh();
                    return { ok: r.ok, error: r.ok ? undefined : r.error };
                  }}
                />
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-6 mt-2">
            <div className="space-y-6">
              <section>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Описание
                </h3>
                {editingDesc ? (
                  <div className="space-y-2">
                    <Textarea
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      rows={6}
                      autoFocus
                      placeholder="Поддерживается Markdown (списки, ссылки, код)…"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={commitDesc} disabled={pending}>
                        Сохранить
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDesc(card.description ?? "");
                          setEditingDesc(false);
                        }}
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : card.description ? (
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => canEdit && setEditingDesc(true)}
                    className="w-full text-left rounded p-2 -mx-2 hover:bg-muted/50 prose prose-sm dark:prose-invert max-w-none"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {card.description}
                    </ReactMarkdown>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => canEdit && setEditingDesc(true)}
                    className="w-full text-left rounded p-2 -mx-2 hover:bg-muted/50 text-muted-foreground italic text-sm"
                  >
                    Добавить описание…
                  </button>
                )}
              </section>

              {/* Метки/чек-листы/комментарии — фаза 5 */}
              <section className="text-xs text-muted-foreground italic">
                Метки, чек-листы, комментарии — появятся в следующей фазе.
              </section>
            </div>

            <aside className="space-y-3">
              <DueButton dueDate={card.dueDate} onChange={setDue} disabled={!canEdit} />
              {canEdit ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await archiveCard(card.id);
                        if (!r.ok) toast.error(r.error);
                        else {
                          toast.success("Карточка в архиве");
                          close();
                        }
                      })
                    }
                  >
                    <Archive className="size-4" /> В архив
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="size-4" /> Удалить
                  </Button>
                </>
              ) : null}
            </aside>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить карточку?</AlertDialogTitle>
            <AlertDialogDescription>
              Действие необратимо. Удалятся также чек-листы и комментарии.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteCard(card.id);
                  if (!r.ok) toast.error(r.error);
                  else {
                    toast.success("Удалено");
                    setConfirmDelete(false);
                    close();
                  }
                })
              }
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DueButton({
  dueDate,
  onChange,
  disabled,
}: {
  dueDate: Date | null;
  onChange: (d: Date | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          disabled={disabled}
        >
          <CalIcon className="size-4" />
          {dueDate
            ? format(dueDate, "d MMM yyyy", { locale: ru })
            : "Дедлайн"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-0 w-auto">
        <Calendar
          mode="single"
          selected={dueDate ?? undefined}
          onSelect={onChange}
          initialFocus
          locale={ru}
        />
        {dueDate ? (
          <div className="p-2 border-t border-border">
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => onChange(undefined)}
            >
              Убрать дедлайн
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
