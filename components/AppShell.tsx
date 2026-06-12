"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sun, Moon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ProviderStatus } from "@/components/ProviderStatus";
import { ToastProvider } from "@/components/ui/Toast";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/groups", label: "Groups" },
  { href: "/bracket", label: "Bracket" },
  { href: "/champion", label: "Champion" },
  { href: "/office", label: "Office" },
  { href: "/accuracy", label: "Accuracy" },
];

const mobileTabs = nav.slice(0, 5);

const THEME_KEY = "wc-odds-theme";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [themeReady, setThemeReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    }
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme, themeReady]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <ToastProvider>
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-40 flex h-[60px] items-center gap-4 border-b border-border bg-bg/80 px-4 backdrop-blur-md md:px-6">
        <Link href="/" className="flex items-center gap-2 font-[family-name:var(--font-archivo)] text-sm font-extrabold tracking-tight md:text-base">
          <span className="h-3.5 w-3.5 rounded bg-brand shadow-[0_0_0_4px_var(--brand-tint)]" />
          WORLDCUP ODDS
          <span className="num text-[11px] font-semibold text-text-muted">2026</span>
        </Link>
        <nav className="hidden items-center gap-0.5 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                isActive(item.href)
                  ? "bg-brand-tint text-text ring-1 ring-brand"
                  : "text-text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ProviderStatus compact />
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="grid h-10 w-10 min-h-[44px] min-w-[44px] place-items-center rounded-lg border border-border bg-surface text-text hover:border-brand"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface lg:hidden"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu overlay"
            className="fixed inset-0 z-40 bg-bg/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="fixed right-0 top-[60px] z-50 w-full max-w-xs border-b border-l border-border bg-surface p-4 shadow-xl lg:hidden">
            <p className="num mb-3 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Navigation
            </p>
            <div className="space-y-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-3 text-sm font-semibold ${
                    isActive(item.href)
                      ? "bg-brand-tint text-text ring-1 ring-brand"
                      : "text-text-muted hover:bg-surface-2 hover:text-text"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-4">
              <ProviderStatus />
            </div>
          </nav>
        </>
      )}

      <main
        className={`mx-auto px-4 py-8 pb-24 md:px-8 lg:pb-8 ${
          pathname === "/bracket" ? "max-w-[min(100vw-2rem,1920px)]" : "max-w-[1280px]"
        }`}
      >
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur-md lg:hidden">
        {mobileTabs.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center py-3 text-[10px] font-semibold min-h-[52px] sm:text-[11px] ${
              isActive(item.href) ? "text-brand" : "text-text-muted"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className={`flex flex-1 flex-col items-center justify-center py-3 text-[10px] font-semibold min-h-[52px] sm:text-[11px] ${
            nav.some((item) => !mobileTabs.includes(item) && isActive(item.href))
              ? "text-brand"
              : "text-text-muted"
          }`}
        >
          More
        </button>
      </nav>
    </div>
    </ToastProvider>
  );
}
