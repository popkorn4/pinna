"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { renderActivity } from "@/components/board/activity-render";
import { listCardActivity } from "@/server/activity-actions";
import { userTextColor } from "@/lib/user-color";

type Row = Awaited<ReturnType<typeof listCardActivity>>[number];

type Props = {
  cardId: string;
  boardId: string;
};

export function CardHistorySection({ cardId, boardId }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const theme: "light" | "dark" = !mounted
    ? "light"
    : resolvedTheme === "dark"
      ? "dark"
      : "light";

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!open || items) return;
    listCardActivity(cardId).then(setItems);
  }, [open, cardId, items]);

  // Сбрасывать кеш при смене карточки
  useEffect(() => {
    setItems(null);
  }, [cardId]);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center gap-2 mb-2"
      >
        {open ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
        <Clock className="size-3" /> История изменений
        {items ? (
          <span className="font-mono text-foreground">{items.length}</span>
        ) : null}
      </button>

      {open ? (
        items === null ? (
          <p className="text-xs text-muted-foreground italic pl-5">
            Загрузка…
          </p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic pl-5">
            Изменений не было.
          </p>
        ) : (
          <ul className="space-y-2 pl-5">
            {items.map((row) => {
              const name =
                row.user?.name || row.user?.email || "Кто-то";
              const initials = name
                .split(/\s+/)
                .map((s) => s[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              const color = row.user
                ? userTextColor(row.user.id, boardId, theme)
                : undefined;
              return (
                <li key={row.id} className="flex gap-2 text-sm">
                  <Avatar className="size-5 mt-0.5 shrink-0">
                    {row.user?.image ? (
                      <AvatarImage src={row.user.image} alt="" />
                    ) : null}
                    <AvatarFallback
                      className="text-[8px]"
                      style={
                        color
                          ? { background: color, color: "#fff" }
                          : undefined
                      }
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="leading-snug">
                      <span
                        className="font-medium"
                        style={color ? { color } : undefined}
                      >
                        {name}
                      </span>{" "}
                      {renderActivity(row)}
                    </div>
                    <div
                      className="text-xs text-muted-foreground"
                      title={format(row.createdAt, "d MMM yyyy HH:mm", {
                        locale: ru,
                      })}
                      suppressHydrationWarning
                    >
                      {formatDistanceToNow(row.createdAt, {
                        addSuffix: true,
                        locale: ru,
                      })}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </section>
  );
}
