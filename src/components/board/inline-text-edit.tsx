"use client";

import {
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

type Props = {
  initial: string;
  onSubmit: (next: string) => Promise<{ ok: boolean; error?: string }>;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
  ariaLabel?: string;
};

/**
 * Универсальный inline-редактор текста.
 * Клик по тексту → input. Enter (или blur) — сохранить, Esc — отмена.
 */
export function InlineTextEdit({
  initial,
  onSubmit,
  className,
  inputClassName,
  placeholder,
  disabled,
  multiline,
  ariaLabel,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }
  }, [editing]);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  function commit() {
    const next = value.trim();
    if (next === initial.trim() || !next) {
      setEditing(false);
      setValue(initial);
      return;
    }
    startTransition(async () => {
      const res = await onSubmit(next);
      if (!res.ok) {
        toast.error(res.error ?? "Не удалось сохранить");
        setValue(initial);
      }
      setEditing(false);
    });
  }

  function onKey(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setValue(initial);
      setEditing(false);
    } else if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      commit();
    } else if (e.key === "Enter" && multiline && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setEditing(true)}
        aria-label={ariaLabel}
        className={cn(
          "text-left rounded px-1 -mx-1 hover:bg-muted/50 disabled:cursor-default",
          className,
        )}
      >
        {initial || (
          <span className="text-muted-foreground italic">{placeholder}</span>
        )}
      </button>
    );
  }

  const Comp = multiline ? "textarea" : "input";
  return (
    <Comp
      // @ts-expect-error union ref
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={onKey}
      disabled={pending}
      placeholder={placeholder}
      className={cn(
        "w-full bg-background border-b border-ring outline-none px-1 -mx-1 rounded-none",
        inputClassName,
        className,
      )}
    />
  );
}
