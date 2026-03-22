"use client";

interface BudgetInputProps {
  value: number;
  onChange: (value: number) => void;
}

const presets = [1000, 5000, 10000, 50000, 100000];

export default function BudgetInput({ value, onChange }: BudgetInputProps) {
  return (
    <div className="space-y-4">
      <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block">
        Investment Budget
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg font-light">
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
          className="w-full bg-surface-lowest border-b border-outline-variant/30 text-2xl font-headline pl-10 pr-4 py-4 focus:border-primary transition-colors outline-none text-on-surface"
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            className={`
              px-4 py-1.5 text-[10px] font-bold transition-all duration-200
              ${
                value === preset
                  ? "bg-primary text-on-primary"
                  : "bg-surface-highest text-on-surface-variant hover:text-on-surface"
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
