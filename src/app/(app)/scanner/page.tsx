import ScannerForm from "@/components/scanner/ScannerForm";

export default function ScannerPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
      {/* Hero */}
      <section className="mb-12 sm:mb-16 grid grid-cols-12 gap-6 sm:gap-8 items-end">
        <div className="col-span-12 lg:col-span-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-2 bg-accent" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
              Yield Scanner
            </span>
          </div>
          <h2 className="text-5xl md:text-7xl font-black tracking-[-0.05em] leading-none mb-6 text-on-surface">
            Yield <br />
            <span className="italic text-accent">Scanner.</span>
          </h2>
          <p className="text-muted max-w-xl text-sm leading-relaxed">
            Set your investment parameters and let our intelligence engine scan 10,000+ yield
            opportunities across DeFi. Data from DeFiLlama + Beefy Finance, enriched with
            GoPlus contract security and CoinGecko market data.
          </p>
        </div>
        <div className="col-span-12 lg:col-span-4 flex flex-col items-start lg:items-end gap-2">
          <div className="lg:text-right">
            <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
              Data Source
            </p>
            <p className="text-xl font-black tracking-[-0.05em] text-accent mt-1">Multi-Source</p>
          </div>
          <div className="flex gap-6 sm:gap-8 mt-4 sm:mt-6">
            <div className="lg:text-right">
              <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                Pools
              </p>
              <p className="text-sm font-black tracking-[-0.05em] text-on-surface mt-1">10,000+</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                Chains
              </p>
              <p className="text-sm font-black tracking-[-0.05em] text-on-surface mt-1">120+</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
                Protocols
              </p>
              <p className="text-sm font-black tracking-[-0.05em] text-on-surface mt-1">3,000+</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="mb-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: "01", label: "Set your criteria", icon: "tune" },
            { step: "02", label: "We scan all DeFi yields", icon: "radar" },
            { step: "03", label: "AI verifies each protocol", icon: "psychology" },
          ].map((item) => (
            <div
              key={item.step}
              className="group bg-surface-low border border-outline p-8 flex items-center gap-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30"
            >
              <span className="w-8 h-8 bg-accent text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {item.step}
              </span>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-accent text-base">{item.icon}</span>
                <span className="text-[13px] tracking-[0.12em] uppercase text-on-surface font-semibold">
                  {item.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Scanner Form */}
      <ScannerForm />
    </div>
  );
}
