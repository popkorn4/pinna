"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createCard } from "@/server/card-actions";

type Props = {
  columnId: string;
};

export function AddCardComposer({ columnId }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  function submit() {
    const value = title.trim();
    if (!value) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const r = await createCard(columnId, { title: value });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setTitle("");
      router.refresh();
      ref.current?.focus();
    });
  }

  if (!editing) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setEditing(true)}
      >
        <Plus className="size-4" /> Карточка
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        ref={ref}
        rows={2}
        placeholder="Название карточки. Enter — добавить, Esc — отмена."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            setEditing(false);
            setTitle("");
          }
        }}
        disabled={pending}
        className="resize-none"
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
