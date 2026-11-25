export function SiteAttributionBar({ className = '' }: { className?: string }) {
  return (
    <div
      className={`border-t border-border bg-card/70 px-4 py-3 text-center text-xs text-muted-foreground sm:px-6 ${className}`}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 sm:flex-row">
        <p className="font-medium text-foreground">
          éditez par Boniface KALONDA et peter LUABA.
        </p>
        <p>
          Contact :{' '}
          <a
            href="mailto:bonnyofficiel992@gmail.com"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            bonnyofficiel992@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}
