"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { labelHex } from "@/lib/labels";
import { updateCard } from "@/server/card-actions";
import type { listCalendarCards } from "@/server/calendar-actions";

type Card = Awaited<ReturnType<typeof listCalendarCards>>[number];

type Props = {
  boardId: string;
  cards: Card[];
  monthParam?: string;
  canEdit: boolean;
};

const TODAY_KEY = "today";

export function CalendarView({ boardId, cards, monthParam, canEdit }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Текущий месяц — из URL ?m=YYYY-MM или сегодняшний
  const cursor = useMemo(() => {
    if (monthParam) {
      const d = parse(monthParam, "yyyy-MM", new Date());
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date();
  }, [monthParam]);

  function goMonth(offset: number) {
    const next = addMonths(cursor, offset);
    const url = new URL(window.location.href);
    url.searchParams.set("m", format(next, "yyyy-MM"));
    router.push(`${pathname}?${url.searchParams}`, { scroll: false });
  }

  function goToday() {
    const url = new URL(window.location.href);
    url.searchParams.delete("m");
    router.push(
      url.search ? `${pathname}?${url.searchParams}` : pathname,
      { scroll: false },
    );
  }

  // Сетка месяца с захватом краевых недель
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1, locale: ru });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1, locale: ru });

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addMonths(d, 0)) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  // Группировка карточек по дням
  const cardsByDay = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const c of cards) {
      if (!c.dueDate) continue;
      const key = format(c.dueDate, "yyyy-MM-dd");
      const list = map.get(key);
      if (list) list.push(c);
      else map.set(key, [c]);
    }
    return map;
  }, [cards]);

  function openCard(cardId: string) {
    const params = new URLSearchParams(searchParams);
    params.set("card", cardId);
    router.push(`${pathname}?${params}`, { scroll: false });
  }

  // Drag&drop карточки на другой день
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  function onDrop(day: Date) {
    if (!dragId) return;
    setDragId(null);
    setDragOverKey(null);
    const card = cards.find((c) => c.id === dragId);
    if (!card) return;
    if (card.dueDate && isSameDay(card.dueDate, day)) return;
    startTransition(async () => {
      const r = await updateCard(card.id, {
        dueDate: day.toISOString(),
      });
      if (!r.ok) toast.error(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => goMonth(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="font-display text-xl tracking-tight min-w-[10ch]">
            {format(cursor, "LLLL yyyy", { locale: ru })}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => goMonth(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>
          Сегодня
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border/60 border border-border/60 rounded-lg overflow-hidden">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <div
            key={d}
            className="bg-card/40 px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayCards = cardsByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const isOver = dragOverKey === key;
          return (
            <div
              key={day.toISOString()}
              onDragOver={(e) => {
                if (!canEdit || !dragId) return;
                e.preventDefault();
                setDragOverKey(key);
              }}
              onDragLeave={() => setDragOverKey(null)}
              onDrop={() => onDrop(day)}
              className={cn(
                "bg-card min-h-28 p-1.5 flex flex-col gap-1 transition-colors",
                !inMonth && "bg-muted/20 opacity-60",
                isOver && "bg-brand/15",
              )}
            >
              <div className="flex items-center justify-between text-xs">
                <span
                  className={cn(
                    "font-mono",
                    isToday(day)
                      ? "bg-brand text-brand-foreground rounded px-1.5"
                      : "text-muted-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
                {dayCards.length > 0 ? (
                  <span className="text-[10px] text-muted-foreground">
                    {dayCards.length}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-1 overflow-hidden">
                {dayCards.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    draggable={canEdit}
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => openCard(c.id)}
                    disabled={pending}
                    className={cn(
                      "text-left text-xs rounded px-1.5 py-1 border border-border/60 bg-background hover:border-border transition-colors truncate flex items-center gap-1.5",
                      dragId === c.id && "opacity-40",
                    )}
                    title={`${c.title} (${c.column.title})`}
                  >
                    {c.labels[0] ? (
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{
                          background: labelHex(c.labels[0].label.color),
                        }}
                      />
                    ) : null}
                    <span className="truncate">{c.title}</span>
                  </button>
                ))}
                {dayCards.length > 4 ? (
                  <span className="text-[10px] text-muted-foreground px-1">
                    +{dayCards.length - 4} ещё
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-6">
          Нет карточек с дедлайнами. Добавьте дедлайн в карточке —
          она появится в календаре.
        </p>
      ) : null}
    </div>
  );
}
