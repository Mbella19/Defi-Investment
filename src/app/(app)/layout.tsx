"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Scanner", href: "/scanner" },
  { label: "Vaults", href: "/results" },
  { label: "Strategy", href: "/strategy" },
  { label: "Monitor", href: "/monitor" },
  { label: "Risk Lab", href: "/risk" },
  { label: "Simulator", href: "/simulator" },
  { label: "Compare", href: "/compare" },
  { label: "Health", href: "/health" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#ececef]">
      {/* App Header */}
      <header className="sticky top-0 z-50 border-b border-[#d7dade] bg-[#ececef]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-4 lg:px-10">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-[28px] font-black leading-[0.85] tracking-[-0.08em] text-[#203241]">
              ST
            </span>
            <span className="hidden sm:block text-[9px] font-medium uppercase leading-[1.1] tracking-[0.02em] text-[#203241]">
              Sovereign<br />Terminal
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] transition-all ${
                    isActive
                      ? "text-[#00D4AA]"
                      : "text-[#2a3a46]/60 hover:text-[#2a3a46]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[11px] text-[#43515d]/60">
              <div className="h-1.5 w-1.5 bg-[#00D4AA] animate-pulse" />
              <span className="hidden sm:inline">Live</span>
            </div>
            <Link
              href="/"
              className="border border-[#2a3a46] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#2a3a46] transition-all hover:-translate-y-0.5 hover:bg-[#2a3a46] hover:text-white"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-[1400px]">
        {children}
      </main>
    </div>
  );
}
