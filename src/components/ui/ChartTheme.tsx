"use client";

import { ReactNode } from "react";
import { useTheme } from "@/components/ThemeProvider";

const lightColors = {
  surface: "#f2f3f5",
  surfaceLow: "#ececef",
  surfaceHigh: "#ffffff",
  text: "#203241",
  textDim: "#6b7781",
  grid: "#d7dade",
  gridDim: "#e2e3e7",
};

const darkColors = {
  surface: "#111113",
  surfaceLow: "#0a0a0b",
  surfaceHigh: "#1a1a1f",
  text: "#fafafa",
  textDim: "#8a8f99",
  grid: "#2a2a32",
  gridDim: "#1e1e24",
};

export function useChartColors() {
  const { theme } = useTheme();
  const c = theme === "dark" ? darkColors : lightColors;
  return {
    primary: "#00D4AA",
    primaryDim: "#00B892",
    secondary: "#FF6B6B",
    tertiary: "#D4E157",
    error: "#FF4D4D",
    errorDim: "#CC3333",
    success: "#00D4AA",
    warning: "#ff6c12",
    ...c,
  };
}

// Static fallback kept for non-hook contexts (unchanged from before)
export const CHART_COLORS = {
  primary: "#00D4AA",
  primaryDim: "#00B892",
  secondary: "#FF6B6B",
  tertiary: "#D4E157",
  error: "#FF4D4D",
  errorDim: "#CC3333",
  success: "#00D4AA",
  warning: "#ff6c12",
  surface: "#f2f3f5",
  surfaceLow: "#ececef",
  surfaceHigh: "#ffffff",
  text: "#203241",
  textDim: "#6b7781",
  grid: "#d7dade",
  gridDim: "#e2e3e7",
} as const;

export const CHART_PALETTE = [
  "#00D4AA", "#ff6c12", "#ff6887", "#dce61a", "#49c7c8",
  "#8B5CF6", "#F59E0B", "#EC4899", "#10B981", "#6366F1",
];

export function useAxisStyle() {
  const colors = useChartColors();
  return {
    stroke: "transparent",
    fontSize: 10,
    fontFamily: "Inter, sans-serif",
    fill: colors.textDim,
  };
}

export const AXIS_STYLE = {
  stroke: "transparent",
  fontSize: 10,
  fontFamily: "Inter, sans-serif",
  fill: "#6b7781",
};

export function useGridStyle() {
  const colors = useChartColors();
  return {
    stroke: colors.gridDim,
    strokeDasharray: "3 3",
  };
}

export const GRID_STYLE = {
  stroke: "#e2e3e7",
  strokeDasharray: "3 3",
};

export function useTooltipStyle() {
  const colors = useChartColors();
  return {
    contentStyle: {
      backgroundColor: colors.surfaceHigh,
      border: `1px solid ${colors.grid}`,
      borderRadius: 0,
      fontSize: 11,
      fontFamily: "Inter, sans-serif",
      color: colors.text,
    },
    labelStyle: {
      color: "#00D4AA",
      fontWeight: 600,
      fontSize: 10,
      textTransform: "uppercase" as const,
      letterSpacing: "0.1em",
    },
  };
}

export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#ffffff",
    border: "1px solid #d7dade",
    borderRadius: 0,
    fontSize: 11,
    fontFamily: "Inter, sans-serif",
    color: "#203241",
  },
  labelStyle: {
    color: "#00D4AA",
    fontWeight: 600,
    fontSize: 10,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
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
    <div className={`border border-outline bg-surface-low p-8 ${className}`}>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-2 w-2 bg-accent" />
          <span className="text-[13px] uppercase tracking-[0.2em] text-label/70 font-semibold">
            {title}
          </span>
        </div>
        {subtitle && (
          <span className="text-[13px] text-muted block ml-[19px]">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  );
}
