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
  screenScore: number;
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
      <span className="safety-meter" aria-label={`Market screen score ${market.screenScore}`}>
        <i style={{ width: `${Math.max(4, Math.min(100, market.screenScore))}%` }} />
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

export type StatusTone = "ok" | "warn" | "danger" | "info";

export interface ConsoleChip {
  label: string;
  value: string;
  tone?: StatusTone;
}

export interface TapeStat {
  label: string;
  value: string;
  tone?: StatusTone | "plain";
}

/**
 * Full-width instrument panel: bezel rail (file tag + status chips +
 * right-aligned telemetry tape) over a padded body. One per page.
 */
export function Console({
  file,
  chips = [],
  tape = [],
  children,
}: {
  file: string;
  chips?: ConsoleChip[];
  tape?: TapeStat[];
  children: React.ReactNode;
}) {
  return (
    <section className="desk">
      <header className="desk-bezel" aria-label={`${file} console status`}>
        <span className="command-file">{file}</span>
        {chips.map((chip) => (
          <span className={`command-chip tone-${chip.tone ?? "info"}`} key={chip.label}>
            <em>{chip.label}</em>
            <strong>{chip.value}</strong>
          </span>
        ))}
        {tape.length > 0 ? (
          <span className="desk-tape">
            {tape.map((stat) => (
              <span className="tape-item" data-tone={stat.tone ?? "plain"} key={stat.label}>
                {stat.label}
                <b>{stat.value}</b>
              </span>
            ))}
          </span>
        ) : null}
      </header>
      <div className="desk-body">{children}</div>
    </section>
  );
}

export type PipelineState = "idle" | "active" | "done" | "error";

export interface PipelineStep {
  key: string;
  label: string;
  state: PipelineState;
  detail?: string;
}

export interface PipelinePhase {
  key: string;
  label: string;
  /** Job stage identifiers this phase covers, in emit order. */
  stages: string[];
}

/** Map a job's status + current stage onto pipeline step states. */
export function phasedSteps(
  phases: PipelinePhase[],
  status: "idle" | "running" | "done" | "error",
  stage?: string,
): PipelineStep[] {
  const found = phases.findIndex((phase) => phase.stages.includes(stage ?? ""));
  const active = found === -1 ? 0 : found;
  return phases.map((phase, index) => {
    let state: PipelineState = "idle";
    if (status === "done") {
      state = "done";
    } else if (status === "running") {
      state = index < active ? "done" : index === active ? "active" : "idle";
    } else if (status === "error") {
      state = index < active ? "done" : index === active ? "error" : "idle";
    }
    return { key: phase.key, label: phase.label, state };
  });
}

/** The stages of a run, lit as they execute. */
export function PipelineRail({ steps }: { steps: PipelineStep[] }) {
  return (
    <ol className="pipeline">
      {steps.map((step, index) => (
        <li className="pipeline-step" data-state={step.state} key={step.key}>
          <i>{String(index + 1).padStart(2, "0")}</i>
          <strong>{step.label}</strong>
          {step.detail ? <span>{step.detail}</span> : null}
        </li>
      ))}
    </ol>
  );
}

/** Section header for the records below a console. */
export function BookHeader({
  index,
  title,
  meta,
  actions,
}: {
  index?: string;
  title: string;
  meta?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="book-header">
      <div className="book-header-main">
        {index ? <span className="book-index">{index}</span> : null}
        <h2>{title}</h2>
        {meta ? <span className="book-meta">{meta}</span> : null}
      </div>
      {actions ? <div className="filter-row">{actions}</div> : null}
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
