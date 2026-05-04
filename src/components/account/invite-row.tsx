"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { boardAccent } from "@/lib/colors";
import { acceptInvite, declineMyInvite } from "@/server/member-actions";

type Props = {
  invite: {
    id: string;
    token: string;
    role: "OWNER" | "MEMBER" | "CONTRIBUTOR" | "VIEWER";
    expiresLabel: string;
    board: { id: string; title: string; description: string | null };
    invitedBy: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  };
};

export function InviteRow({ invite }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const inviter = invite.invitedBy.name || invite.invitedBy.email;
  const initials = inviter
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function accept() {
    startTransition(async () => {
      const r = await acceptInvite(invite.token);
      if (!r.ok) toast.error(r.error);
      else router.push(`/boards/${r.data.boardId}`);
    });
  }
  function decline() {
    startTransition(async () => {
      const r = await declineMyInvite(invite.id);
      if (!r.ok) toast.error(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 sm:py-5">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div
          className="h-10 w-1 rounded-full shrink-0"
          style={{ background: boardAccent(invite.board.id) }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg tracking-tight truncate">
            {invite.board.title}
          </h3>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
            <Avatar className="size-4">
              {invite.invitedBy.image ? (
                <AvatarImage src={invite.invitedBy.image} alt="" />
              ) : null}
              <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
            </Avatar>
            <span className="truncate max-w-[120px]">{inviter}</span>
            <span aria-hidden>·</span>
            <span className="font-mono">
              {invite.role === "MEMBER"
                ? "участник"
                : invite.role === "CONTRIBUTOR"
                  ? "исполнитель"
                  : "наблюдатель"}
            </span>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap">
              до {invite.expiresLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-2 sm:justify-end shrink-0 pl-4 sm:pl-0">
        <Button size="sm" onClick={accept} disabled={pending}>
          Принять
        </Button>
        <Button size="sm" variant="ghost" onClick={decline} disabled={pending}>
          Отклонить
        </Button>
      </div>
    </div>
  );
}
