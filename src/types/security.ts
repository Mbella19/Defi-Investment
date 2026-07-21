export type ExploitAlertSeverity = "critical" | "high" | "medium" | "low";

export interface ExploitAlert {
  id: string;
  source: "heuristic";
  alertId: string;
  protocol: string | null;
  address: string | null;
  chainId: number | null;
  severity: ExploitAlertSeverity;
  name: string;
  description: string;
  txHash: string | null;
  detectedAt: number;
  raw: Record<string, unknown>;
}
