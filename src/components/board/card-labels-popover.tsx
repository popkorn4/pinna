"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Tag, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ColorSwatch } from "./label-swatch";
import {
  addLabelToCard,
  createLabel,
  removeLabelFromCard,
} from "@/server/label-actions";
import { LABEL_COLORS, labelHex, type LabelColor } from "@/lib/labels";
import type { LabelView } from "./types";

type Props = {
  cardId: string;
  boardId: string;
  cardLabels: LabelView[];
  boardLabels: LabelView[];
  canEdit: boolean;
};

export function CardLabelsPopover({
  cardId,
  boardId,
  cardLabels,
  boardLabels,
  canEdit,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const cardLabelIds = new Set(cardLabels.map((l) => l.id));

  function toggle(label: LabelView) {
    startTransition(async () => {
      const r = cardLabelIds.has(label.id)
        ? await removeLabelFromCard(cardId, label.id)
        : await addLabelToCard(cardId, label.id);
      if (!r.ok) toast.error(r.error);
      else router.refresh();
    });
  }

  function quickCreate(color: LabelColor) {
    startTransition(async () => {
      const r = await createLabel(boardId, { color });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const r2 = await addLabelToCard(cardId, r.data.id);
      if (!r2.ok) toast.error(r2.error);
      else router.refresh();
      setCreating(false);
    });
  }

  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
        <Tag className="size-3" /> Метки
      </h3>

      {cardLabels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {cardLabels.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1.5 rounded text-xs px-2 py-0.5 text-white"
              style={{ background: labelHex(l.color) }}
            >
              {l.name || "•"}
            </span>
          ))}
        </div>
      ) : null}

      {canEdit ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Plus className="size-4" /> Изменить метки
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Метки доски
            </div>
            {boardLabels.length === 0 ? (
              <p className="text-xs text-muted-foreground italic mb-3">
                На доске ещё нет меток.
              </p>
            ) : (
              <ul className="space-y-1 mb-3 max-h-60 overflow-y-auto">
                {boardLabels.map((l) => {
                  const checked = cardLabelIds.has(l.id);
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => toggle(l)}
                        className={`w-full flex items-center gap-2 rounded p-1.5 text-left text-sm hover:bg-muted ${
                          checked ? "bg-muted/50" : ""
                        }`}
                      >
                        <ColorSwatch
                          color={l.color}
                          className="size-4 rounded"
                        />
                        <span className="flex-1 truncate">
                          {l.name || (
                            <span className="text-muted-foreground italic">
                              без названия
                            </span>
                          )}
                        </span>
                        {checked ? (
                          <span className="text-xs text-muted-foreground">
                            ✓
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {creating ? (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Выберите цвет
                </div>
                <div className="grid grid-cols-9 gap-1.5">
                  {LABEL_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      disabled={pending}
                      onClick={() => quickCreate(color)}
                      aria-label={`Создать метку ${color}`}
                      className="size-6 rounded hover:scale-110 transition-transform"
                      style={{ background: labelHex(color) }}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setCreating(false)}
                >
                  Отмена
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setCreating(true)}
              >
                <Plus className="size-4" /> Создать новую метку
              </Button>
            )}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
