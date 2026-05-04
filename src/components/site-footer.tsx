// Общий футер сайта. Лаконичный, типографский, без цветов и эмодзи.
// почему отдельный компонент: дублировался copy «© Plume» по нескольким
// страницам, и кредит студии нужно держать в одном месте.

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="px-6 md:px-12 py-8 border-t border-border/60 text-sm text-muted-foreground">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
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
