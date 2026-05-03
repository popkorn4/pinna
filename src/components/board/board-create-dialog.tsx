"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BOARD_TEMPLATES } from "@/lib/board-templates";
import { labelHex } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { createBoard } from "@/server/board-actions";

const schema = z.object({
  title: z.string().trim().min(1, "Введите название").max(120),
  description: z.string().trim().max(2000).optional(),
});
type Values = z.infer<typeof schema>;

export function BoardCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [templateKey, setTemplateKey] = useState<string>("default");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "" },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const res = await createBoard({ ...values, templateKey });
      if (!res.ok) {
        if (res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            setError(k as keyof Values, { message: v });
          }
        } else {
          toast.error(res.error);
        }
        return;
      }
      toast.success("Доска создана");
      reset();
      setOpen(false);
      router.push(`/boards/${res.data.id}`);
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Новая доска
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Новая доска
          </DialogTitle>
          <DialogDescription>
            Назовите доску и выберите шаблон. Колонки и метки можно изменить
            после создания.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Название
            </Label>
            <Input autoFocus {...register("title")} />
            {errors.title?.message ? (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Описание (опционально)
            </Label>
            <Textarea rows={2} {...register("description")} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Шаблон
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {BOARD_TEMPLATES.map((t) => {
                const active = t.key === templateKey;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTemplateKey(t.key)}
                    className={cn(
                      "text-left rounded-md border p-3 transition-colors",
                      active
                        ? "border-brand bg-brand/10"
                        : "border-border/60 hover:border-border bg-card",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-display text-sm tracking-tight">
                        {t.name}
                      </div>
                      {active ? (
                        <Check className="size-3.5 text-brand shrink-0" />
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">
                      {t.description}
                    </p>
                    {t.columns.length > 0 ? (
                      <div className="text-[10px] font-mono text-muted-foreground mt-2 truncate">
                        {t.columns.join(" · ")}
                      </div>
                    ) : null}
                    {t.labels.length > 0 ? (
                      <div className="flex gap-1 mt-2">
                        {t.labels.slice(0, 6).map((l) => (
                          <span
                            key={l.name}
                            className="size-2 rounded-full"
                            style={{ background: labelHex(l.color) }}
                            title={l.name}
                          />
                        ))}
                        {t.labels.length > 6 ? (
                          <span className="text-[10px] text-muted-foreground">
                            +{t.labels.length - 6}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Создаём…" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
