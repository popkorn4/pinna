"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Send,
  Loader2,
  Check,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  applyPendingAction,
  ensureConversation,
  getConversationMessages,
  rejectPendingAction,
} from "@/server/ai-actions";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  pending?: { actionId: string; summary: string };
};

const SUGGESTIONS = [
  "Что просрочено?",
  "Создай 3 карточки для подготовки к встрече",
  "Покажи всё в работе",
  "Перенеси все срочные карточки в «В работе»",
];

type Props = {
  boardId: string;
};

export function AiPanel({ boardId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // При открытии — гарантируем conversationId
  useEffect(() => {
    if (!open) return;
    if (conversationId) return;
    ensureConversation(boardId).then((r) => {
      if (r.ok) setConversationId(r.data.conversationId);
    });
  }, [open, conversationId, boardId]);

  // Догрузить историю при смене разговора
  useEffect(() => {
    if (!conversationId) return;
    getConversationMessages(conversationId).then((msgs) => {
      setMessages(
        msgs
          .filter((m) => m.role !== "TOOL")
          .map((m) => ({
            id: m.id,
            role: m.role.toLowerCase() as "user" | "assistant",
            content: m.content,
            toolCalls: (m.toolCalls as Message["toolCalls"]) ?? undefined,
          })),
      );
    });
  }, [conversationId]);

  // Прокрутка вниз
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || !conversationId || streaming) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    const placeholderId = `a-${Date.now()}`;
    const placeholder: Message = {
      id: placeholderId,
      role: "assistant",
      content: "",
      toolCalls: [],
    };
    setMessages((prev) => [...prev, userMsg, placeholder]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          boardId,
          message: text,
        }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          toast.error("Превышен лимит запросов. Попробуйте позже.");
        } else if (res.status === 401) {
          toast.error("Авторизуйтесь заново");
        } else {
          toast.error(`Ошибка ${res.status}`);
        }
        setStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Парсим SSE: event: ...\ndata: {...}\n\n
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const block of events) {
          const lines = block.split("\n");
          let eventName = "";
          let dataLine = "";
          for (const l of lines) {
            if (l.startsWith("event: ")) eventName = l.slice(7);
            else if (l.startsWith("data: ")) dataLine = l.slice(6);
          }
          if (!eventName || !dataLine) continue;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataLine);
          } catch {
            continue;
          }

          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== placeholderId) return m;
              if (eventName === "text_delta") {
                return { ...m, content: m.content + (data.text as string) };
              }
              if (eventName === "tool_call_start") {
                return {
                  ...m,
                  toolCalls: [
                    ...(m.toolCalls ?? []),
                    {
                      id: `t-${Date.now()}-${(m.toolCalls?.length ?? 0)}`,
                      name: data.tool as string,
                      input: data.input as Record<string, unknown>,
                    },
                  ],
                };
              }
              if (eventName === "pending_action") {
                return {
                  ...m,
                  pending: {
                    actionId: data.action_id as string,
                    summary: data.summary as string,
                  },
                };
              }
              return m;
            }),
          );

          if (eventName === "error") {
            toast.error((data.message as string) ?? "Ошибка агента");
          }
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Сетевая ошибка");
    } finally {
      setStreaming(false);
      router.refresh(); // подхватить новые карточки на доске
    }
  }

  function applyAction(actionId: string) {
    startTransition(async () => {
      const r = await applyPendingAction(actionId);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Действие применено");
        setMessages((prev) =>
          prev.map((m) =>
            m.pending?.actionId === actionId
              ? { ...m, pending: undefined }
              : m,
          ),
        );
        router.refresh();
      }
    });
  }

  function rejectAction(actionId: string) {
    startTransition(async () => {
      const r = await rejectPendingAction(actionId);
      if (!r.ok) toast.error(r.error);
      else {
        setMessages((prev) =>
          prev.map((m) =>
            m.pending?.actionId === actionId
              ? { ...m, pending: undefined }
              : m,
          ),
        );
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="size-4" /> AI
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 gap-0"
      >
        <SheetHeader className="px-4 py-3 border-b border-border/60">
          <SheetTitle className="font-display text-xl tracking-tight">
            Ассистент
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-sm text-muted-foreground space-y-3">
              <p>Помогаю управлять задачами на доске. Несколько идей:</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s)}
                    className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/70 text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onApply={applyAction}
              onReject={rejectAction}
            />
          ))}

          {streaming ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> думаю…
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border/60 p-3 space-y-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Cmd/Ctrl+Enter — отправить"
            rows={2}
            disabled={streaming || !conversationId}
            className="resize-none"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {process.env.NEXT_PUBLIC_AI_MODEL_LABEL ?? "Claude"}
            </span>
            <Button
              size="sm"
              onClick={send}
              disabled={streaming || !input.trim() || !conversationId}
            >
              <Send className="size-3.5" /> Отправить
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MessageBubble({
  message,
  onApply,
  onReject,
}: {
  message: Message;
  onApply: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-brand text-brand-foreground px-3 py-2 text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {message.toolCalls && message.toolCalls.length > 0 ? (
        <div className="space-y-1">
          {message.toolCalls.map((tc) => (
            <ToolCallChip key={tc.id} name={tc.name} input={tc.input} />
          ))}
        </div>
      ) : null}

      {message.content ? (
        <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
      ) : null}

      {message.pending ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
          <p className="text-sm">{message.pending.summary}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onApply(message.pending!.actionId)}>
              <Check className="size-3.5" /> Применить
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onReject(message.pending!.actionId)}
            >
              <X className="size-3.5" /> Отменить
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  list_columns: "Смотрю колонки",
  list_cards: "Ищу карточки",
  get_card: "Читаю карточку",
  list_members: "Смотрю участников",
  list_labels: "Смотрю метки",
  get_today_date: "Уточняю дату",
  create_card: "Создаю карточку",
  update_card: "Обновляю карточку",
  move_card: "Переношу карточку",
  add_label_to_card: "Назначаю метку",
  create_label: "Создаю метку",
  add_checklist: "Добавляю чек-лист",
  delete_card: "Готовлю удаление карточки",
  delete_column: "Готовлю удаление колонки",
};

function ToolCallChip({
  name,
  input,
}: {
  name: string;
  input: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border border-border/60 bg-muted/40 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full text-left px-2 py-1.5 flex items-center gap-1.5",
          "text-muted-foreground hover:text-foreground",
        )}
      >
        {open ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
        <span className="font-mono text-[10px] uppercase tracking-wider">
          {name}
        </span>
        <span className="ml-1">{TOOL_LABELS[name] ?? name}</span>
      </button>
      {open ? (
        <pre className="px-2 pb-2 text-[10px] font-mono text-muted-foreground overflow-x-auto">
          {JSON.stringify(input, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
