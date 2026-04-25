type Props = {
  size?: number;
  inverted?: boolean;
};

export function Monogram({ size = 44, inverted = false }: Props) {
  const accent = inverted ? "var(--bg)" : "var(--accent)";
  const accentDeep = inverted ? "var(--bg)" : "var(--accent-hi)";
  const ghost = inverted
    ? "color-mix(in oklch, var(--bg) 55%, transparent)"
    : "var(--text-2)";
  const bar = inverted
    ? "color-mix(in oklch, var(--bg) 70%, transparent)"
    : "var(--text-1)";
  const barHi = inverted ? "var(--bg)" : "var(--text)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      style={{ flexShrink: 0, display: "inline-block" }}
      aria-hidden="true"
    >
      {/* Ghost orbital rings */}
      <circle
        cx="40"
        cy="36"
        r="30"
        stroke={ghost}
        strokeWidth="1.4"
        strokeDasharray="1.8 3"
        opacity="0.75"
      />
      <circle
        cx="60"
        cy="64"
        r="30"
        stroke={ghost}
        strokeWidth="1.4"
        strokeDasharray="1.8 3"
        opacity="0.75"
      />
      <ellipse
        cx="50"
        cy="50"
        rx="34"
        ry="34"
        stroke={ghost}
        strokeWidth="0.9"
        opacity="0.45"
      />

      {/* Main S curve — flowing cubic beziers */}
      <path
        d="M 70 16 C 70 38 30 38 30 50 C 30 62 70 62 70 84"
        stroke={accentDeep}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M 70 16 C 70 38 30 38 30 50 C 30 62 70 62 70 84"
        stroke={accent}
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />

      {/* Mini bar chart in the middle */}
      <rect x="43" y="51" width="2.8" height="8" rx="0.6" fill={bar} />
      <rect x="47.5" y="46" width="2.8" height="13" rx="0.6" fill={barHi} />
      <rect x="52" y="53" width="2.8" height="6" rx="0.6" fill={bar} />

      {/* Orbit nodes */}
      <circle cx="72" cy="18" r="2.6" fill={ghost} />
      <circle cx="29" cy="46" r="2.2" fill={accent} />
      <circle cx="71" cy="56" r="2" fill={ghost} opacity="0.9" />
      <circle cx="28" cy="82" r="2.4" fill={ghost} />
    </svg>
  );
}

export default Monogram;
