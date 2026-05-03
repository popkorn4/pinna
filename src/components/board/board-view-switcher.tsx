"use client";

import Link from "next/link";
import { Calendar, LayoutGrid } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  boardId: string;
  view: "kanban" | "calendar";
};

/** Переключатель Доска / Календарь в шапке доски. */
export function BoardViewSwitcher({ boardId, view }: Props) {
  return (
    <div className="inline-flex rounded-md border border-border/60 p-0.5 text-sm">
      <Link
        href={`/boards/${boardId}`}
        className={cn(
          "px-3 py-1.5 rounded inline-flex items-center gap-1.5 transition-colors",
          view === "kanban"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid className="size-4" /> Доска
      </Link>
      <Link
        href={`/boards/${boardId}/calendar`}
        className={cn(
          "px-3 py-1.5 rounded inline-flex items-center gap-1.5 transition-colors",
          view === "calendar"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Calendar className="size-4" /> Календарь
      </Link>
    </div>
  );
}
