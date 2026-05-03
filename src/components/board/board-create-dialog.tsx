"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
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
      const res = await createBoard(values);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Новая доска
          </DialogTitle>
          <DialogDescription>
            Дайте короткое название. Описание можно добавить позже.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
              Описание
            </Label>
            <Textarea rows={3} {...register("description")} />
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
