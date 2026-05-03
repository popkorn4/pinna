"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  removeProfileAvatar,
  updateProfileAvatar,
} from "@/server/profile-actions";

type Props = {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

const MAX_DIMENSION = 256;
const QUALITY = 0.85;

/**
 * Клиент сжимает картинку в браузере до 256×256 JPEG ≈100КБ
 * перед отправкой на сервер. Без этого 5МБ-фото не пройдут лимит.
 */
async function fileToCompressedDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    MAX_DIMENSION / bitmap.width,
    MAX_DIMENSION / bitmap.height,
    1,
  );
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D не поддерживается");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

export function AvatarUploader({ user }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = (user.name || user.email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const displayUrl = previewUrl ?? user.image ?? undefined;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Это не изображение");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл больше 5 МБ — выбери поменьше");
      return;
    }
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setPreviewUrl(dataUrl);
      startTransition(async () => {
        const r = await updateProfileAvatar(dataUrl);
        if (!r.ok) {
          toast.error(r.error);
          setPreviewUrl(null);
          return;
        }
        toast.success("Аватар обновлён");
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      toast.error("Не удалось обработать картинку");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function remove() {
    startTransition(async () => {
      const r = await removeProfileAvatar();
      if (!r.ok) toast.error(r.error);
      else {
        setPreviewUrl(null);
        toast.success("Аватар убран");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative group">
        <Avatar className="size-20">
          {displayUrl ? <AvatarImage src={displayUrl} alt="" /> : null}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <button
          type="button"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
          className="absolute -bottom-1 -right-1 size-7 rounded-full bg-foreground text-background flex items-center justify-center shadow-md hover:scale-105 transition-transform disabled:opacity-50"
          aria-label="Сменить аватар"
        >
          <Camera className="size-3.5" />
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onPick}
      />
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
        >
          {user.image ? "Заменить" : "Загрузить аватар"}
        </Button>
        {user.image ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={remove}
            disabled={pending}
            className="text-destructive"
          >
            <X className="size-3.5" /> Убрать
          </Button>
        ) : null}
      </div>
    </div>
  );
}
