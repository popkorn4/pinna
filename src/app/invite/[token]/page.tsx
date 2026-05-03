import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { boardAccent } from "@/lib/colors";
import { AcceptInviteButton } from "./accept-button";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=/invite/${encodeURIComponent(token)}`);
  }

  const invite = await prisma.boardInvite.findUnique({
    where: { token },
    select: {
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      board: { select: { id: true, title: true, description: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  let state:
    | "ok"
    | "not-found"
    | "expired"
    | "accepted"
    | "wrong-email" = "ok";
  if (!invite) state = "not-found";
  else if (invite.acceptedAt) state = "accepted";
  else if (invite.expiresAt < new Date()) state = "expired";
  else if (
    user.email &&
    invite.email.toLowerCase() !== user.email.toLowerCase()
  )
    state = "wrong-email";

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between px-6 md:px-12 py-6">
        <Link
          href="/"
          className="font-display text-2xl tracking-tight inline-flex items-baseline gap-1"
        >
          Plume
          <span className="size-1.5 rounded-full bg-brand" aria-hidden />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 grid place-items-center px-6 py-10">
        <div className="w-full max-w-md space-y-6">
          {state === "ok" && invite ? (
            <>
              <div className="flex items-center gap-3">
                <div
                  className="h-12 w-1.5 rounded-full"
                  style={{ background: boardAccent(invite.board.id) }}
                />
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Приглашение
                  </p>
                  <h1 className="font-display text-3xl tracking-tight">
                    {invite.board.title}
                  </h1>
                </div>
              </div>
              {invite.board.description ? (
                <p className="text-muted-foreground">
                  {invite.board.description}
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {invite.invitedBy.name || invite.invitedBy.email} приглашает
                вас как{" "}
                <span className="font-mono">
                  {invite.role === "MEMBER"
                    ? "участника"
                    : invite.role === "CONTRIBUTOR"
                      ? "исполнителя"
                      : "наблюдателя"}
                </span>
                .
              </p>
              <AcceptInviteButton token={token} />
            </>
          ) : null}

          {state === "not-found" ? (
            <Message
              title="Приглашение не найдено"
              body="Возможно, ссылка повреждена или приглашение было отозвано."
            />
          ) : null}

          {state === "accepted" ? (
            <Message
              title="Уже принято"
              body="Эта ссылка-приглашение уже использована."
              cta={<Button asChild>
                <Link href="/boards">К моим доскам</Link>
              </Button>}
            />
          ) : null}

          {state === "expired" ? (
            <Message
              title="Срок истёк"
              body="Попросите пригласившего отправить ссылку заново."
            />
          ) : null}

          {state === "wrong-email" && invite ? (
            <Message
              title="Чужое приглашение"
              body={`Это приглашение для ${invite.email}, а вы вошли как ${user!.email}. Войдите под нужным аккаунтом.`}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

function Message({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="space-y-4 text-center">
      <h1 className="font-display text-2xl tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{body}</p>
      {cta ?? (
        <Button asChild variant="ghost">
          <Link href="/">На главную</Link>
        </Button>
      )}
    </div>
  );
}
