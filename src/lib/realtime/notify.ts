import "server-only";

import { revalidatePath } from "next/cache";

import { notifyBoard } from "@/lib/realtime/pusher-server";

/**
 * Парный helper: серверный revalidate + realtime-нотификация.
 * Вызывать после ЛЮБОЙ мутации, влияющей на представление доски.
 *
 * почему один helper: чтобы реалтайм автоматически "подцеплялся" ко всем
 * существующим server actions без копипасты в каждом месте.
 */
export async function revalidateAndNotifyBoard(boardId: string): Promise<void> {
  revalidatePath(`/boards/${boardId}`);
  await notifyBoard(boardId);
}
