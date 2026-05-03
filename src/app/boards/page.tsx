import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { requireUser } from "@/lib/auth";

// Заглушка под фазу 3 — главное, что есть защищённый роут и шапка
// с пользователем, чтобы проверить аутентификацию.
export default async function BoardsPage() {
  const user = await requireUser();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between px-6 md:px-12 py-6 border-b border-border/60">
        <Link href="/" className="font-display text-2xl tracking-tight">
          Доска
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </header>
      <main className="flex-1 px-6 md:px-12 py-16 max-w-5xl mx-auto w-full">
        <h1 className="font-display text-4xl tracking-tight">Мои доски</h1>
        <p className="text-muted-foreground mt-4">
          Здесь будет список ваших досок. Реализация — фаза 3.
        </p>
        <div className="mt-10 rounded-lg border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
          Привет, {user.name || user.email}.<br />
          Аутентификация работает — теперь можно делать доски.
        </div>
      </main>
    </div>
  );
}
