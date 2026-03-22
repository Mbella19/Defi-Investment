import ScannerForm from "@/components/scanner/ScannerForm";

export default function ScannerPage() {
  return (
    <div className="p-8">
      {/* Hero */}
      <section className="mb-12 grid grid-cols-12 gap-8 items-end">
        <div className="col-span-12 lg:col-span-8">
          <h2 className="font-headline text-5xl md:text-7xl font-light leading-none mb-4 tracking-tighter text-on-surface">
            Yield <br />
            <span className="italic text-primary">Scanner.</span>
          </h2>
          <p className="font-body text-on-surface-variant max-w-xl text-sm leading-relaxed">
            Set your investment parameters and let our intelligence engine scan 10,000+ yield
            opportunities across DeFi. Each result is verified against live protocol data from
            DeFiLlama.
          </p>
        </div>
        <div className="col-span-12 lg:col-span-4 flex flex-col items-end gap-2">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
              Data Source
            </p>
            <p className="font-headline text-xl text-primary">DeFiLlama</p>
          </div>
          <div className="flex gap-8 mt-4">
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">
                Pools
              </p>
              <p className="font-label text-sm">10,000+</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">
                Chains
              </p>
              <p className="font-label text-sm">120+</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">
                Protocols
              </p>
              <p className="font-label text-sm">3,000+</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="mb-12 flex flex-wrap items-center gap-4 bg-surface-low p-4 border-l-2 border-primary">
        <div className="flex items-center gap-3 pr-6">
          <span className="w-6 h-6 bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold">
            1
          </span>
          <span className="text-[11px] text-on-surface">Set your criteria</span>
        </div>
        <div className="h-4 w-[1px] bg-outline-variant/20 hidden sm:block" />
        <div className="flex items-center gap-3 px-4">
          <span className="w-6 h-6 bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold">
            2
          </span>
          <span className="text-[11px] text-on-surface">We scan all DeFi yields</span>
        </div>
        <div className="h-4 w-[1px] bg-outline-variant/20 hidden sm:block" />
        <div className="flex items-center gap-3 px-4">
          <span className="w-6 h-6 bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold">
            3
          </span>
          <span className="text-[11px] text-on-surface">AI verifies each protocol</span>
        </div>
      </section>

      {/* Scanner Form */}
      <ScannerForm />
    </div>
  );
}
