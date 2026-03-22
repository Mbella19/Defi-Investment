"use client";

import { ReactNode } from "react";

export const CHART_COLORS = {
  primary: "#bac8da",
  primaryDim: "#acbacc",
  secondary: "#949eb3",
  tertiary: "#ccd8ef",
  error: "#ee7d77",
  errorDim: "#bb5551",
  success: "#6ecf8a",
  warning: "#e8c468",
  surface: "#191a1a",
  surfaceLow: "#131313",
  surfaceHigh: "#1f2020",
  text: "#e7e5e5",
  textDim: "#acabaa",
  grid: "#484848",
  gridDim: "#2a2a2a",
} as const;

export const CHART_PALETTE = [
  "#bac8da", "#6ecf8a", "#e8c468", "#ee7d77", "#949eb3",
  "#ccd8ef", "#bb5551", "#acbacc", "#dae6fd", "#767575",
];

export const AXIS_STYLE = {
  stroke: CHART_COLORS.grid,
  fontSize: 10,
  fontFamily: "Inter, sans-serif",
  fill: CHART_COLORS.textDim,
};

export const GRID_STYLE = {
  stroke: CHART_COLORS.gridDim,
  strokeDasharray: "3 3",
};

export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: CHART_COLORS.surfaceLow,
    border: `1px solid ${CHART_COLORS.grid}`,
    borderRadius: 0,
    fontSize: 11,
    fontFamily: "Inter, sans-serif",
    color: CHART_COLORS.text,
  },
  labelStyle: {
    color: CHART_COLORS.primary,
    fontWeight: 700,
    fontSize: 10,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
};

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function ChartContainer({ title, subtitle, children, className = "" }: ChartContainerProps) {
  return (
    <div className={`bg-surface-lowest border-l-4 border-primary p-6 ${className}`}>
      <div className="mb-4">
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant block">
          {title}
        </span>
        {subtitle && (
          <span className="text-[10px] text-on-surface-variant/60 block mt-1">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  );
}
