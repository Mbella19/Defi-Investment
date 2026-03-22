import ScannerForm from "@/components/scanner/ScannerForm";

export default function ScannerPage() {
  return (
    <div className="px-6 lg:px-10 py-12">
      {/* Hero */}
      <section className="mb-16 grid grid-cols-12 gap-8 items-end">
        <div className="col-span-12 lg:col-span-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-2 bg-[#00D4AA]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
              Yield Scanner
            </span>
          </div>
          <h2 className="text-5xl md:text-7xl font-black tracking-[-0.05em] leading-none mb-6 text-[#203241]">
            Yield <br />
            <span className="italic text-[#00D4AA]">Scanner.</span>
          </h2>
          <p className="text-[#6b7781] max-w-xl text-sm leading-relaxed">
            Set your investment parameters and let our intelligence engine scan 10,000+ yield
            opportunities across DeFi. Each result is verified against live protocol data from
            DeFiLlama.
          </p>
        </div>
        <div className="col-span-12 lg:col-span-4 flex flex-col items-end gap-2">
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
              Data Source
            </p>
            <p className="text-xl font-black tracking-[-0.05em] text-[#00D4AA] mt-1">DeFiLlama</p>
          </div>
          <div className="flex gap-8 mt-6">
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
                Pools
              </p>
              <p className="text-sm font-black tracking-[-0.05em] text-[#203241] mt-1">10,000+</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
                Chains
              </p>
              <p className="text-sm font-black tracking-[-0.05em] text-[#203241] mt-1">120+</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
                Protocols
              </p>
              <p className="text-sm font-black tracking-[-0.05em] text-[#203241] mt-1">3,000+</p>
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
              className="group bg-[#f2f3f5] border border-[#d7dade] p-8 flex items-center gap-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#00D4AA]/30"
            >
              <span className="w-8 h-8 bg-[#00D4AA] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                {item.step}
              </span>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#00D4AA] text-base">{item.icon}</span>
                <span className="text-[11px] tracking-[0.15em] uppercase text-[#203241] font-semibold">
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
