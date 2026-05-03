"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoreHorizontal, Archive, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { archiveBoard, deleteBoard } from "@/server/board-actions";

type Props = {
  boardId: string;
  canManage: boolean;
};

export function BoardCardActions({ boardId, canManage }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 -mr-1.5"
            aria-label="Действия с доской"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem onSelect={() => router.push(`/boards/${boardId}`)}>
            <ExternalLink className="size-4" /> Открыть
          </DropdownMenuItem>
          {canManage ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={pending}
                onSelect={() =>
                  startTransition(async () => {
                    const r = await archiveBoard(boardId);
                    if (!r.ok) toast.error(r.error);
                    else {
                      toast.success("Доска в архиве");
                      router.refresh();
                    }
                  })
                }
              >
                <Archive className="size-4" /> В архив
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmOpen(true);
                }}
              >
                <Trash2 className="size-4" /> Удалить
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogTrigger className="sr-only" />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить доску?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Все колонки, карточки, комментарии
              и история активности удалятся вместе с доской.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteBoard(boardId);
                  if (!r.ok) toast.error(r.error);
                  else {
                    toast.success("Доска удалена");
                    router.refresh();
                  }
                  setConfirmOpen(false);
                })
              }
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
