"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createColumn } from "@/server/board-actions";

type Props = {
  boardId: string;
};

export function AddColumnButton({ boardId }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function submit() {
    const value = title.trim();
    if (!value) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const r = await createColumn(boardId, { title: value });
      if (!r.ok) toast.error(r.error);
      else {
        setTitle("");
        router.refresh();
        // оставляем поле открытым — удобно добавлять подряд
        inputRef.current?.focus();
      }
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-80 shrink-0 rounded-lg border border-dashed border-border/70 hover:border-border bg-transparent hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground py-3 grid place-items-center"
      >
        <span className="inline-flex items-center gap-2 text-sm">
          <Plus className="size-4" /> Колонка
        </span>
      </button>
    );
  }

  return (
    <div className="w-80 shrink-0 rounded-lg border border-border bg-card/40 p-2 space-y-2">
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            setEditing(false);
            setTitle("");
          }
        }}
        placeholder="Название колонки"
        disabled={pending}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={pending}>
          Добавить
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditing(false);
            setTitle("");
          }}
        >
          Готово
        </Button>
      </div>
    </div>
  );
}
