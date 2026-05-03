"use client";

import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { labelHex } from "@/lib/labels";

type Props = {
  color: string;
  className?: string;
  title?: string;
};

export function ColorSwatch({ color, className, title }: Props) {
  const { resolvedTheme } = useTheme();
  // почему: тон цвета меняется в светлой/тёмной теме (см. labels.ts)
  const hex = labelHex(color, resolvedTheme === "dark" ? "dark" : "light");
  return (
    <span
      className={cn("inline-block shrink-0", className)}
      style={{ background: hex }}
      title={title}
      aria-hidden
    />
  );
}
