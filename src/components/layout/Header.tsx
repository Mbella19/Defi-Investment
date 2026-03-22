"use client";

import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/": "SOVEREIGN TERMINAL",
  "/scanner": "YIELD SCANNER",
  "/results": "VAULT EXPLORER",
  "/strategy": "AI STRATEGIST",
  "/monitor": "PORTFOLIO MONITOR",
  "/risk": "RISK LABORATORY",
  "/simulator": "YIELD SIMULATOR",
  "/compare": "STRATEGY COMPARISON",
  "/health": "PROTOCOL HEALTH",
};

export default function Header() {
  const pathname = usePathname();

  const title =
    pageTitles[pathname] ||
    (pathname.startsWith("/protocol") ? "INTELLIGENCE REPORT" : "SOVEREIGN TERMINAL");

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-5rem)] h-14 bg-[#0e0e0e]/40 backdrop-blur-xl border-b border-slate-800/10 flex justify-between items-center px-8 z-40">
      <div className="flex items-center gap-8">
        <h1 className="font-headline text-xl font-light text-slate-50 tracking-tight">{title}</h1>
        <div className="h-4 w-[1px] bg-outline-variant/30 hidden md:block" />
        <div className="hidden md:flex gap-4">
          <span className="font-label text-[10px] font-medium tracking-tighter text-primary">
            DEFI YIELDS
          </span>
          <span className="font-label text-[10px] font-medium tracking-tighter text-on-surface-variant">
            POWERED BY DEFILLAMA
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative hidden sm:block">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm text-on-surface-variant">
            search
          </span>
          <input
            className="bg-surface-lowest border-b border-outline-variant/30 text-[10px] pl-9 pr-4 py-1.5 w-48 focus:border-primary transition-colors outline-none font-label text-on-surface placeholder:text-on-surface-variant"
            placeholder="Search protocols..."
            type="text"
            readOnly
          />
        </div>
        <div className="flex gap-4">
          <span className="material-symbols-outlined text-primary cursor-pointer hover:text-white transition-colors">
            sensors
          </span>
          <span className="material-symbols-outlined text-primary cursor-pointer hover:text-white transition-colors">
            notifications_active
          </span>
        </div>
      </div>
    </header>
  );
}
