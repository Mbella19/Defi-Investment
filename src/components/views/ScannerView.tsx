"use client";

import { useState } from "react";
import { useChains } from "@/hooks/useChains";
import { RISK_PROFILES, getRiskDescription } from "@/lib/risk";
import { fmt, Eyebrow, Icons } from "@/components/sovereign";
import type { RiskAppetite, AssetType } from "@/types/scanner";

const PRESETS = [1000, 5000, 10000, 50000, 100000];
const RISKS: RiskAppetite[] = ["low", "medium", "high"];

export interface ScanCriteria {
  budget: number;
  risk: RiskAppetite;
  asset: AssetType;
  chain: string | null;
}

interface ScannerViewProps {
  onScan: (criteria: ScanCriteria) => void;
}

export default function ScannerView({ onScan }: ScannerViewProps) {
  const { chains, isLoading: chainsLoading } = useChains();
  const [budget, setBudget] = useState<number>(10000);
  const [risk, setRisk] = useState<RiskAppetite>("low");
  const [asset, setAsset] = useState<AssetType>("stablecoins");
  const [chain, setChain] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isScanning = false;

  const profile = RISK_PROFILES[risk];
  const riskInfo = getRiskDescription(risk);

  const submit = () => {
    setError(null);
    onScan({ budget, risk, asset, chain });
  };

  return (
    <div style={{ padding: "40px 48px 96px", maxWidth: 1440, margin: "0 auto" }}>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: 48,
          alignItems: "end",
          marginBottom: 56,
        }}
      >
        <div>
          <Eyebrow>Yield Scanner / Scan.001</Eyebrow>
          <h1
            className="serif"
            style={{
              fontSize: "clamp(56px, 7vw, 104px)",
              fontWeight: 900,
              letterSpacing: "-0.055em",
              lineHeight: 0.92,
              margin: "24px 0 20px",
              color: "var(--text)",
            }}
          >
            Yield
            <br />
            <span style={{ color: "var(--accent)", fontStyle: "italic" }}>Scanner.</span>
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-dim)",
              lineHeight: 1.65,
              maxWidth: 560,
            }}
          >
            Set your investment parameters and let the intelligence engine scan 10,000+
            yield opportunities across DeFi. Data sourced from DeFiLlama and Beefy, enriched
            with GoPlus contract security and CoinGecko market data.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 2,
            background: "var(--line)",
            border: "1px solid var(--line)",
          }}
        >
          {[
            { label: "Pools", value: "10,000+" },
            { label: "Chains", value: "120+" },
            { label: "Protocols", value: "3,000+" },
          ].map((s) => (
            <div
              key={s.label}
              style={{ background: "var(--surface)", padding: "20px 18px" }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  color: "var(--text-dim)",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                {s.label}
              </div>
              <div
                className="serif"
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: "var(--text)",
                  letterSpacing: "-0.03em",
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 48 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          {[
            { step: "01", label: "Set your criteria" },
            { step: "02", label: "Scan yield surface" },
            { step: "03", label: "AI verifies protocols" },
          ].map((item) => (
            <div
              key={item.step}
              style={{
                border: "1px solid var(--line)",
                background: "var(--surface)",
                padding: "20px 22px",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span
                className="mono"
                style={{
                  width: 40,
                  height: 40,
                  border: "1px solid var(--accent)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  letterSpacing: "0.05em",
                  flexShrink: 0,
                }}
              >
                {item.step}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text)",
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div>
            <Eyebrow>Investment Budget</Eyebrow>
            <div style={{ position: "relative", marginTop: 16 }}>
              <span
                className="mono"
                style={{
                  position: "absolute",
                  left: 18,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-dim)",
                  fontSize: 20,
                }}
              >
                $
              </span>
              <input
                type="text"
                value={budget.toLocaleString("en-US")}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  const num = parseInt(raw) || 0;
                  setBudget(Math.min(num, 100_000_000));
                }}
                className="serif"
                style={{
                  width: "100%",
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  fontSize: 32,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  padding: "18px 18px 18px 42px",
                  color: "var(--text)",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {PRESETS.map((p) => {
                const active = budget === p;
                return (
                  <button
                    key={p}
                    onClick={() => setBudget(p)}
                    className="mono"
                    style={{
                      padding: "8px 14px",
                      border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                      background: active ? "var(--accent-soft)" : "transparent",
                      color: active ? "var(--accent)" : "var(--text-dim)",
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    ${p.toLocaleString("en-US")}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Eyebrow color="var(--danger)">Risk Appetite</Eyebrow>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                marginTop: 16,
              }}
            >
              {RISKS.map((r) => {
                const info = getRiskDescription(r);
                const active = risk === r;
                return (
                  <button
                    key={r}
                    onClick={() => setRisk(r)}
                    style={{
                      textAlign: "left",
                      padding: "20px 20px 22px",
                      background: active ? "var(--surface-2)" : "var(--surface)",
                      border: "1px solid var(--line)",
                      borderBottom: `2px solid ${
                        active ? "var(--accent)" : "transparent"
                      }`,
                      cursor: "pointer",
                      transition: "border-color 0.2s",
                    }}
                  >
                    <div
                      className="mono"
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: active ? "var(--accent)" : "var(--text-dim)",
                        marginBottom: 12,
                      }}
                    >
                      {info.label}
                    </div>
                    <div
                      className="serif"
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        letterSpacing: "-0.03em",
                        color: "var(--text)",
                        marginBottom: 10,
                      }}
                    >
                      {info.apyRange}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-dim)",
                        lineHeight: 1.5,
                        marginBottom: 12,
                      }}
                    >
                      {info.description}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--text-dim)",
                      }}
                    >
                      Min TVL: {info.minTvl}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Eyebrow>Asset Class</Eyebrow>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 12,
                marginTop: 16,
              }}
            >
              {[
                { id: "stablecoins" as AssetType, label: "Stablecoins Only", hint: "Low-vol, pegged" },
                { id: "all" as AssetType, label: "All Assets", hint: "Full surface" },
              ].map((a) => {
                const active = asset === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setAsset(a.id)}
                    style={{
                      textAlign: "left",
                      padding: "18px 20px",
                      background: active ? "var(--surface-2)" : "var(--surface)",
                      border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      className="mono"
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: active ? "var(--accent)" : "var(--text)",
                        marginBottom: 6,
                      }}
                    >
                      {a.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-dim)",
                      }}
                    >
                      {a.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Eyebrow>Network</Eyebrow>
            <select
              value={chain || ""}
              onChange={(e) => setChain(e.target.value || null)}
              className="mono"
              style={{
                width: "100%",
                marginTop: 16,
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                color: "var(--text)",
                fontSize: 12,
                padding: "14px 16px",
                letterSpacing: "0.06em",
                outline: "none",
                appearance: "none",
                cursor: "pointer",
              }}
            >
              <option value="">All Networks</option>
              {chainsLoading ? (
                <option disabled>Loading chains…</option>
              ) : (
                chains.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({fmt.money(c.tvl)})
                  </option>
                ))
              )}
            </select>
          </div>

          {error && (
            <div
              style={{
                border: "1px solid var(--danger)",
                background: "color-mix(in oklab, var(--danger) 12%, transparent)",
                padding: "16px 18px",
                color: "var(--danger)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={isScanning || budget <= 0}
            className="mono"
            style={{
              width: "100%",
              padding: "20px 24px",
              background: "var(--accent)",
              color: "var(--bg)",
              border: "1px solid var(--accent)",
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 600,
              cursor: isScanning || budget <= 0 ? "not-allowed" : "pointer",
              opacity: isScanning || budget <= 0 ? 0.55 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            {isScanning ? (
              <>
                <Icons.refresh />
                Scanning DeFi Protocols…
              </>
            ) : (
              <>
                <Icons.search />
                Scan DeFi Yields
                <Icons.arrow />
              </>
            )}
          </button>
        </div>

        <aside
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: 28,
            height: "fit-content",
            position: "sticky",
            top: 96,
          }}
          className="brackets"
        >
          <Eyebrow>Scan Parameters</Eyebrow>

          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginBottom: 8,
                }}
              >
                Budget
              </div>
              <div
                className="serif"
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: "var(--text)",
                }}
              >
                {fmt.dollar(budget)}
              </div>
            </div>

            <div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginBottom: 8,
                }}
              >
                Risk Profile
              </div>
              <div
                className="serif"
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  color: "var(--accent)",
                }}
              >
                {riskInfo.label}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  color: "var(--text-dim)",
                  marginTop: 4,
                  letterSpacing: "0.06em",
                }}
              >
                {riskInfo.apyRange} APY target
              </div>
            </div>

            <div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginBottom: 8,
                }}
              >
                Assets
              </div>
              <div style={{ fontSize: 13, color: "var(--text)" }}>
                {asset === "stablecoins" ? "Stablecoins Only" : "All Assets"}
              </div>
            </div>

            <div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginBottom: 8,
                }}
              >
                Network
              </div>
              <div style={{ fontSize: 13, color: "var(--text)" }}>
                {chain || "All Networks"}
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid var(--line)",
                paddingTop: 20,
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginBottom: 10,
                }}
              >
                Filter Preview
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-dim)",
                  lineHeight: 1.6,
                }}
              >
                Scanning {asset === "stablecoins" ? "stablecoin" : "all"} pools
                {chain ? ` on ${chain}` : " across all networks"} with{" "}
                {`>`}
                {fmt.money(profile.minTvl)} TVL, targeting {riskInfo.apyRange} APY.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
