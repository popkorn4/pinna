"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy, Users, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  changeMemberRole,
  inviteToBoard,
  leaveBoard,
  listBoardMembers,
  removeMember,
  revokeInvite,
} from "@/server/member-actions";
import type { BoardRole } from "@prisma/client";

const inviteFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Неверный email"),
  role: z.enum(["MEMBER", "VIEWER"]),
});
type InviteForm = z.infer<typeof inviteFormSchema>;

type Props = {
  boardId: string;
  currentUserId: string;
  myRole: BoardRole;
};

type Members = Awaited<ReturnType<typeof listBoardMembers>>;

export function ShareDialog({ boardId, currentUserId, myRole }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Members | null>(null);
  const [pending, startTransition] = useTransition();
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const canManage = myRole === "OWNER";

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setError,
    reset,
  } = useForm<InviteForm>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { email: "", role: "MEMBER" },
  });

  useEffect(() => {
    if (!open) return;
    listBoardMembers(boardId).then(setData);
  }, [open, boardId]);

  function refresh() {
    listBoardMembers(boardId).then(setData);
    router.refresh();
  }

  const onInvite = handleSubmit((values) => {
    startTransition(async () => {
      const r = await inviteToBoard(boardId, values);
      if (!r.ok) {
        if (r.fieldErrors) {
          for (const [k, v] of Object.entries(r.fieldErrors)) {
            setError(k as keyof InviteForm, { message: v });
          }
        } else toast.error(r.error);
        return;
      }
      setLastInviteUrl(r.data.url);
      reset({ email: "", role: "MEMBER" });
      if (r.data.emailSent) {
        toast.success("Приглашение отправлено по email");
      } else {
        toast.message("Email не настроен. Скопируйте ссылку ниже.");
      }
      refresh();
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="size-4" /> Поделиться
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Участники доски
          </DialogTitle>
          <DialogDescription>
            {canManage
              ? "Пригласите по email или управляйте ролями участников."
              : "Только владелец может приглашать и менять роли."}
          </DialogDescription>
        </DialogHeader>

        {canManage ? (
          <form onSubmit={onInvite} className="space-y-3" noValidate>
            <div className="grid grid-cols-[1fr_120px_auto] gap-2">
              <div>
                <Label className="sr-only">Email</Label>
                <Input
                  placeholder="email@example.com"
                  type="email"
                  {...register("email")}
                />
                {errors.email?.message ? (
                  <p className="text-xs text-destructive mt-1">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>
              <div>
                <Label className="sr-only">Роль</Label>
                <Controller
                  control={control}
                  name="role"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">Участник</SelectItem>
                        <SelectItem value="VIEWER">Наблюдатель</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <Button type="submit" disabled={pending}>
                Пригласить
              </Button>
            </div>

            {lastInviteUrl ? (
              <div className="rounded-md border border-border/60 bg-muted/40 p-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">
                  Ссылка:
                </span>
                <code className="text-xs truncate flex-1">
                  {lastInviteUrl}
                </code>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(lastInviteUrl);
                    toast.success("Скопировано");
                  }}
                  aria-label="Скопировать"
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            ) : null}
          </form>
        ) : null}

        <Separator />

        {data ? (
          <>
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                Участники ({data.members.length})
              </h3>
              <ul className="space-y-2">
                {data.members.map((m) => (
                  <MemberRow
                    key={m.user.id}
                    boardId={boardId}
                    userId={m.user.id}
                    name={m.user.name}
                    email={m.user.email}
                    image={m.user.image}
                    role={m.role}
                    canManage={canManage}
                    isMe={m.user.id === currentUserId}
                    pending={pending}
                    onChange={refresh}
                    startTransition={startTransition}
                  />
                ))}
              </ul>
            </section>

            {data.invites.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                  Ожидают принятия ({data.invites.length})
                </h3>
                <ul className="space-y-1.5">
                  {data.invites.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center gap-2 rounded p-1.5 -mx-1.5"
                    >
                      <span className="flex-1 text-sm truncate">
                        {inv.email}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {inv.role === "MEMBER" ? "уч." : "набл."}
                      </span>
                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label="Отозвать"
                          onClick={() =>
                            startTransition(async () => {
                              const r = await revokeInvite(inv.id);
                              if (!r.ok) toast.error(r.error);
                              else refresh();
                            })
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        )}

        {!canManage && data?.members.find((m) => m.user.id === currentUserId) ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() =>
              startTransition(async () => {
                const r = await leaveBoard(boardId);
                if (!r.ok) toast.error(r.error);
                else router.push("/boards");
              })
            }
          >
            Покинуть доску
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({
  boardId,
  userId,
  name,
  email,
  image,
  role,
  canManage,
  isMe,
  pending,
  onChange,
  startTransition,
}: {
  boardId: string;
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  role: BoardRole;
  canManage: boolean;
  isMe: boolean;
  pending: boolean;
  onChange: () => void;
  startTransition: (cb: () => void) => void;
}) {
  const initials = (name || email)
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <li className="flex items-center gap-2">
      <Avatar className="size-8">
        {image ? <AvatarImage src={image} alt="" /> : null}
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">
          {name || "Без имени"}
          {isMe ? (
            <span className="text-muted-foreground"> (это вы)</span>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground truncate">{email}</div>
      </div>
      {canManage && !isMe ? (
        <>
          <Select
            value={role}
            onValueChange={(v) =>
              startTransition(async () => {
                const r = await changeMemberRole(
                  boardId,
                  userId,
                  v as BoardRole,
                );
                if (!r.ok) toast.error(r.error);
                else onChange();
              })
            }
            disabled={pending}
          >
            <SelectTrigger className="w-32 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OWNER">Владелец</SelectItem>
              <SelectItem value="MEMBER">Участник</SelectItem>
              <SelectItem value="VIEWER">Наблюдатель</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Удалить участника"
            onClick={() =>
              startTransition(async () => {
                const r = await removeMember(boardId, userId);
                if (!r.ok) toast.error(r.error);
                else onChange();
              })
            }
          >
            <Trash2 className="size-3.5" />
          </Button>
        </>
      ) : (
        <span className="text-xs text-muted-foreground font-mono px-2">
          {role === "OWNER"
            ? "владелец"
            : role === "MEMBER"
              ? "участник"
              : "наблюдатель"}
        </span>
      )}
    </li>
  );
}
