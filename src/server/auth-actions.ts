"use server";

import { redirect } from "next/navigation";

import { signIn, signOut } from "@/lib/auth/auth";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { registerSchema, loginSchema } from "@/lib/auth/schemas";
import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/types/action-result";

function fieldErrorsFromZod(
  err: import("zod").ZodError,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".");
    if (path && !out[path]) out[path] = issue.message;
  }
  return out;
}

export async function registerAction(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<ActionResult<{ userId: string }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Проверьте поля", fieldErrorsFromZod(parsed.error));
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // почему явно говорим "email занят": email enumeration на регистрации —
    // меньшая проблема, чем UX-ловушка. На /login делаем generic-ошибку.
    return actionError("Этот email уже зарегистрирован", {
      email: "Этот email уже зарегистрирован",
    });
  }

  const passwordHash = await hashPassword(password);

  // Создаём пользователя, дефолтную доску и членство OWNER одной транзакцией.
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { email, name, passwordHash },
      select: { id: true },
    });
    const board = await tx.board.create({
      data: {
        title: "Мои задачи",
        description: "Стартовая доска. Можно переименовать или удалить.",
        ownerId: u.id,
      },
      select: { id: true },
    });
    await tx.boardMember.create({
      data: { boardId: board.id, userId: u.id, role: "OWNER" },
    });
    // Сразу 3 базовые колонки — чтобы пустая доска не выглядела заброшенной.
    await tx.column.createMany({
      data: [
        { boardId: board.id, title: "Бэклог", position: 1024 },
        { boardId: board.id, title: "В работе", position: 2048 },
        { boardId: board.id, title: "Готово", position: 3072 },
      ],
    });
    return u;
  });

  return actionOk({ userId: user.id });
}

export async function loginAction(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Проверьте поля", fieldErrorsFromZod(parsed.error));
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch {
    // generic: не раскрываем существование пользователя на логине
    return actionError("Неверный email или пароль");
  }

  return actionOk({ redirectTo: input.next || "/boards" });
}

export async function logoutAction() {
  await signOut({ redirect: false });
  redirect("/");
}
