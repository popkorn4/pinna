"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Tag, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  createLabel,
  deleteLabel,
  updateLabel,
} from "@/server/label-actions";
import { LABEL_COLORS, labelHex, type LabelColor } from "@/lib/labels";
import type { LabelView } from "./types";
import { ColorSwatch } from "./label-swatch";

type Props = {
  boardId: string;
  labels: LabelView[];
  canMutate: boolean;
};

export function BoardLabelsPopover({ boardId, labels, canMutate }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<LabelView | null>(null);

  function add(color: LabelColor) {
    startTransition(async () => {
      const r = await createLabel(boardId, { color });
      if (!r.ok) toast.error(r.error);
      else router.refresh();
    });
  }

  function rename(labelId: string, name: string) {
    startTransition(async () => {
      const r = await updateLabel(labelId, { name });
      if (!r.ok) toast.error(r.error);
      else router.refresh();
    });
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="default">
            <Tag className="size-4" /> Метки
            <span className="font-mono text-xs text-muted-foreground">
              {labels.length}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Метки доски
          </div>
          {labels.length === 0 ? (
            <p className="text-xs text-muted-foreground italic mb-3">
              Меток пока нет.
            </p>
          ) : (
            <ul className="space-y-1.5 mb-3">
              {labels.map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  <ColorSwatch color={l.color} className="size-4 rounded" />
                  <Input
                    defaultValue={l.name}
                    placeholder="Без названия"
                    disabled={!canMutate || pending}
                    onBlur={(e) => {
                      if (e.target.value !== l.name) {
                        rename(l.id, e.target.value);
                      }
                    }}
                    className="h-7 text-sm"
                  />
                  {canMutate ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      aria-label="Удалить метку"
                      onClick={() => setDeleting(l)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {canMutate ? (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                <Plus className="inline size-3" /> Создать с цветом
              </div>
              <div className="grid grid-cols-9 gap-1.5">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    disabled={pending}
                    onClick={() => add(color)}
                    aria-label={`Создать метку ${color}`}
                    className="size-6 rounded hover:scale-110 transition-transform"
                    style={{ background: labelHex(color) }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить метку?</AlertDialogTitle>
            <AlertDialogDescription>
              Метка пропадёт со всех карточек доски. Действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                if (!deleting) return;
                startTransition(async () => {
                  const r = await deleteLabel(deleting.id);
                  if (!r.ok) toast.error(r.error);
                  else router.refresh();
                  setDeleting(null);
                });
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
