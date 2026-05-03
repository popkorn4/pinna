"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Archive,
  Calendar as CalIcon,
  CheckSquare,
  MessageSquare,
  Trash2,
  X,
} from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
import { CardAssigneeButton } from "@/components/board/card-assignee-button";
import { CardLabelsPopover } from "@/components/board/card-labels-popover";
import { CardHistorySection } from "@/components/board/card-history-section";
import {
  archiveCard,
  deleteCard,
  getCardDetails,
  updateCard,
} from "@/server/card-actions";
import {
  addChecklistItem,
  createChecklist,
  deleteChecklist,
  deleteChecklistItem,
  toggleChecklistItem,
  updateChecklistItem,
} from "@/server/checklist-actions";
import {
  createComment,
  deleteComment,
  updateComment,
} from "@/server/comment-actions";
import type { CardView, LabelView } from "./types";

type Props = {
  open: boolean;
  card: CardView | null;
  columnTitle?: string;
  boardId: string;
  boardLabels: LabelView[];
  canEdit: boolean;
  canReport: boolean;
};

type Details = Awaited<ReturnType<typeof getCardDetails>>;

export function CardModal({
  open,
  card,
  columnTitle,
  boardId,
  boardLabels,
  canEdit,
  canReport,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [details, setDetails] = useState<Details | null>(null);
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(card?.description ?? "");

  // Подтянуть детали (чек-листы, комменты) при открытии
  useEffect(() => {
    if (!card?.id || !open) {
      setDetails(null);
      return;
    }
    let cancelled = false;
    getCardDetails(card.id).then((d) => {
      if (!cancelled) setDetails(d);
    });
    return () => {
      cancelled = true;
    };
  }, [card?.id, open]);

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

  function refreshDetails() {
    if (!card) return;
    getCardDetails(card.id).then(setDetails);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
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

          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-6 mt-2">
            <div className="space-y-6 min-w-0">
              <CardLabelsPopover
                cardId={card.id}
                boardId={boardId}
                cardLabels={card.labels}
                boardLabels={boardLabels}
                canEdit={canEdit}
              />

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

              {details ? (
                <ChecklistsSection
                  cardId={card.id}
                  checklists={details.checklists}
                  canEdit={canEdit}
                  canReport={canReport}
                  onChange={refreshDetails}
                />
              ) : null}

              {details ? (
                <CommentsSection
                  cardId={card.id}
                  comments={details.comments}
                  currentUserId={details.currentUserId}
                  canReport={canReport}
                  onChange={refreshDetails}
                />
              ) : null}

              <CardHistorySection cardId={card.id} boardId={boardId} />
            </div>

            <aside className="space-y-3">
              <CardAssigneeButton
                cardId={card.id}
                boardId={boardId}
                assignee={card.assignee}
                disabled={!canEdit}
              />
              <DueButton
                dueDate={card.dueDate}
                onChange={setDue}
                disabled={!canEdit}
              />
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

// =====================================================================
// Чек-листы
// =====================================================================

type Checklist = Details["checklists"][number];

function ChecklistsSection({
  cardId,
  checklists,
  canEdit,
  canReport,
  onChange,
}: {
  cardId: string;
  checklists: Checklist[];
  canEdit: boolean;
  canReport: boolean;
  onChange: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  function add() {
    const t = title.trim();
    if (!t) {
      setAdding(false);
      return;
    }
    startTransition(async () => {
      const r = await createChecklist(cardId, t);
      if (!r.ok) toast.error(r.error);
      else {
        setTitle("");
        setAdding(false);
        onChange();
        router.refresh();
      }
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <CheckSquare className="size-3" /> Чек-листы
        </h3>
        {canEdit && !adding ? (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            + Добавить чек-лист
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="space-y-2 mb-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") {
                setAdding(false);
                setTitle("");
              }
            }}
            placeholder="Название чек-листа"
            className="w-full bg-background border-b border-ring outline-none px-1 py-1 text-sm"
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={add} disabled={pending}>
              Создать
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setTitle("");
              }}
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {checklists.map((cl) => (
          <ChecklistView
            key={cl.id}
            checklist={cl}
            canEdit={canEdit}
            canReport={canReport}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  );
}

function ChecklistView({
  checklist,
  canEdit,
  canReport,
  onChange,
}: {
  checklist: Checklist;
  canEdit: boolean;
  canReport: boolean;
  onChange: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");

  const total = checklist.items.length;
  const done = checklist.items.filter((i) => i.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function addItem() {
    const t = text.trim();
    if (!t) {
      setAdding(false);
      return;
    }
    startTransition(async () => {
      const r = await addChecklistItem(checklist.id, t);
      if (!r.ok) toast.error(r.error);
      else {
        setText("");
        onChange();
        router.refresh();
      }
    });
  }

  function toggle(itemId: string) {
    startTransition(async () => {
      const r = await toggleChecklistItem(itemId);
      if (!r.ok) toast.error(r.error);
      else {
        onChange();
        router.refresh();
      }
    });
  }

  function removeItem(itemId: string) {
    startTransition(async () => {
      const r = await deleteChecklistItem(itemId);
      if (!r.ok) toast.error(r.error);
      else {
        onChange();
        router.refresh();
      }
    });
  }

  function removeChecklist() {
    startTransition(async () => {
      const r = await deleteChecklist(checklist.id);
      if (!r.ok) toast.error(r.error);
      else {
        onChange();
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="font-display text-base tracking-tight">
          {checklist.title}
        </h4>
        {canEdit ? (
          <button
            type="button"
            disabled={pending}
            onClick={removeChecklist}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            удалить
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        <span className="font-mono">
          {done}/{total}
        </span>
        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono w-8 text-right">{pct}%</span>
      </div>

      <ul className="space-y-1">
        {checklist.items.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-2 group rounded px-1 -mx-1 hover:bg-muted/40"
          >
            <Checkbox
              checked={it.done}
              disabled={!canReport || pending}
              onCheckedChange={() => toggle(it.id)}
            />
            <span
              className={`flex-1 text-sm ${
                it.done ? "line-through text-muted-foreground" : ""
              }`}
            >
              {it.text}
            </span>
            {canEdit ? (
              <button
                type="button"
                onClick={() => removeItem(it.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                aria-label="Удалить пункт"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {canEdit ? (
        <div className="mt-2">
          {adding ? (
            <div className="space-y-2">
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addItem();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setText("");
                  }
                }}
                placeholder="Новый пункт"
                className="w-full bg-background border-b border-ring outline-none px-1 py-1 text-sm"
                disabled={pending}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={addItem} disabled={pending}>
                  Добавить
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAdding(false);
                    setText("");
                  }}
                >
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setAdding(true)}
            >
              + пункт
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// =====================================================================
// Комментарии
// =====================================================================

type Comment = Details["comments"][number];

function CommentsSection({
  cardId,
  comments,
  currentUserId,
  canReport,
  onChange,
}: {
  cardId: string;
  comments: Comment[];
  currentUserId: string;
  canReport: boolean;
  onChange: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");

  function send() {
    const v = body.trim();
    if (!v) return;
    startTransition(async () => {
      const r = await createComment(cardId, v);
      if (!r.ok) toast.error(r.error);
      else {
        setBody("");
        onChange();
        router.refresh();
      }
    });
  }

  return (
    <section>
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
        <MessageSquare className="size-3" /> Комментарии
      </h3>

      {canReport ? (
        <div className="mb-4 space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Markdown поддерживается. Cmd/Ctrl+Enter — отправить."
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            disabled={pending}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={send} disabled={pending || !body.trim()}>
              Отправить
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-3">
        {comments.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            isAuthor={c.authorId === currentUserId}
            onChange={onChange}
          />
        ))}
      </ul>
    </section>
  );
}

function CommentItem({
  comment,
  isAuthor,
  onChange,
}: {
  comment: Comment;
  isAuthor: boolean;
  onChange: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);

  const initials = (comment.author?.name || comment.author?.email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function save() {
    startTransition(async () => {
      const r = await updateComment(comment.id, body);
      if (!r.ok) toast.error(r.error);
      else {
        setEditing(false);
        onChange();
        router.refresh();
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const r = await deleteComment(comment.id);
      if (!r.ok) toast.error(r.error);
      else {
        onChange();
        router.refresh();
      }
    });
  }

  return (
    <li className="flex gap-3">
      <Avatar className="size-7 mt-0.5">
        {comment.author?.image ? (
          <AvatarImage src={comment.author.image} alt="" />
        ) : null}
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-sm font-medium">
            {comment.author?.name || comment.author?.email || "Удалён"}
          </span>
          <span
            className="text-xs text-muted-foreground"
            suppressHydrationWarning
          >
            {formatDistanceToNow(comment.createdAt, {
              addSuffix: true,
              locale: ru,
            })}
          </span>
        </div>
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={pending}>
                Сохранить
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setBody(comment.body);
                }}
              >
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {comment.body}
              </ReactMarkdown>
            </div>
            {isAuthor ? (
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="hover:text-foreground"
                >
                  изменить
                </button>
                <button
                  type="button"
                  onClick={remove}
                  className="hover:text-destructive"
                >
                  удалить
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

// =====================================================================
// Дедлайн
// =====================================================================

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
