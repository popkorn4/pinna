// Общий тонкий футер: 3 колонки как раньше, уменьшенная высота py-3.
// Размещён на всех страницах сайта (включая страницу доски).

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/60 px-6 md:px-12 py-3 text-sm text-muted-foreground">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>© {year} Plume</span>
        <span>
          Сайт создан студией{" "}
          <a
            href="https://glich.ru"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-4 decoration-brand/60 hover:decoration-brand text-foreground"
          >
            Glitch
          </a>
        </span>
        <span className="font-mono text-xs">localhost</span>
      </div>
    </footer>
  );
}
