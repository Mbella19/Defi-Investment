import { createHash } from "crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import type { AuditReport, ConsensusFinding } from "@/types/audit";

export const dynamic = "force-dynamic";

const VERDICT_LABEL: Record<AuditReport["verdict"], string> = {
  clean: "Low risk",
  review: "Review recommended",
  dangerous: "Dangerous",
  critical: "Critical risk",
};

const VERDICT_COLOR: Record<AuditReport["verdict"], string> = {
  clean: "#6ee7b7",
  review: "#fbbf24",
  dangerous: "#fb7185",
  critical: "#ef4444",
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function loadSharedReport(token: string): AuditReport | null {
  // Token format guard before it touches SQL parameters.
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) return null;
  try {
    const hash = createHash("sha256").update(token).digest("hex");
    const row = getDb()
      .prepare(
        `SELECT aj.result_json FROM audit_shares s
         JOIN audit_jobs aj ON aj.id = s.job_id
         WHERE s.token_hash = ? AND s.revoked_at IS NULL
           AND datetime(s.expires_at) > datetime('now')
           AND aj.status = 'done' AND aj.result_json IS NOT NULL`,
      )
      .get(hash) as { result_json: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.result_json) as AuditReport;
  } catch {
    return null;
  }
}

// Gives shared links a real <title>/description for link unfurls. Note:
// Next streams dynamic pages (metadata included), so a bad token renders the
// not-found UI in-stream with HTTP 200 — the status code can't change after
// the shell flushes. Acceptable here: tokens are unguessable and unlinked,
// and humans see the correct 404 page.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = loadSharedReport(token);
  if (!report) notFound();
  return {
    title: `${report.meta.contractName || report.contractAddress} — contract review · Sovereign`,
    description: report.executiveSummary.slice(0, 160),
    robots: { index: false, follow: false },
  };
}

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = loadSharedReport(token);
  if (!report) notFound();

  const color = VERDICT_COLOR[report.verdict] ?? "#fbbf24";
  const cleanCoverage = report.coverage?.sufficientForCleanVerdict ?? false;
  const findings = [...report.findings].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5),
  );
  const counts = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="page" style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
      <div className="page-title">
        <div>
          <p className="eyebrow">Shared contract review</p>
          <h1 style={{ marginBottom: 6 }}>
            {report.meta.contractName || "Unverified contract"}
          </h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
            {report.contractAddress} · {report.chainName} · reviewed{" "}
            {new Date(report.finishedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 18,
          alignItems: "center",
          padding: "18px 22px",
          border: `1px solid ${color}`,
          borderRadius: 10,
          margin: "18px 0",
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 700, color }}>{report.riskScore}</div>
        <div>
          <div style={{ fontWeight: 700, color }}>{VERDICT_LABEL[report.verdict]}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Risk score out of 100 — higher is riskier.{" "}
            {Object.entries(counts)
              .map(([sev, n]) => `${n} ${sev}`)
              .join(", ") ||
              (cleanCoverage
                ? "No findings surfaced within completed coverage"
                : "No findings surfaced, but coverage was incomplete")}
            .
          </div>
        </div>
      </div>

      <section style={{ margin: "22px 0" }}>
        <p className="eyebrow">Executive summary</p>
        <p style={{ lineHeight: 1.65 }}>{report.executiveSummary}</p>
      </section>

      <section style={{ margin: "22px 0" }}>
        <p className="eyebrow">
          Standards coverage — {report.scsvs.summary.passed}/{report.scsvs.summary.total} SCSVS
          checks pass · {report.scsvs.summary.failed} fail · {report.scsvs.summary.indeterminate}{" "}
          indeterminate
        </p>
      </section>

      {findings.length > 0 ? (
        <section style={{ margin: "22px 0" }}>
          <p className="eyebrow">Findings ({findings.length})</p>
          <div style={{ display: "grid", gap: 12 }}>
            {findings.slice(0, 25).map((f: ConsensusFinding) => (
              <div
                key={f.id}
                style={{
                  border: "1px solid var(--line, #2a313d)",
                  borderRadius: 8,
                  padding: "14px 16px",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <strong style={{ textTransform: "uppercase", fontSize: 11, color }}>
                    {f.severity}
                  </strong>
                  <strong>{f.title}</strong>
                  {f.filePath ? (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)" }}>
                      {f.filePath}
                      {f.startLine ? `:${f.startLine}` : ""}
                    </span>
                  ) : null}
                </div>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 0", lineHeight: 1.55 }}>
                  {(f.aiExplanation?.whatHappened || f.description || "").slice(0, 400)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {report.recommendations.length > 0 ? (
        <section style={{ margin: "22px 0" }}>
          <p className="eyebrow">Recommendations</p>
          <ul style={{ lineHeight: 1.7, paddingLeft: 18 }}>
            {report.recommendations.map((rec, i) => (
              <li key={i} style={{ fontSize: 14 }}>
                {rec}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div
        style={{
          margin: "34px 0 10px",
          padding: "18px 22px",
          border: "1px solid var(--line, #2a313d)",
          borderRadius: 10,
          fontSize: 13,
          color: "var(--muted)",
          lineHeight: 1.6,
        }}
      >
        This automated multi-engine review (static analysis, symbolic execution, on-chain
        interrogation, and AI consensus explanation) is informational only — not an audit
        certification and not financial advice. Generated by{" "}
        <Link href="/" style={{ color: "var(--mint, #5AE4D4)" }}>
          Sovereign
        </Link>
        . Run your own review at{" "}
        <Link href="/security/audit" style={{ color: "var(--mint, #5AE4D4)" }}>
          /security/audit
        </Link>
        .
      </div>
    </div>
  );
}
