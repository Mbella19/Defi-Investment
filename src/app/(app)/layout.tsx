"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import ThemeToggle from "@/components/ThemeToggle";

const ConnectButton = dynamic(
  () => import("@/components/wallet/ConnectButton"),
  { ssr: false, loading: () => <div className="border border-outline/30 px-4 py-2 text-sm text-muted">Connect</div> }
);

const AlertBell = dynamic(
  () => import("@/components/notifications/AlertBell"),
  { ssr: false }
);

const navItems = [
  { label: "Scanner", href: "/scanner" },
  { label: "Vaults", href: "/results" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Strategy", href: "/strategy" },
  { label: "Active", href: "/strategies" },
  { label: "Monitor", href: "/monitor" },
  { label: "Risk", href: "/risk" },
  { label: "Simulator", href: "/simulator" },
  { label: "Compare", href: "/compare" },
  { label: "Health", href: "/health" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-background">
      {/* App Header */}
      <header className="sticky top-0 z-50 border-b border-outline bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-10">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-[28px] font-black leading-[0.85] tracking-[-0.08em] text-on-surface">
              ST
            </span>
            <span className="hidden sm:block text-xs font-medium uppercase leading-[1.1] tracking-[0.02em] text-on-surface">
              Sovereign<br />Terminal
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden xl:flex items-center gap-0">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-[0.04em] transition-all whitespace-nowrap ${
                    isActive
                      ? "text-accent"
                      : "text-btn/60 hover:text-btn"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5 text-sm text-on-surface-variant/60">
              <div className="h-1.5 w-1.5 bg-accent animate-pulse" />
              <span className="hidden sm:inline">Live</span>
            </div>
            <AlertBell />
            <ThemeToggle />
            <div className="hidden sm:block">
              <ConnectButton />
            </div>

            {/* Hamburger button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="xl:hidden flex flex-col items-center justify-center w-10 h-10 gap-1.5"
              aria-label="Toggle menu"
            >
              <span className={`block h-0.5 w-6 bg-on-surface transition-all duration-300 ${menuOpen ? "translate-y-2 rotate-45" : ""}`} />
              <span className={`block h-0.5 w-6 bg-on-surface transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
              <span className={`block h-0.5 w-6 bg-on-surface transition-all duration-300 ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
            </button>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        {menuOpen && (
          <div className="xl:hidden border-t border-outline bg-background/95 backdrop-blur-xl">
            <nav className="flex flex-col px-4 py-4">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-3.5 text-base font-semibold uppercase tracking-[0.04em] transition-all border-b border-outline/50 ${
                      isActive
                        ? "text-accent"
                        : "text-btn/70 hover:text-btn"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-[1400px]">
        {children}
      </main>
    </div>
  );
}
