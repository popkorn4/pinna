"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { User as UserIcon, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { assignCard } from "@/server/card-actions";
import { listBoardMembers } from "@/server/member-actions";

type Props = {
  cardId: string;
  boardId: string;
  assignee: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  disabled?: boolean;
};

type Member = {
  user: { id: string; name: string | null; email: string; image: string | null };
};

export function CardAssigneeButton({
  cardId,
  boardId,
  assignee,
  disabled,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || members) return;
    listBoardMembers(boardId).then((d) => setMembers(d.members));
  }, [open, boardId, members]);

  function set(userId: string | null) {
    startTransition(async () => {
      const r = await assignCard(cardId, userId);
      if (!r.ok) toast.error(r.error);
      else router.refresh();
      setOpen(false);
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          disabled={disabled}
        >
          {assignee ? (
            <>
              <Avatar className="size-4 -ml-0.5">
                {assignee.image ? (
                  <AvatarImage src={assignee.image} alt="" />
                ) : null}
                <AvatarFallback className="text-[8px]">
                  {(assignee.name || assignee.email).slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">
                {assignee.name || assignee.email}
              </span>
            </>
          ) : (
            <>
              <UserIcon className="size-4" /> Назначить
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        {!members ? (
          <p className="text-xs text-muted-foreground p-2">Загрузка…</p>
        ) : (
          <ul className="space-y-0.5 max-h-60 overflow-y-auto">
            {assignee ? (
              <li>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => set(null)}
                  className="w-full flex items-center gap-2 rounded p-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" /> Снять назначение
                </button>
              </li>
            ) : null}
            {members.map((m) => (
              <li key={m.user.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => set(m.user.id)}
                  className={`w-full flex items-center gap-2 rounded p-1.5 text-left text-sm hover:bg-muted ${
                    m.user.id === assignee?.id ? "bg-muted/50" : ""
                  }`}
                >
                  <Avatar className="size-6">
                    {m.user.image ? (
                      <AvatarImage src={m.user.image} alt="" />
                    ) : null}
                    <AvatarFallback className="text-[9px]">
                      {(m.user.name || m.user.email).slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">
                    {m.user.name || m.user.email}
                  </span>
                  {m.user.id === assignee?.id ? (
                    <span className="text-xs text-muted-foreground">✓</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
