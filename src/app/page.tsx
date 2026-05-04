import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { BrandMark } from "@/components/brand-mark";
import { SiteFooter } from "@/components/site-footer";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 md:px-12 py-4 md:py-6 border-b border-border/60">
        <BrandMark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <Button asChild size="sm">
                <Link href="/boards">
                  Мои доски
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Войти</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">
                  Начать
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 px-6 md:px-12 py-16 md:py-24 max-w-5xl mx-auto w-full">
        <section className="grid grid-cols-12 gap-x-6 gap-y-16">
          <div className="col-span-12 md:col-span-8">
            <p className="text-xs uppercase tracking-[0.2em] text-brand mb-6 flex items-center gap-2">
              <span className="inline-block h-px w-8 bg-brand" /> v0.1 · превью
            </p>
            <h1 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">
              Планировщик
              <br />
              с собственным
              <br />
              <em className="italic text-brand">помощником.</em>
            </h1>
            <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              Доски, колонки, карточки. И агент, который понимает обычные
              слова: «перенеси все срочные в работу», «разбей задачу на пункты».
            </p>
            <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              {user ? (
                <Button asChild size="lg">
                  <Link href="/boards">
                    Открыть доски
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href="/register">
                      Создать доску
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="lg">
                    <Link href="/login">У меня уже есть аккаунт</Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          <aside className="col-span-12 md:col-span-4 md:pt-16">
            <div className="space-y-10 text-sm md:text-base">
              <Block
                index="01"
                title="Структура"
                body="Доски, колонки, карточки. Drag & drop, метки, чек-листы, дедлайны."
              />
              <Block
                index="02"
                title="Команда"
                body="Приглашайте по email. Роли: владелец, участник, наблюдатель."
              />
              <Block
                index="03"
                title="Агент"
                body="Создаёт и переставляет карточки по вашим словам. Деструктивные действия — только с вашего согласия."
              />
            </div>
          </aside>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Block({
  index,
  title,
  body,
}: {
  index: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-2">
        <span className="font-mono text-xs text-brand">{index}</span>
        <h3 className="font-display text-xl">{title}</h3>
      </div>
      <p className="text-muted-foreground leading-relaxed pl-9">{body}</p>
    </div>
  );
}
