import Link from "next/link";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { GlobalSearchTrigger } from "@/components/global-search";
import { BrandMark } from "@/components/brand-mark";
import { SiteFooter } from "@/components/site-footer";
import { BoardCreateDialog } from "@/components/board/board-create-dialog";
import { BoardCardActions } from "@/components/board/board-card-actions";
import { requireUser } from "@/lib/auth";
import { boardAccent } from "@/lib/colors";
import { listMyBoards } from "@/server/board-actions";
import { listMyPendingInvites } from "@/server/member-actions";
import { Mail } from "lucide-react";

export default async function BoardsPage() {
  const user = await requireUser();
  const [boards, invites] = await Promise.all([
    listMyBoards(),
    listMyPendingInvites(),
  ]);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 md:px-12 py-4 md:py-6 border-b border-border/60">
        <BrandMark />
        <div className="flex items-center gap-2">
          <GlobalSearchTrigger />
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </header>

      <main className="flex-1 px-4 md:px-12 py-8 md:py-16 max-w-5xl mx-auto w-full">
        {invites.length > 0 ? (
          <Link
            href="/account"
            className="block mb-8 rounded-lg border border-brand/40 bg-brand/10 px-4 py-3 hover:bg-brand/15 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Mail className="size-4 text-brand shrink-0" />
              <div className="flex-1 text-sm">
                У вас{" "}
                <span className="font-mono">{invites.length}</span>{" "}
                {plural(invites.length, [
                  "новое приглашение",
                  "новых приглашения",
                  "новых приглашений",
                ])}
                {" — "}
                <span className="underline underline-offset-2">
                  открыть аккаунт
                </span>
              </div>
            </div>
          </Link>
        ) : null}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 sm:mb-12">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-brand mb-2 flex items-center gap-2">
              <span className="inline-block h-px w-6 bg-brand" /> Доски
            </p>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-tight">
              Мои доски
            </h1>
          </div>
          <div className="shrink-0">
            <BoardCreateDialog />
          </div>
        </div>

        {boards.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-border/60 border-y border-border/60">
            {boards.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/boards/${b.id}`}
                  className="group flex items-center gap-3 sm:gap-4 py-4 sm:py-6 hover:bg-muted/40 -mx-2 px-2 transition-colors"
                >
                  <div className="shrink-0">
                    <div
                      className="h-10 sm:h-12 w-1 rounded-full"
                      style={{ background: boardAccent(b.id) }}
                      aria-hidden
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-xl sm:text-2xl tracking-tight truncate">
                      {b.title}
                    </h2>
                    {b.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {b.description}
                      </p>
                    ) : null}
                    {/* Мета на мобильном — компактной строкой под заголовком */}
                    <p className="text-xs text-muted-foreground font-mono mt-1 sm:hidden">
                      {b.columnsCount} колонок · {b.cardsCount} карточек ·{" "}
                      {format(b.updatedAt, "d MMM", { locale: ru })}
                    </p>
                  </div>
                  <div className="hidden sm:block shrink-0 w-32 text-sm text-muted-foreground font-mono space-y-1">
                    <div>{b.columnsCount} колонок</div>
                    <div>{b.cardsCount} карточек</div>
                    <div>
                      {/* почему абсолютная дата: relative time даёт hydration mismatch */}
                      {format(b.updatedAt, "d MMM yyyy", { locale: ru })}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <BoardCardActions
                      boardId={b.id}
                      canManage={b.role === "OWNER"}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function plural(n: number, forms: [string, string, string]): string {
  // почему: русские склонения 1/2-4/5+ не покрываются Intl.PluralRules out of the box
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

function EmptyState() {
  return (
    <div className="border border-dashed border-border/70 rounded-lg p-16 text-center">
      <h3 className="font-display text-2xl tracking-tight">
        Здесь пока пусто.
      </h3>
      <p className="text-muted-foreground mt-3 max-w-sm mx-auto">
        Создайте первую доску, чтобы начать раскладывать задачи по колонкам.
      </p>
    </div>
  );
}
