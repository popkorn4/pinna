import Link from "next/link";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { InviteRow } from "@/components/account/invite-row";
import { requireUser } from "@/lib/auth";
import { listMyPendingInvites } from "@/server/member-actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const invites = await listMyPendingInvites();

  const initials = (user.name || user.email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between px-6 md:px-12 py-6 border-b border-border/60">
        <Link
          href="/"
          className="font-display text-2xl tracking-tight inline-flex items-baseline gap-1"
        >
          Plume
          <span className="size-1.5 rounded-full bg-brand" aria-hidden />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </header>

      <main className="flex-1 px-6 md:px-12 py-12 md:py-16 max-w-3xl mx-auto w-full space-y-12">
        <section>
          <p className="text-xs uppercase tracking-[0.2em] text-brand mb-2 flex items-center gap-2">
            <span className="inline-block h-px w-6 bg-brand" /> Аккаунт
          </p>
          <h1 className="font-display text-4xl md:text-5xl tracking-tight">
            {user.name || "Без имени"}
          </h1>
          <div className="mt-6 flex items-center gap-4">
            <Avatar className="size-14">
              {user.image ? <AvatarImage src={user.image} alt="" /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="text-sm text-muted-foreground">
              <div className="font-mono">{user.email}</div>
              <div>
                <Link
                  href="/boards"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Мои доски
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
            <span className="inline-block h-px w-6 bg-muted-foreground" />
            Приглашения
            <span className="font-mono text-foreground">{invites.length}</span>
          </h2>

          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Нет входящих приглашений.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 border-y border-border/60">
              {invites.map((inv) => (
                <li key={inv.id}>
                  <InviteRow
                    invite={{
                      id: inv.id,
                      token: inv.token,
                      role: inv.role,
                      expiresLabel: format(inv.expiresAt, "d MMM yyyy", {
                        locale: ru,
                      }),
                      board: inv.board,
                      invitedBy: inv.invitedBy,
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
