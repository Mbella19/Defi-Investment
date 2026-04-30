"use client";

import Link from "next/link";
import type React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import {
  chainMeta,
  formatPct,
  formatUsd,
  type ChainId,
  type RiskBand,
} from "@/lib/design-utils";
import { PoolIcon } from "@/components/site/PoolIcon";

export function ChainBadge({ chain }: { chain: ChainId }) {
  const meta = chainMeta[chain];
  return (
    <span className="chain-badge" style={{ "--chain-color": meta.color } as React.CSSProperties}>
      <span aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function RiskPill({ risk }: { risk: RiskBand }) {
  return <span className={`risk-pill risk-${risk.toLowerCase()}`}>{risk}</span>;
}

export function MetricTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "#6ee7b7",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  tone?: string;
}) {
  return (
    <div className="metric-tile" style={{ "--tile-tone": tone } as React.CSSProperties}>
      <div className="tile-top">
        <span>{label}</span>
        {Icon ? <Icon size={18} strokeWidth={1.8} aria-hidden="true" /> : null}
      </div>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

export interface MarketRowData {
  symbol: string;
  protocol: string;
  chain: ChainId;
  category: string;
  tvl: number;
  apy: number;
  apy7d: number | null;
  safety: number;
  href?: string;
}

export function MarketRow({ market }: { market: MarketRowData }) {
  const Tag: React.ElementType = market.href ? "a" : "div";
  const props = market.href
    ? {
        href: market.href,
        target: "_blank",
        rel: "noopener noreferrer",
        style: { textDecoration: "none", color: "inherit" } as React.CSSProperties,
      }
    : {};
  return (
    <Tag className="market-row" {...props}>
      <div className="market-main">
        <PoolIcon symbol={market.symbol} protocol={market.protocol} category={market.category} />
        <div>
          <strong>{market.symbol}</strong>
          <span>{market.protocol}</span>
        </div>
      </div>
      <ChainBadge chain={market.chain} />
      <span className="desktop-cell">{market.category}</span>
      <span className="desktop-cell">{formatUsd(market.tvl)}</span>
      <span className="rate-cell">{formatPct(market.apy)}</span>
      <span className={(market.apy7d ?? 0) >= 0 ? "delta-good" : "delta-bad"}>
        {market.apy7d == null ? "—" : formatPct(market.apy7d, true)}
      </span>
      <span className="safety-meter" aria-label={`Safety ${market.safety}`}>
        <i style={{ width: `${Math.max(4, Math.min(100, market.safety))}%` }} />
      </span>
    </Tag>
  );
}

export function MiniLine({
  points,
  accent = "#6ee7b7",
  height = 70,
}: {
  points: number[];
  accent?: string;
  height?: number;
}) {
  const width = 220;
  const safe = points.filter((p) => Number.isFinite(p));
  if (safe.length < 2) {
    return (
      <svg className="mini-line" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="trend line" />
    );
  }
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = max - min || 1;
  const d = safe
    .map((point, index) => {
      const x = (index / (safe.length - 1)) * width;
      const y = height - ((point - min) / range) * (height - 10) - 5;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg className="mini-line" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="trend line">
      <path d={d} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
      <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill={accent} opacity="0.12" />
    </svg>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="section-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {body ? <p>{body}</p> : null}
      </div>
      {action ? (
        <Link className="icon-link" href={action.href}>
          {action.label}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

export function CommandStrip({
  file,
  items,
}: {
  file: string;
  items: Array<{ label: string; value: string; tone?: "ok" | "warn" | "danger" | "info" }>;
}) {
  return (
    <div className="command-strip" aria-label={`${file} route status`}>
      <span className="command-file">{file}</span>
      {items.map((item) => (
        <span className={`command-chip tone-${item.tone ?? "info"}`} key={`${item.label}-${item.value}`}>
          <em>{item.label}</em>
          <strong>{item.value}</strong>
        </span>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  icon: Icon,
  action,
}: {
  title: string;
  body: string;
  icon: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon size={28} strokeWidth={1.8} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{body}</span>
      {action}
    </div>
  );
}
