"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/types/action-result";

// Лимит размера base64-картинки. 200 КБ хватит для 256×256 JPEG q=0.85.
// почему base64 в БД, а не файлы: для MVP проще, не нужен volume на S3,
// а аватарка ≤200 КБ грузится быстро. Если будет лагать — переедем на R2/S3.
const MAX_AVATAR_BYTES = 200 * 1024;

const avatarSchema = z
  .string()
  .startsWith("data:image/", "Должна быть картинка (data URL)")
  .max(MAX_AVATAR_BYTES * 1.5); // base64 ≈ 4/3 от бинарного размера

export async function updateProfileAvatar(
  dataUrl: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const parsed = avatarSchema.safeParse(dataUrl);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0].message);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { image: parsed.data },
    });
    revalidatePath("/account");
    revalidatePath("/boards");
    return actionOk(undefined);
  } catch (e) {
    console.error("[profile]", e);
    return actionError("Не удалось обновить аватар");
  }
}

export async function removeProfileAvatar(): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { image: null },
    });
    revalidatePath("/account");
    revalidatePath("/boards");
    return actionOk(undefined);
  } catch (e) {
    console.error("[profile]", e);
    return actionError("Не удалось убрать аватар");
  }
}

export async function updateProfileName(
  name: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const parsed = z.string().trim().min(2).max(80).safeParse(name);
    if (!parsed.success) return actionError("Имя 2-80 символов");
    await prisma.user.update({
      where: { id: user.id },
      data: { name: parsed.data },
    });
    revalidatePath("/account");
    revalidatePath("/boards");
    return actionOk(undefined);
  } catch (e) {
    console.error("[profile]", e);
    return actionError("Не удалось обновить имя");
  }
}
