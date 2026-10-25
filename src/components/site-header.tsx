import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-5xl items-baseline justify-between gap-4 px-4 py-4">
        <Link href="/" className="font-display text-2xl tracking-tight text-foreground">
          ReturnDesk
        </Link>
        <p className="text-sm text-muted">Returns desk</p>
      </div>
    </header>
  );
}
