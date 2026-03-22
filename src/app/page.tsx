import HeroSection from "@/components/dashboard/HeroSection";
import MarketOverview from "@/components/dashboard/MarketOverview";
import TopYieldsPreview from "@/components/dashboard/TopYieldsPreview";
import Link from "next/link";

export default function Home() {
  return (
    <div className="p-8">
      <HeroSection />
      <MarketOverview />
      <TopYieldsPreview />

      {/* How it Works */}
      <section className="mt-24 grid grid-cols-12 gap-12">
        <div className="col-span-12 lg:col-span-5 bg-surface-lowest p-10 border-l-4 border-primary">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant mb-6 block">
            How It Works
          </span>
          <h3 className="font-headline text-4xl leading-tight mb-8">
            Intelligence-Driven <br />
            <span className="italic">Yield Discovery</span>
          </h3>
          <div className="space-y-6 text-sm text-on-surface-variant leading-relaxed">
            <p>
              Set your investment budget and risk parameters. Our engine scans every yield pool
              tracked by DeFiLlama, filtering for opportunities that match your exact criteria.
            </p>
            <p>
              Before presenting results, each protocol undergoes AI-powered deep research analyzing
              audit history, team reputation, TVL stability, and smart contract risks.
            </p>
          </div>
          <div className="mt-12 flex gap-8">
            <div className="flex flex-col">
              <span className="text-3xl font-headline text-on-surface">3,000+</span>
              <span className="text-[8px] uppercase tracking-widest font-bold">Protocols</span>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-headline text-on-surface">Real-time</span>
              <span className="text-[8px] uppercase tracking-widest font-bold">Data</span>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 space-y-[1px]">
          {[
            {
              step: "01",
              title: "Set Parameters",
              desc: "Define your budget, risk appetite, preferred assets, and target networks.",
              icon: "tune",
            },
            {
              step: "02",
              title: "Scan DeFi",
              desc: "Our engine queries DeFiLlama for all yield opportunities matching your criteria.",
              icon: "radar",
            },
            {
              step: "03",
              title: "AI Research",
              desc: "Claude Opus analyzes each protocol for legitimacy, audits, and risk factors.",
              icon: "psychology",
            },
            {
              step: "04",
              title: "Invest",
              desc: "Review curated results with AI confidence scores and direct investment links.",
              icon: "trending_up",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-surface-low ghost-border hover:bg-surface-high transition-all duration-300 p-8 flex items-start gap-6"
            >
              <span className="text-3xl font-headline text-primary/30">{item.step}</span>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary text-sm">
                    {item.icon}
                  </span>
                  <h4 className="font-headline text-lg text-on-surface">{item.title}</h4>
                </div>
                <p className="text-[12px] text-on-surface-variant">{item.desc}</p>
              </div>
            </div>
          ))}

          <Link
            href="/scanner"
            className="block bg-primary text-on-primary p-8 text-center text-[11px] uppercase font-bold tracking-widest hover:bg-primary-dim transition-all"
          >
            Start Scanning &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
