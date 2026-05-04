import Link from "next/link";

import { cn } from "@/lib/utils";

type Props = {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * Брендовая метка — типографское «Pinna» с охровой точкой-акцентом.
 * Без иконки в шапке (по запросу пользователя). Иконка пера остаётся
 * только в favicon (`src/app/icon.svg`).
 */
export function BrandMark({ href = "/", size = "md", className }: Props) {
  // bump на одну ступень выше: md теперь как был lg
  const text =
    size === "sm" ? "text-2xl" : size === "lg" ? "text-4xl" : "text-3xl";

  const inner = (
    <span
      className={cn(
        "font-display tracking-tight inline-flex items-baseline gap-1",
        text,
        className,
      )}
    >
      Pinna
      <span className="size-1.5 rounded-full bg-brand" aria-hidden />
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} aria-label="Pinna" className="inline-flex">
      {inner}
    </Link>
  );
}
