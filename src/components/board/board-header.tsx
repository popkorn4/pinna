"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Sparkles, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { InlineTextEdit } from "@/components/board/inline-text-edit";
import { boardAccent } from "@/lib/colors";
import { updateBoard } from "@/server/board-actions";

type Member = {
  role: "OWNER" | "MEMBER" | "VIEWER";
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

type Props = {
  user: { name?: string | null; email?: string | null; image?: string | null };
  board: { id: string; title: string };
  members: Member[];
  canEdit: boolean;
};

export function BoardHeader({ user, board, members, canEdit }: Props) {
  const router = useRouter();
  return (
    <header className="border-b border-border/60">
      <div className="flex items-center justify-between px-4 md:px-8 py-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/boards">
            <ChevronLeft className="size-4" /> Все доски
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
      <div className="px-4 md:px-8 pb-4 flex items-end justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-9 w-1.5 rounded-full shrink-0"
            style={{ background: boardAccent(board.id) }}
            aria-hidden
          />
          <InlineTextEdit
            initial={board.title}
            disabled={!canEdit}
            ariaLabel="Название доски"
            className="font-display text-3xl tracking-tight"
            inputClassName="font-display text-3xl tracking-tight"
            onSubmit={async (next) => {
              const r = await updateBoard(board.id, { title: next });
              if (r.ok) router.refresh();
              return { ok: r.ok, error: r.ok ? undefined : r.error };
            }}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <MemberStack members={members} />
          <Button variant="outline" size="sm" disabled>
            <Users className="size-4" /> Поделиться
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Sparkles className="size-4" /> AI
          </Button>
        </div>
      </div>
    </header>
  );
}

function MemberStack({ members }: { members: Member[] }) {
  const visible = members.slice(0, 4);
  const rest = members.length - visible.length;
  return (
    <div className="flex -space-x-2">
      {visible.map((m) => {
        const initials = (m.user.name || m.user.email)
          .split(/\s+/)
          .map((s) => s[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        return (
          <Avatar
            key={m.user.id}
            className="size-7 ring-2 ring-background"
            title={m.user.name || m.user.email}
          >
            {m.user.image ? <AvatarImage src={m.user.image} alt="" /> : null}
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
        );
      })}
      {rest > 0 ? (
        <div className="size-7 rounded-full ring-2 ring-background bg-muted text-[10px] grid place-items-center">
          +{rest}
        </div>
      ) : null}
    </div>
  );
}
