type Props = {
  size?: number;
  inverted?: boolean;
};

export function Monogram({ size = 36, inverted = false }: Props) {
  const bg = inverted ? "var(--text)" : "var(--accent)";
  const fg = inverted ? "var(--bg)" : "var(--accent-ink)";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: bg,
        color: fg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "var(--shadow-xs)",
        flexShrink: 0,
        position: "relative",
      }}
    >
      <svg
        width={size * 0.58}
        height={size * 0.58}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 17c2.5 2 5.5 2 7 0s1-4-2-5-4-3-2-5 4-2 6 0" />
        <circle cx="12" cy="12" r="10" opacity="0.35" />
      </svg>
    </div>
  );
}

export default Monogram;
