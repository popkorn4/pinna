import Link from "next/link";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { BrandMark } from "@/components/brand-mark";
import { SiteFooter } from "@/components/site-footer";
import { AvatarUploader } from "@/components/account/avatar-uploader";
import { InviteRow } from "@/components/account/invite-row";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { listMyPendingInvites } from "@/server/member-actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const sessionUser = await requireUser();
  // Загружаем актуального юзера из БД — у session-объекта `image` мог
  // отстать от свежего аватара (JWT кешируется до следующего входа).
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, name: true, email: true, image: true },
  });
  if (!user) throw new Error("user gone");
  const invites = await listMyPendingInvites();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 md:px-12 py-4 md:py-6 border-b border-border/60">
        <BrandMark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </header>

      <main className="flex-1 px-4 md:px-12 py-8 md:py-16 max-w-3xl mx-auto w-full space-y-10 md:space-y-12">
        <section>
          <p className="text-xs uppercase tracking-[0.2em] text-brand mb-2 flex items-center gap-2">
            <span className="inline-block h-px w-6 bg-brand" /> Аккаунт
          </p>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-tight break-words">
            {user.name || "Без имени"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground font-mono break-all">
            {user.email}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link
              href="/boards"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Мои доски
            </Link>
          </p>
          <div className="mt-8">
            <AvatarUploader user={user} />
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
      <SiteFooter />
    </div>
  );
}
