import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { AnalyticsView } from "@/components/board/analytics-view";
import { requireUser } from "@/lib/auth";
import { NotFoundError } from "@/lib/auth/permissions";
import { getBoard } from "@/server/board-actions";
import { getBoardAnalytics } from "@/server/analytics-actions";

type Props = {
  params: Promise<{ boardId: string }>;
};

export default async function AnalyticsPage({ params }: Props) {
  const { boardId } = await params;
  const user = await requireUser();

  let data;
  try {
    data = await getBoard(boardId);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { board } = data;
  const analytics = await getBoardAnalytics(boardId);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-border/60">
        <Button asChild variant="outline" size="default">
          <Link href={`/boards/${board.id}`}>
            <ChevronLeft className="size-4" /> К доске
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </header>
      <main className="flex-1 px-4 md:px-8 py-8 max-w-5xl mx-auto w-full space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-brand mb-2 flex items-center gap-2">
            <span className="inline-block h-px w-6 bg-brand" /> Аналитика
          </p>
          <h1 className="font-display text-3xl md:text-4xl tracking-tight">
            {board.title}
          </h1>
        </div>
        <AnalyticsView analytics={analytics} />
      </main>
    </div>
  );
}
