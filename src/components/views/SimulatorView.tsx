"use client";

import { useMemo, useState } from "react";
import {
  calculateILRange,
  calculateILDetailed,
  calculateNetReturnTable,
} from "@/lib/impermanent-loss";
import { compareCompoundingFrequencies } from "@/lib/yield-simulator";
import { Eyebrow, fmt } from "@/components/sovereign";

type Tab = "il" | "yield";

export default function SimulatorPage() {
  const [tab, setTab] = useState<Tab>("il");

  return (
    <div style={{ padding: "48px 32px", maxWidth: 1280, margin: "0 auto" }}>
      <Hero />
      <TabBar tab={tab} setTab={setTab} />
      {tab === "il" ? <ILCalculatorSection /> : <YieldSimulatorSection />}
    </div>
  );
}

function Hero() {
  return (
    <section style={{ marginBottom: 40 }}>
      <Eyebrow>Financial Instruments</Eyebrow>
      <h1
        className="serif"
        style={{
          fontSize: "clamp(48px, 7vw, 96px)",
          lineHeight: 0.92,
          letterSpacing: "-0.04em",
          marginTop: 20,
          marginBottom: 16,
        }}
      >
        Yield
        <br />
        <span style={{ fontStyle: "italic", color: "var(--accent)" }}>simulator.</span>
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-dim)", maxWidth: 560, lineHeight: 1.6 }}>
        Model impermanent loss on 50/50 LP positions and project compounding yields with gas
        drag. Pure math, no network round-trip.
      </p>
    </section>
  );
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "il", label: "Impermanent Loss" },
    { id: "yield", label: "Compound Yield" },
  ];
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--line)", marginBottom: 32 }}>
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="mono"
            style={{
              padding: "14px 20px",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
              marginBottom: -1,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: active ? "var(--accent)" : "var(--text-dim)",
              cursor: "pointer",
              fontWeight: active ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ==================== IL CALCULATOR ==================== */

function ILCalculatorSection() {
  const [investedAmount, setInvestedAmount] = useState(10000);
  const [priceChange, setPriceChange] = useState(50);
  const [poolApy, setPoolApy] = useState(20);

  const ilCurve = useMemo(() => calculateILRange(-90, 500, 120), []);
  const ilDetail = useMemo(
    () => calculateILDetailed(investedAmount, priceChange),
    [investedAmount, priceChange]
  );
  const netReturnTable = useMemo(
    () => calculateNetReturnTable(investedAmount, poolApy, priceChange),
    [investedAmount, poolApy, priceChange]
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 1fr) 2fr",
        gap: 24,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          className="brackets"
          style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 24 }}
        >
          <Eyebrow>Parameters</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 20 }}>
            <Field label="Invested Amount">
              <MoneyInput value={investedAmount} onChange={setInvestedAmount} />
            </Field>
            <Field label={`Price Change · ${priceChange > 0 ? "+" : ""}${priceChange}%`}>
              <input
                type="range"
                min={-90}
                max={500}
                value={priceChange}
                onChange={(e) => setPriceChange(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--accent)" }}
              />
              <div
                className="mono tabular"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 9,
                  color: "var(--text-dim)",
                  marginTop: 6,
                  letterSpacing: "0.12em",
                }}
              >
                <span>-90%</span>
                <span>0%</span>
                <span>+500%</span>
              </div>
            </Field>
            <Field label="Pool APY · Net Return">
              <input
                type="number"
                value={poolApy}
                onChange={(e) => setPoolApy(Number(e.target.value))}
                className="mono tabular"
                style={inputStyle}
              />
            </Field>
          </div>
        </div>

        <div
          className="brackets"
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: 24,
          }}
        >
          <Eyebrow>Snapshot</Eyebrow>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 1,
              marginTop: 16,
              background: "var(--line)",
              border: "1px solid var(--line)",
            }}
          >
            <ResultCell label="IL %" value={`${ilDetail.impermanentLossPercent}%`} tone="danger" />
            <ResultCell
              label="IL Loss"
              value={fmt.money(Math.abs(ilDetail.dollarLoss))}
              tone="danger"
            />
            <ResultCell label="HODL" value={fmt.money(ilDetail.holdValue)} tone="text" />
            <ResultCell label="LP Value" value={fmt.money(ilDetail.lpValue)} tone="accent" />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <ILCurveChart curve={ilCurve} currentChange={priceChange} />
        <NetReturnTable rows={netReturnTable} />
      </div>
    </div>
  );
}

