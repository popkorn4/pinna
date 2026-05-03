"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import { AlignLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CardView } from "./types";

type Props = {
  card: CardView;
  isDragging?: boolean;
};

export function CardPreview({ card, isDragging }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function open() {
    const next = new URLSearchParams(params);
    next.set("card", card.id);
    router.push(`${pathname}?${next}`, { scroll: false });
  }

  return (
    <button
      type="button"
      onClick={open}
      data-card-id={card.id}
      className={cn(
        "w-full text-left rounded-md border border-border/60 bg-card p-2.5 hover:border-border transition-colors group",
        isDragging && "opacity-40",
      )}
    >
      <h4 className="font-medium text-sm leading-snug line-clamp-3">
        {card.title}
      </h4>
      {(card.description || card.dueDate) && (
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          {card.description ? (
            <AlignLeft className="size-3.5" aria-label="Есть описание" />
          ) : null}
          {card.dueDate ? <DueBadge dueDate={card.dueDate} /> : null}
        </div>
      )}
    </button>
  );
}

function DueBadge({ dueDate }: { dueDate: Date }) {
  const days = differenceInCalendarDays(dueDate, new Date());
  const tone =
    days < 0
      ? "text-destructive"
      : days <= 1
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";
  return (
    <span className={cn("font-mono", tone)}>
      {format(dueDate, "d MMM", { locale: ru })}
    </span>
  );
}
