"use client";

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isValid: boolean;
}

export default function AddressInput({ value, onChange, onSubmit, isLoading, isValid }: AddressInputProps) {
  return (
    <div className="bg-surface-low border border-outline p-4 sm:p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-2 h-2 bg-accent" />
        <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
          Track Any Wallet
        </span>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && isValid && onSubmit()}
          placeholder="0x... paste any wallet address"
          className="flex-1 bg-surface-highest border border-outline text-sm px-4 py-3 focus:border-accent outline-none transition-colors text-on-surface placeholder:text-muted font-mono"
        />
        <button
          onClick={onSubmit}
          disabled={isLoading || !isValid}
          className={`px-8 py-3 text-sm uppercase font-semibold tracking-[0.08em] flex items-center justify-center gap-2 transition-all duration-300 ${
            isLoading
              ? "bg-surface-container text-muted"
              : isValid
              ? "bg-cta text-white hover:-translate-y-0.5"
              : "bg-surface-container text-muted cursor-not-allowed"
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-2 h-2 bg-accent animate-pulse" />
              Loading...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
              Load Portfolio
            </>
          )}
        </button>
      </div>
      {value && !isValid && value.length > 2 && (
        <p className="text-danger text-xs mt-2">Invalid Ethereum address — must be 0x followed by 40 hex characters</p>
      )}
    </div>
  );
}
