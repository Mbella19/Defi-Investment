type Tone = "neutral" | "accent";

type Props = {
  sym: string;
  size?: number;
  tone?: Tone;
};

const TONES: Record<Tone, { bg: string; fg: string; bd: string }> = {
  neutral: {
    bg: "var(--surface-3)",
    fg: "var(--text-1)",
    bd: "var(--line-2)",
  },
  accent: {
    bg: "var(--accent-soft)",
    fg: "var(--accent)",
    bd: "color-mix(in oklch, var(--accent) 32%, transparent)",
  },
};

export function TokenGlyph({ sym, size = 22, tone = "neutral" }: Props) {
  const t = TONES[tone];
  const label = sym.slice(0, sym.length >= 4 ? 1 : 2).toUpperCase();
  return (
    <span
      className="mono"
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 600,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        borderRadius: 999,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

export default TokenGlyph;
