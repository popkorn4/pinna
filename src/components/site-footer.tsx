// Общий тонкий футер. Везде одинаковый, не отвлекает от контента.
// почему так компактно: на странице доски рабочая зона должна оставаться
// главной, футер служит подвалом-меткой, не баннером.

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/60 bg-background/80 backdrop-blur">
      <div className="px-6 md:px-12 py-3 max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="font-display tracking-tight text-foreground inline-flex items-baseline gap-1">
            Plume<span className="size-1 rounded-full bg-brand" aria-hidden />
          </span>
          <span>© {year}</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">v0.1 превью</span>
        </div>
        <nav className="flex items-center gap-3">
          <a
            href="https://glich.ru"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Студия Glitch
          </a>
          <span aria-hidden>·</span>
          <a
            href="mailto:hi@glich.ru"
            className="hover:text-foreground transition-colors"
          >
            Связаться
          </a>
          <span aria-hidden>·</span>
          <span className="font-mono">сделано на Next.js</span>
        </nav>
      </div>
    </footer>
  );
}
