"use client";

import { useEffect, useRef, type CSSProperties } from "react";

type SparkProps = {
  data: number[];
  color?: string;
  stroke?: string;
  up?: boolean;
  height?: number;
  fill?: boolean;
  animated?: boolean;
  style?: CSSProperties;
};

export function Spark({
  data,
  color,
  stroke,
  up,
  height = 36,
  fill = true,
  animated = false,
  style,
}: SparkProps) {
  const lineColor =
    stroke ?? color ?? (up === undefined ? "var(--accent)" : up ? "var(--good)" : "var(--danger)");
  const pathRef = useRef<SVGPathElement | null>(null);
  const n = data.length;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(max - min, 0.0001);
  const pts = data.map((v, i) => [
    n > 1 ? (i / (n - 1)) * 100 : 0,
    100 - ((v - min) / range) * 100,
  ] as const);
  const d = pts
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(" ");
  const area = `${d} L100,100 L0,100 Z`;

  useEffect(() => {
    const el = pathRef.current;
    if (!animated || !el) return;
    const len = el.getTotalLength();
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);
    el.getBoundingClientRect();
    el.style.transition = "stroke-dashoffset 1.6s cubic-bezier(.2,.8,.2,1)";
    el.style.strokeDashoffset = "0";
  }, [animated, d]);

  return (
    <svg
      className="spark"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block", ...style }}
    >
      {fill && <path d={area} fill={lineColor} opacity="0.12" />}
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default Spark;
