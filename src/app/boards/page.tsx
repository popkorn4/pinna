import Link from "next/link";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { BoardCreateDialog } from "@/components/board/board-create-dialog";
import { BoardCardActions } from "@/components/board/board-card-actions";
import { requireUser } from "@/lib/auth";
import { boardAccent } from "@/lib/colors";
import { listMyBoards } from "@/server/board-actions";

export default async function BoardsPage() {
  const user = await requireUser();
  const boards = await listMyBoards();

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

      <main className="flex-1 px-6 md:px-12 py-12 md:py-16 max-w-5xl mx-auto w-full">
        <div className="flex items-end justify-between gap-4 mb-12">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand mb-2 flex items-center gap-2">
              <span className="inline-block h-px w-6 bg-brand" /> Доски
            </p>
            <h1 className="font-display text-4xl md:text-5xl tracking-tight">
              Мои доски
            </h1>
          </div>
          <BoardCreateDialog />
        </div>

        {boards.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-border/60 border-y border-border/60">
            {boards.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/boards/${b.id}`}
                  className="group grid grid-cols-12 gap-4 items-center py-6 hover:bg-muted/40 -mx-2 px-2 transition-colors"
                >
                  <div className="col-span-1 flex justify-center">
                    <div
                      className="h-12 w-1 rounded-full"
                      style={{ background: boardAccent(b.id) }}
                      aria-hidden
                    />
                  </div>
                  <div className="col-span-7 md:col-span-8 min-w-0">
                    <h2 className="font-display text-2xl tracking-tight truncate">
                      {b.title}
                    </h2>
                    {b.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {b.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="col-span-3 md:col-span-2 text-xs text-muted-foreground font-mono space-y-1 hidden sm:block">
                    <div>{b.columnsCount} колонок</div>
                    <div>{b.cardsCount} карточек</div>
                    <div>
                      {/* почему абсолютная дата: relative time даёт hydration mismatch
                          (разное "сейчас" на сервере и клиенте) */}
                      {format(b.updatedAt, "d MMM yyyy", { locale: ru })}
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-end">
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
    </div>
  );
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
