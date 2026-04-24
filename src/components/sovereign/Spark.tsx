"use client";

import { useEffect, useRef } from "react";

type SparkProps = {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
  animated?: boolean;
};

export function Spark({
  data,
  color = "var(--accent)",
  height = 32,
  fill = true,
  animated = true,
}: SparkProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const w = 200;
  const h = height;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * w : 0;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y] as const;
  });
  const d = pts
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;

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
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {fill && <path d={area} fill={color} opacity="0.08" />}
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default Spark;
