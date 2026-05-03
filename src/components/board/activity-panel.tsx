"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Activity as ActivityIcon, Filter } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { userTextColor } from "@/lib/user-color";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { listBoardActivity } from "@/server/activity-actions";
import { renderActivity } from "@/components/board/activity-render";

type ActivityRow = Awaited<ReturnType<typeof listBoardActivity>>[number];

type Member = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

type Props = {
  boardId: string;
  members: Member[];
};

export function ActivityPanel({ boardId, members }: Props) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // почему mounted: SSR не знает реальную тему, без mounted проскакивают цвета
  // первого фрейма и React ругается на mismatch
  const theme: "light" | "dark" = !mounted
    ? "light"
    : resolvedTheme === "dark"
      ? "dark"
      : "light";
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityRow[] | null>(null);
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listBoardActivity(boardId, filterUserId === "all" ? undefined : filterUserId)
      .then((rows) => setItems(rows))
      .finally(() => setLoading(false));
  }, [open, boardId, filterUserId]);

  // Группируем по дням для шапок
  const grouped = (items ?? []).reduce<Record<string, ActivityRow[]>>(
    (acc, row) => {
      const day = format(row.createdAt, "yyyy-MM-dd");
      (acc[day] ??= []).push(row);
      return acc;
    },
    {},
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="default">
          <ActivityIcon className="size-4" /> Активность
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 gap-0"
      >
        <SheetHeader className="px-4 py-3 border-b border-border/60">
          <SheetTitle className="font-display text-xl tracking-tight">
            Активность
          </SheetTitle>
          <div className="flex items-center gap-2 mt-2">
            <Filter className="size-3.5 text-muted-foreground shrink-0" />
            <Select value={filterUserId} onValueChange={setFilterUserId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все участники</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading && !items ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : items && items.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Пока ничего не происходило.
            </p>
          ) : (
            Object.entries(grouped).map(([day, rows]) => (
              <section key={day} className="mb-6">
                <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-2">
                  {format(new Date(day), "d MMMM yyyy", { locale: ru })}
                </h3>
                <ul className="space-y-3">
                  {rows.map((row) => (
                    <ActivityItem
                      key={row.id}
                      row={row}
                      boardId={boardId}
                      theme={theme}
                      onJump={(cid) => {
                        const url = new URL(window.location.href);
                        url.searchParams.set("card", cid);
                        router.push(url.pathname + url.search, {
                          scroll: false,
                        });
                        setOpen(false);
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ActivityItem({
  row,
  boardId,
  theme,
  onJump,
}: {
  row: ActivityRow;
  boardId: string;
  theme: "light" | "dark";
  onJump: (cardId: string) => void;
}) {
  const name = row.user?.name || row.user?.email || "Кто-то";
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const text = renderActivity(row);
  const color = row.user
    ? userTextColor(row.user.id, boardId, theme)
    : undefined;

  return (
    <li className="flex gap-2.5 text-sm">
      <Avatar className="size-7 mt-0.5 shrink-0">
        {row.user?.image ? (
          <AvatarImage src={row.user.image} alt="" />
        ) : null}
        <AvatarFallback
          className="text-[10px]"
          style={color ? { background: color, color: "#fff" } : undefined}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="leading-snug">
          <span className="font-medium" style={color ? { color } : undefined}>
            {name}
          </span>{" "}
          {text}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-xs text-muted-foreground"
            suppressHydrationWarning
          >
            {formatDistanceToNow(row.createdAt, {
              addSuffix: true,
              locale: ru,
            })}
          </span>
          {row.cardId ? (
            <button
              type="button"
              onClick={() => onJump(row.cardId!)}
              className="text-xs text-brand hover:underline"
            >
              открыть
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

