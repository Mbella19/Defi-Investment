"use client";

interface BudgetInputProps {
  value: number;
  onChange: (value: number) => void;
}

const presets = [1000, 5000, 10000, 50000, 100000];

export default function BudgetInput({ value, onChange }: BudgetInputProps) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-2 h-2 bg-[#00D4AA]" />
        <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
          Investment Budget
        </label>
      </div>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7781] text-lg font-light">
          $
        </span>
        <input
          type="text"
          value={value.toLocaleString("en-US")}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, "");
            const num = parseInt(raw) || 0;
            onChange(Math.min(num, 100000000));
          }}
          className="w-full bg-white border border-[#d7dade] text-2xl font-black tracking-[-0.05em] pl-10 pr-4 py-4 focus:border-[#00D4AA] transition-all duration-300 outline-none text-[#203241] hover:border-[#00D4AA]/30"
        />
      </div>
      <div className="flex gap-2 flex-wrap mt-4">
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            className={`
              px-4 py-2 text-[10px] font-semibold tracking-[0.1em] uppercase transition-all duration-300
              ${
                value === preset
                  ? "bg-[#00D4AA] text-white"
                  : "bg-[#ebedf0] text-[#43515d] hover:bg-[#00D4AA]/10 hover:text-[#203241]"
              }
            `}
          >
            ${preset.toLocaleString("en-US")}
          </button>
        ))}
      </div>
    </div>
  );
}
