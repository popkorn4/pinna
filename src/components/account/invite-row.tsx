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
    role: "OWNER" | "MEMBER" | "VIEWER";
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
    <div className="grid grid-cols-12 gap-4 items-center py-5">
      <div className="col-span-1 flex justify-center">
        <div
          className="h-10 w-1 rounded-full"
          style={{ background: boardAccent(invite.board.id) }}
          aria-hidden
        />
      </div>
      <div className="col-span-7 min-w-0">
        <h3 className="font-display text-lg tracking-tight truncate">
          {invite.board.title}
        </h3>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
          <Avatar className="size-4">
            {invite.invitedBy.image ? (
              <AvatarImage src={invite.invitedBy.image} alt="" />
            ) : null}
            <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
          </Avatar>
          <span>{inviter}</span>
          <span>·</span>
          <span>
            как{" "}
            <span className="font-mono">
              {invite.role === "MEMBER" ? "участник" : "наблюдатель"}
            </span>
          </span>
          <span>·</span>
          <span>до {invite.expiresLabel}</span>
        </div>
      </div>
      <div className="col-span-4 flex gap-2 justify-end">
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
