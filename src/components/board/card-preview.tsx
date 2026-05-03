"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import { AlignLeft } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { labelHex } from "@/lib/labels";
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
        "relative w-full text-left rounded-md border border-border/60 bg-card overflow-hidden hover:border-border transition-colors group",
        isDragging && "opacity-40",
      )}
    >
      {/* Полосы меток слева — каждая занимает равную долю по высоте.
          почему так: метки видны как «корешок» карточки, не съедают
          вертикальное место сверху и читаются с любого расстояния. */}
      {card.labels.length > 0 ? (
        <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
          {card.labels.map((l) => (
            <span
              key={l.id}
              className="flex-1"
              style={{ background: labelHex(l.color) }}
              title={l.name || undefined}
            />
          ))}
        </div>
      ) : null}
      <div
        className={cn(
          "p-2.5",
          card.labels.length > 0 && "pl-3",
        )}
      >
        <h4 className="font-medium text-sm leading-snug line-clamp-3">
          {card.title}
        </h4>
        {(card.description || card.dueDate || card.assignee) && (
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {card.description ? (
              <AlignLeft className="size-3.5" aria-label="Есть описание" />
            ) : null}
            {card.dueDate ? <DueBadge dueDate={card.dueDate} /> : null}
            {card.assignee ? (
              <Avatar
                className="size-5 ml-auto"
                title={card.assignee.name || card.assignee.email}
              >
                {card.assignee.image ? (
                  <AvatarImage src={card.assignee.image} alt="" />
                ) : null}
                <AvatarFallback className="text-[8px]">
                  {(card.assignee.name || card.assignee.email)
                    .slice(0, 1)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : null}
          </div>
        )}
      </div>
    </button>
  );
}

function DueBadge({ dueDate }: { dueDate: Date }) {
  // почему suppressHydrationWarning: tone зависит от Date.now() — отличается
  // между SSR и клиентом, если день/час сменился. Цвет — несущественная
  // подсказка, лучше hydration-mismatch не блокировать.
  const days = differenceInCalendarDays(dueDate, new Date());
  const tone =
    days < 0
      ? "text-destructive"
      : days <= 1
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";
  return (
    <span className={cn("font-mono", tone)} suppressHydrationWarning>
      {format(dueDate, "d MMM", { locale: ru })}
    </span>
  );
}
