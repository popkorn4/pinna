import Link from "next/link";
import { Feather } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  href?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
};

/**
 * Логотип Plume — иконка пера (Feather) + название.
 * Используется в шапках вместо текстовой заглушки.
 *
 * почему feather: Plume по-французски = перо. Прямая визуальная связь
 * с названием, без необходимости в кастомном SVG.
 */
export function BrandMark({
  href = "/",
  size = "md",
  showText = true,
  className,
}: Props) {
  const dims =
    size === "sm"
      ? { box: "size-8", icon: "size-4", text: "text-xl" }
      : size === "lg"
        ? { box: "size-12", icon: "size-6", text: "text-3xl" }
        : { box: "size-9", icon: "size-5", text: "text-2xl" };

  const inner = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "grid place-items-center rounded-md bg-foreground text-background shadow-sm",
          dims.box,
        )}
        aria-hidden
      >
        <Feather className={cn(dims.icon, "-rotate-12")} />
      </span>
      {showText ? (
        <span
          className={cn(
            "font-display tracking-tight inline-flex items-baseline gap-1",
            dims.text,
          )}
        >
          Plume
          <span
            className="size-1.5 rounded-full bg-brand"
            aria-hidden
          />
        </span>
      ) : null}
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} aria-label="Plume" className="inline-flex">
      {inner}
    </Link>
  );
}
