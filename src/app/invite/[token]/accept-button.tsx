"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/server/member-actions";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await acceptInvite(token);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          router.push(`/boards/${r.data.boardId}`);
        })
      }
    >
      {pending ? "Принимаем…" : "Принять приглашение"}
    </Button>
  );
}
