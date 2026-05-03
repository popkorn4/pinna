// Тонкая обёртка над Resend.
// Если RESEND_API_KEY не задан — функции возвращают ok без отправки,
// а вызывающий код выводит ссылку для ручного шаринга. Это нормальный
// dev-режим, чтобы не требовать ключа на локалке.

type SendInviteParams = {
  to: string;
  boardTitle: string;
  inviterName: string;
  acceptUrl: string;
};

export async function sendBoardInvite(
  params: SendInviteParams,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    console.log(
      `[email] skipped — no RESEND_API_KEY. Share manually: ${params.acceptUrl}`,
    );
    return { ok: true, skipped: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: `${params.inviterName} приглашает вас на доску «${params.boardTitle}»`,
        text: [
          `Привет!`,
          ``,
          `${params.inviterName} приглашает вас присоединиться к доске «${params.boardTitle}» в Plume (Kanban-планировщик).`,
          ``,
          `Принять приглашение:`,
          params.acceptUrl,
          ``,
          `Если ссылка не работает, скопируйте её в адресную строку браузера.`,
        ].join("\n"),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[email] resend failed", res.status, body);
      return { ok: false, error: `Resend ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] resend exception", e);
    return { ok: false, error: "Не удалось отправить email" };
  }
}
