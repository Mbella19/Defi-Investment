export interface HackEvent {
  id: string;
  name: string;
  date: string;
  target: string;
  classification: string;
  technique: string;
  amount: number;
  chain: string[];
  bridgeHack: boolean;
  returnedFunds: number | null;
}

export interface FundingRound {
  name: string;
  date: string;
  amount: number | null;
  round: string | null;
  category: string;
  leadInvestors: string[];
  otherInvestors: string[];
  chains: string[];
}

export type ApyTrend = "rising" | "stable" | "declining";

export interface SentimentProfile {
  protocol: string;
  hackHistory: HackEvent[];
  totalHackLoss: number;
  fundingRounds: FundingRound[];
  totalFundingRaised: number;
  apyTrend: ApyTrend;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  riskSignals: string[];
  positiveSignals: string[];
}