function ILCurveChart({
  curve,
  currentChange,
}: {
  curve: { priceChange: number; ilPercent: number }[];
  currentChange: number;
}) {
  const width = 1200;
  const height = 280;
  const pad = 40;
  const xs = curve.map((p) => p.priceChange);
  const ys = curve.map((p) => p.ilPercent);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = 2;
  const mapX = (x: number) => pad + ((x - xMin) / (xMax - xMin)) * (width - pad * 2);
  const mapY = (y: number) => pad + ((yMax - y) / (yMax - yMin)) * (height - pad * 2);

  const path = curve.map((p, i) => `${i === 0 ? "M" : "L"} ${mapX(p.priceChange)} ${mapY(p.ilPercent)}`).join(" ");
  const area = `${path} L ${mapX(xMax)} ${height - pad} L ${mapX(xMin)} ${height - pad} Z`;
  const zeroY = mapY(0);
  const currentX = mapX(Math.max(xMin, Math.min(xMax, currentChange)));
  const currentIL =
    curve.find((p) => p.priceChange >= currentChange)?.ilPercent ?? curve[curve.length - 1].ilPercent;
  const currentY = mapY(currentIL);

  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 28 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <Eyebrow>Impermanent Loss Curve</Eyebrow>
          <div className="serif" style={{ fontSize: 24, marginTop: 8, letterSpacing: "-0.02em" }}>
            IL <span style={{ fontStyle: "italic", color: "var(--danger)" }}>vs.</span> price drift
          </div>
        </div>
        <div
          className="mono tabular"
          style={{ fontSize: 13, color: "var(--danger)" }}
        >
          {currentIL.toFixed(2)}% @ {currentChange > 0 ? "+" : ""}{currentChange}%
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="ilGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--danger)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--danger)" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={pad}
            y1={pad + t * (height - pad * 2)}
            x2={width - pad}
            y2={pad + t * (height - pad * 2)}
            stroke="var(--line)"
            strokeDasharray="2 4"
          />
        ))}
        <line
          x1={pad}
          y1={zeroY}
          x2={width - pad}
          y2={zeroY}
          stroke="var(--line-2)"
          strokeWidth="1"
        />
        <path d={area} fill="url(#ilGrad)" />
        <path d={path} stroke="var(--danger)" strokeWidth={1.5} fill="none" />
        <line
          x1={currentX}
          y1={pad}
          x2={currentX}
          y2={height - pad}
          stroke="var(--accent)"
          strokeDasharray="3 3"
        />
        <circle cx={currentX} cy={currentY} r="5" fill="var(--accent)" />
      </svg>
    </div>
  );
}

