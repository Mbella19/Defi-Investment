"use client";

import { useEffect, useState } from "react";

type Pool = { name: string; apy: string; angle: number };

const pools: Pool[] = [
  { name: "Aave", apy: "4.82", angle: 0 },
  { name: "Morpho", apy: "6.44", angle: 60 },
  { name: "Pendle", apy: "12.18", angle: 120 },
  { name: "Spark", apy: "5.12", angle: 180 },
  { name: "Convex", apy: "11.02", angle: 240 },
  { name: "Ethena", apy: "18.62", angle: 300 },
];

export function OrbitalHero() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPhase((p) => p + 1), 60);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        position: "relative",
        height: 560,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="grid-bg"
        style={{ position: "absolute", inset: 0, opacity: 0.4 }}
      />

      {[220, 320, 440].map((r, i) => (
        <div
          key={r}
          style={{
            position: "absolute",
            width: r,
            height: r,
            border: "1px solid var(--line-2)",
            borderRadius: "50%",
            opacity: 0.3 + i * 0.15,
            animation: `orbit ${40 + i * 15}s linear infinite ${
              i % 2 ? "reverse" : ""
            }`,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 6,
              height: 6,
              background: "var(--accent)",
              borderRadius: "50%",
              top: -3,
              left: "50%",
              boxShadow: "0 0 16px var(--accent)",
              transform: `translateX(-50%) rotate(${i * 40}deg)`,
            }}
          />
        </div>
      ))}

      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 180,
            height: 180,
            border: "1px solid var(--accent)",
            borderRadius: "50%",
            animation: "pulse-ring 3.5s ease-out infinite",
            animationDelay: `${i * 1.1}s`,
            opacity: 0,
          }}
        />
      ))}

      {pools.map((p) => {
        const a = ((p.angle + phase * 0.3) * Math.PI) / 180;
        const R = 220;
        const x = Math.cos(a) * R;
        const y = Math.sin(a) * R;
        return (
          <div
            key={p.name}
            style={{
              position: "absolute",
              transform: `translate(${x}px, ${y}px)`,
            }}
          >
            <div
              className="mono"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--line-2)",
                padding: "8px 14px",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                boxShadow: "0 0 24px -6px var(--accent)",
              }}
            >
              <div style={{ color: "var(--text-dim)", fontSize: 9 }}>{p.name}</div>
              <div style={{ color: "var(--accent)", fontSize: 13, fontWeight: 500 }}>
                {p.apy}%
              </div>
            </div>
          </div>
        );
      })}

      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: "radial-gradient(circle, var(--accent-soft), transparent 70%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "var(--bg)",
            border: "1px solid var(--accent)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "inset 0 0 40px var(--accent-soft), 0 0 60px -10px var(--accent)",
          }}
        >
          <div
            className="serif"
            style={{
              fontSize: 44,
              fontWeight: 900,
              color: "var(--accent)",
              letterSpacing: "-0.06em",
              lineHeight: 1,
            }}
          >
            AI
          </div>
          <div
            className="mono"
            style={{
              fontSize: 9,
              color: "var(--text-dim)",
              letterSpacing: "0.2em",
              marginTop: 4,
            }}
          >
            SOVEREIGN
          </div>
          <div
            className="mono"
            style={{
              fontSize: 9,
              color: "var(--text-dim)",
              letterSpacing: "0.2em",
            }}
          >
            CORE
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrbitalHero;
