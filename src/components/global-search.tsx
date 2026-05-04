"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, FileText, LayoutGrid } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { searchEverything, type SearchResult } from "@/server/search-actions";

/**
 * Global Cmd+K search.
 *
 * Открывается:
 *  - комбинацией Cmd/Ctrl+K
 *  - кликом по триггеру (если поставить его в шапке)
 */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult>({
    boards: [],
    cards: [],
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Дебаунс поиска
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResult({ boards: [], cards: [] });
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchEverything(query).then(setResult).catch(() => {});
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function go(url: string) {
    setOpen(false);
    setQuery("");
    router.push(url);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Поиск"
      description="Доски, карточки и комментарии"
    >
      <CommandInput
        placeholder="Поиск по доскам и карточкам…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.trim().length < 2 ? (
          <CommandEmpty>Минимум 2 символа</CommandEmpty>
        ) : result.boards.length === 0 && result.cards.length === 0 ? (
          <CommandEmpty>Ничего не найдено</CommandEmpty>
        ) : null}

        {result.boards.length > 0 ? (
          <CommandGroup heading="Доски">
            {result.boards.map((b) => (
              <CommandItem
                key={`b-${b.id}`}
                value={`board-${b.id}-${b.title}`}
                onSelect={() => go(`/boards/${b.id}`)}
              >
                <LayoutGrid className="size-4" />
                <span className="flex-1 truncate">{b.title}</span>
                {b.description ? (
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                    {b.description}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {result.boards.length > 0 && result.cards.length > 0 ? (
          <CommandSeparator />
        ) : null}

        {result.cards.length > 0 ? (
          <CommandGroup heading="Карточки">
            {result.cards.map((c) => (
              <CommandItem
                key={`c-${c.id}`}
                value={`card-${c.id}-${c.title}`}
                onSelect={() =>
                  go(`/boards/${c.boardId}?card=${c.id}`)
                }
              >
                <FileText className="size-4" />
                <span className="flex-1 truncate">{c.title}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {c.boardTitle} · {c.columnTitle}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}

/**
 * Triggert-кнопка для шапки. Можно вставлять отдельно.
 */
export function GlobalSearchTrigger() {
  // Дефолт "⌘" — большинство наших пользователей на маке + не даёт hydration
  // mismatch при SSR (на клиенте после mount уточняем под Win/Linux).
  const [modKey, setModKey] = useState("⌘");
  useEffect(() => {
    const ua = navigator.userAgent;
    const isMac = /Mac|iPod|iPhone|iPad/.test(ua);
    if (!isMac) setModKey("Ctrl+");
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        // эмулируем Cmd+K — проще чем тащить контекст
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true }),
        );
      }}
      className="hidden md:inline-flex items-center gap-2 w-72 lg:w-80 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-border/60 rounded-md px-3 py-2 transition-colors"
    >
      <Search className="size-4 shrink-0" />
      <span className="flex-1 text-left">Поиск по доскам и карточкам…</span>
      <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
        {modKey}K
      </kbd>
    </button>
  );
}