function NetReturnTable({
  rows,
}: {
  rows: {
    label: string;
    days: number;
    yieldEarned: number;
    ilLoss: number;
    netReturn: number;
    worthIt: boolean;
  }[];
}) {
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 28 }}
    >
      <Eyebrow>Yield vs. IL — Over Time</Eyebrow>
      <div
        className="serif"
        style={{ fontSize: 20, marginTop: 10, marginBottom: 20, letterSpacing: "-0.02em" }}
      >
        Break-even <span style={{ fontStyle: "italic", color: "var(--accent)" }}>horizon</span>
      </div>
      <div style={{ background: "var(--line)", border: "1px solid var(--line)" }}>
        <div
          className="mono"
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr 1fr 1fr 140px",
            gap: 0,
            padding: "12px 16px",
            background: "var(--surface-2)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--text-dim)",
          }}
        >
          <span>Period</span>
          <span style={{ textAlign: "right" }}>Yield</span>
          <span style={{ textAlign: "right" }}>IL Loss</span>
          <span style={{ textAlign: "right" }}>Net</span>
          <span style={{ textAlign: "right" }}>Verdict</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr 1fr 1fr 140px",
              gap: 0,
              padding: "14px 16px",
              background: "var(--surface)",
              borderTop: "1px solid var(--line)",
              alignItems: "center",
            }}
          >
            <span className="mono" style={{ fontSize: 12, color: "var(--text)", letterSpacing: "0.04em" }}>
              {row.label}
            </span>
            <span
              className="mono tabular"
              style={{ fontSize: 13, color: "var(--good)", textAlign: "right" }}
            >
              +{fmt.money(row.yieldEarned)}
            </span>
            <span
              className="mono tabular"
              style={{ fontSize: 13, color: "var(--danger)", textAlign: "right" }}
            >
              −{fmt.money(row.ilLoss)}
            </span>
            <span
              className="mono tabular"
              style={{
                fontSize: 13,
                color: row.netReturn >= 0 ? "var(--good)" : "var(--danger)",
                textAlign: "right",
                fontWeight: 600,
              }}
            >
              {row.netReturn >= 0 ? "+" : ""}
              {fmt.money(row.netReturn)}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: row.worthIt ? "var(--good)" : "var(--danger)",
                textAlign: "right",
                fontWeight: 600,
              }}
            >
              {row.worthIt ? "WORTH IT" : "NOT WORTH IT"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==================== YIELD SIMULATOR ==================== */

function YieldSimulatorSection() {
  const [principal, setPrincipal] = useState(10000);
  const [apy, setApy] = useState(15);
  const [duration, setDuration] = useState(365);
  const [gasPerCompound, setGasPerCompound] = useState(2);

  const comparison = useMemo(
    () => compareCompoundingFrequencies(principal, apy, duration, gasPerCompound),
    [principal, apy, duration, gasPerCompound]
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 1fr) 2fr",
        gap: 24,
      }}
    >
      <div
        className="brackets"
        style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 24 }}
      >
        <Eyebrow>Parameters</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 20 }}>
          <Field label="Investment Amount">
            <MoneyInput value={principal} onChange={setPrincipal} />
          </Field>
          <Field label={`APY · ${apy}%`}>
            <input
              type="range"
              min={1}
              max={200}
              value={apy}
              onChange={(e) => setApy(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
          </Field>
          <Field label={`Duration · ${duration}d (${(duration / 365).toFixed(1)}y)`}>
            <input
              type="range"
              min={30}
              max={1095}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
          </Field>
          <Field label="Gas per Compound">
            <MoneyInput value={gasPerCompound} onChange={setGasPerCompound} />
          </Field>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <GrowthChart comparison={comparison} durationDays={duration} />
        <CompoundTable comparison={comparison} />
      </div>
    </div>
  );
}

const PALETTE = ["#4A5262", "var(--warn)", "var(--good)", "var(--accent)"];

