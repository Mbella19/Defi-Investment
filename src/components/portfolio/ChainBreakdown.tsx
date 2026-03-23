"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { ChainAllocation } from "@/types/wallet";
import { formatCurrency } from "@/lib/formatters";
import { CHART_PALETTE, TOOLTIP_STYLE } from "@/components/ui/ChartTheme";

interface ChainBreakdownProps {
  chains: ChainAllocation[];
}

export default function ChainBreakdown({ chains }: ChainBreakdownProps) {
  if (chains.length === 0) return null;

  const data = chains.filter((c) => c.valueUsd > 0);

  return (
    <div className="bg-surface-low border border-outline p-4 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-2 h-2 bg-accent" />
        <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
          Chain Allocation
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-8 items-center">
        {/* Pie Chart */}
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              dataKey="valueUsd"
              nameKey="chainName"
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(value: unknown) => [formatCurrency(value as number), "Value"]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="space-y-3">
          {data.map((chain, i) => (
            <div key={chain.chainId} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 shrink-0"
                  style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }}
                />
                <span className="text-sm font-semibold text-on-surface">{chain.chainName}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-on-surface-variant">{formatCurrency(chain.valueUsd)}</span>
                <span className="text-sm font-bold text-accent w-14 text-right">
                  {chain.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
