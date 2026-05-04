import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { SiteFooter } from "@/components/site-footer";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between px-6 md:px-12 py-6">
        <Link
          href="/"
          className="font-display text-2xl tracking-tight inline-flex items-baseline gap-1"
        >
          Plume
          <span className="size-1.5 rounded-full bg-brand" aria-hidden />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 grid place-items-center px-6 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
