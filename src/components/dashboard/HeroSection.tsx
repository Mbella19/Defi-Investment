import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="mb-16 grid grid-cols-12 gap-8 items-end">
      <div className="col-span-12 lg:col-span-8">
        <span className="font-label uppercase tracking-[0.3em] text-[10px] text-secondary-dim font-bold mb-6 block">
          Sovereign Intelligence Platform
        </span>
        <h2 className="font-headline italic text-6xl md:text-8xl text-on-surface tracking-tighter leading-none mb-6">
          Deep Research.
          <br />
          <span className="text-primary">Smart Yields.</span>
        </h2>
        <p className="font-body text-on-surface-variant max-w-xl text-sm leading-relaxed mb-8">
          Institutional-grade DeFi yield analysis. Set your budget and risk parameters, scan 10,000+
          pools across every major protocol, and receive AI-powered legitimacy reports before you
          invest.
        </p>
        <Link
          href="/scanner"
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-4 text-[10px] uppercase font-bold tracking-widest hover:bg-primary-dim transition-all"
        >
          <span className="material-symbols-outlined text-sm">radar</span>
          Launch Scanner
        </Link>
      </div>
      <div className="col-span-12 lg:col-span-4 flex flex-col items-end gap-6">
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">
            Powered By
          </p>
          <p className="font-headline text-2xl text-primary">DeFiLlama</p>
          <p className="text-[10px] text-on-surface-variant mt-1">+ Claude AI Analysis</p>
        </div>
        <div className="w-full h-[1px] bg-outline-variant/20" />
        <div className="flex gap-12">
          <div className="text-right">
            <span className="text-3xl font-headline text-on-surface">10K+</span>
            <span className="text-[8px] uppercase tracking-widest font-bold block">Pools</span>
          </div>
          <div className="text-right">
            <span className="text-3xl font-headline text-on-surface">120+</span>
            <span className="text-[8px] uppercase tracking-widest font-bold block">Chains</span>
          </div>
        </div>
      </div>
    </section>
  );
}
