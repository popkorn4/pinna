import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth/auth";

// почему React cache: внутри одного рендера несколько компонентов могут
// вызвать getCurrentUser — кэш гарантирует один вызов auth() на запрос.
export const getCurrentUser = cache(async () => {
  const session = await auth();
  return session?.user ?? null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