function GrowthChart({
  comparison,
  durationDays,
}: {
  comparison: ReturnType<typeof compareCompoundingFrequencies>;
  durationDays: number;
}) {
  const width = 1200;
  const height = 320;
  const pad = 48;
  const allValues = comparison.flatMap((c) => c.result.dataPoints.map((p) => p.value));
  const yMin = Math.min(...allValues, 0);
  const yMax = Math.max(...allValues);
  const yRange = yMax - yMin || 1;
  const mapX = (x: number) => pad + (x / durationDays) * (width - pad * 2);
  const mapY = (y: number) => pad + ((yMax - y) / yRange) * (height - pad * 2);

  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 28 }}
    >
      <div style={{ marginBottom: 20 }}>
        <Eyebrow>Portfolio Growth</Eyebrow>
        <div className="serif" style={{ fontSize: 24, marginTop: 8, letterSpacing: "-0.02em" }}>
          Compounding <span style={{ fontStyle: "italic", color: "var(--accent)" }}>frequencies</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={pad}
            y1={pad + t * (height - pad * 2)}
            x2={width - pad}
            y2={pad + t * (height - pad * 2)}
            stroke="var(--line)"
            strokeDasharray="2 4"
          />
        ))}
        {comparison.map((c, i) => {
          const path = c.result.dataPoints
            .map((p, idx) => `${idx === 0 ? "M" : "L"} ${mapX(p.day)} ${mapY(p.value)}`)
            .join(" ");
          return <path key={c.frequency} d={path} stroke={PALETTE[i]} strokeWidth={1.5} fill="none" />;
        })}
      </svg>
      <div
        style={{
          display: "flex",
          gap: 20,
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        {comparison.map((c, i) => (
          <div key={c.frequency} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 16, height: 2, background: PALETTE[i] }} />
            <span
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
              }}
            >
              {c.frequency}
            </span>
            <span
              className="mono tabular"
              style={{ fontSize: 11, color: PALETTE[i] }}
            >
              {fmt.money(c.result.finalValue)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompoundTable({
  comparison,
}: {
  comparison: ReturnType<typeof compareCompoundingFrequencies>;
}) {
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 28 }}
    >
      <Eyebrow>Compounding Matrix</Eyebrow>
      <div
        className="serif"
        style={{ fontSize: 20, marginTop: 10, marginBottom: 20, letterSpacing: "-0.02em" }}
      >
        Effective <span style={{ fontStyle: "italic", color: "var(--accent)" }}>APY</span> after gas
      </div>
      <div style={{ background: "var(--line)", border: "1px solid var(--line)" }}>
        <div
          className="mono"
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1fr 1fr 1fr 1fr 120px",
            gap: 0,
            padding: "12px 16px",
            background: "var(--surface-2)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--text-dim)",
          }}
        >
          <span>Frequency</span>
          <span style={{ textAlign: "right" }}>Final</span>
          <span style={{ textAlign: "right" }}>Gross</span>
          <span style={{ textAlign: "right" }}>Gas</span>
          <span style={{ textAlign: "right" }}>Net</span>
          <span style={{ textAlign: "right" }}>eAPY</span>
        </div>
        {comparison.map(({ frequency, result }) => (
          <div
            key={frequency}
            style={{
              display: "grid",
              gridTemplateColumns: "140px 1fr 1fr 1fr 1fr 120px",
              gap: 0,
              padding: "14px 16px",
              background: "var(--surface)",
              borderTop: "1px solid var(--line)",
              alignItems: "center",
            }}
          >
            <span className="mono" style={{ fontSize: 12, color: "var(--text)", letterSpacing: "0.04em" }}>
              {frequency}
            </span>
            <span
              className="mono tabular"
              style={{ fontSize: 13, color: "var(--text)", textAlign: "right" }}
            >
              {fmt.money(result.finalValue)}
            </span>
            <span
              className="mono tabular"
              style={{ fontSize: 13, color: "var(--good)", textAlign: "right" }}
            >
              +{fmt.money(result.grossReturn)}
            </span>
            <span
              className="mono tabular"
              style={{ fontSize: 13, color: "var(--danger)", textAlign: "right" }}
            >
              {result.totalGasCost > 0 ? `−${fmt.money(result.totalGasCost)}` : "—"}
            </span>
            <span
              className="mono tabular"
              style={{
                fontSize: 13,
                color: result.netReturn >= 0 ? "var(--good)" : "var(--danger)",
                textAlign: "right",
                fontWeight: 600,
              }}
            >
              {result.netReturn >= 0 ? "+" : ""}
              {fmt.money(result.netReturn)}
            </span>
            <span
              className="mono tabular"
              style={{ fontSize: 14, color: "var(--accent)", textAlign: "right", fontWeight: 600 }}
            >
              {result.effectiveApy.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==================== shared ==================== */

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--surface-2)",
  border: "1px solid var(--line)",
  padding: "12px 14px",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
  letterSpacing: "0.02em",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
          marginBottom: 10,
          display: "block",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function MoneyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ position: "relative" }}>
      <span
        className="mono"
        style={{
          position: "absolute",
          left: 14,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--text-dim)",
          fontSize: 13,
        }}
      >
        $
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mono tabular"
        style={{ ...inputStyle, paddingLeft: 28 }}
      />
    </div>
  );
}

function ResultCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "accent" | "danger" | "text";
}) {
  const color =
    tone === "accent" ? "var(--accent)" : tone === "danger" ? "var(--danger)" : "var(--text)";
  return (
    <div style={{ background: "var(--surface)", padding: 16 }}>
      <Eyebrow>{label}</Eyebrow>
      <div
        className="serif tabular"
        style={{ fontSize: 22, marginTop: 8, letterSpacing: "-0.02em", color }}
      >
        {value}
      </div>
    </div>
  );
}
