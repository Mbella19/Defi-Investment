"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: "terminal", label: "Terminal", href: "/" },
  { icon: "radar", label: "Scanner", href: "/scanner" },
  { icon: "lock_open", label: "Vaults", href: "/results" },
  { icon: "auto_awesome", label: "Strategy", href: "/strategy" },
  { icon: "monitoring", label: "Monitor", href: "/monitor" },
  { icon: "assessment", label: "Risk Lab", href: "/risk" },
  { icon: "calculate", label: "Simulator", href: "/simulator" },
  { icon: "compare", label: "Compare", href: "/compare" },
  { icon: "health_metrics", label: "Health", href: "/health" },
  { icon: "psychology", label: "Intel", href: "/protocol" },
];

export default function NavRail() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-20 border-r border-slate-800/20 bg-[#000000] flex flex-col items-center py-8 z-50">
      <div className="mb-12">
        <Link href="/">
          <span className="font-headline italic text-xl text-slate-100 tracking-tighter">S</span>
        </Link>
      </div>

      <nav className="flex flex-col gap-4 flex-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                group flex flex-col items-center gap-1 py-3 w-20 transition-all duration-200
                ${
                  isActive
                    ? "text-primary border-l-2 border-primary bg-slate-900/40"
                    : "text-slate-500 opacity-60 hover:opacity-100 hover:bg-slate-900/20"
                }
              `}
            >
              <span className="material-symbols-outlined text-2xl">{item.icon}</span>
              <span className="font-label uppercase tracking-widest text-[8px] font-bold">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-6 mt-auto">
        <button className="text-slate-500 opacity-60 hover:opacity-100 transition-all">
          <span className="material-symbols-outlined">settings</span>
        </button>
        <div className="w-8 h-8 bg-surface-highest border border-outline-variant/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-xs">account_circle</span>
        </div>
      </div>
    </aside>
  );
}
