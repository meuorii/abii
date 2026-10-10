import Link from "next/link";

const defaultItems = [
  { label: "Overview", href: "/", active: true },
  { label: "Subjects", href: "#subjects", active: false },
  { label: "Review", href: "#review", active: false },
];

type NavigationProps = {
  brand?: string;
  items?: { label: string; href: string; active?: boolean }[];
};

export function Navigation({ brand = "abii", items = defaultItems }: NavigationProps) {
  return (
    <header className="border-b border-border bg-white">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8"
      >
        <Link href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-active">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-card text-xl text-pink-active" aria-hidden="true">♡</span>
          <span className="text-xl font-extrabold tracking-tight text-foreground">{brand}<span className="text-pink-primary">.</span></span>
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={[
                "rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-active",
                item.active
                  ? "bg-pink-soft text-pink-active"
                  : "text-muted hover:bg-pink-soft hover:text-foreground",
              ].join(" ")}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
