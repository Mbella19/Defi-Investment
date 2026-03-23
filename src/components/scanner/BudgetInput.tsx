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
        <div className="w-2 h-2 bg-accent" />
        <label className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
          Investment Budget
        </label>
      </div>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-lg font-light">
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
          className="w-full bg-surface-highest border border-outline text-2xl font-black tracking-[-0.05em] pl-10 pr-4 py-4 focus:border-accent transition-all duration-300 outline-none text-on-surface hover:border-accent/30"
        />
      </div>
      <div className="flex gap-2 flex-wrap mt-4">
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            className={`
              px-4 py-2 text-xs font-semibold tracking-[0.1em] uppercase transition-all duration-300
              ${
                value === preset
                  ? "bg-accent text-white"
                  : "bg-surface-container text-on-surface-variant hover:bg-accent/10 hover:text-on-surface"
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
