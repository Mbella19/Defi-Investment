import type { ILCalculation } from "@/types/risk-models";

/**
 * Calculate impermanent loss for a 50/50 LP position.
 * priceChangePercent: % change of one token relative to the other.
 * e.g. 100 means the token doubled in price.
 */
export function calculateIL(priceChangePercent: number): number {
  const priceRatio = 1 + priceChangePercent / 100;
  if (priceRatio <= 0) return -1; // total loss
  const il = 2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1;
  return il; // negative number (loss)
}

/**
 * Generate IL curve data points for charting.
 */
export function calculateILRange(
  minChange: number,
  maxChange: number,
  steps: number = 100
): { priceChange: number; ilPercent: number }[] {
  const points: { priceChange: number; ilPercent: number }[] = [];
  const stepSize = (maxChange - minChange) / steps;

  for (let i = 0; i <= steps; i++) {
    const priceChange = minChange + i * stepSize;
    const il = calculateIL(priceChange);
    points.push({
      priceChange: Math.round(priceChange * 100) / 100,
      ilPercent: Math.round(il * 10000) / 100, // as percentage
    });
  }

  return points;
}

/**
 * Full IL calculation with dollar amounts.
 */
export function calculateILDetailed(
  investedAmount: number,
  priceChangePercent: number
): ILCalculation {
  const priceRatio = 1 + priceChangePercent / 100;
  const il = calculateIL(priceChangePercent);

  // If you held 50/50 without LP
  const holdValue = investedAmount * (1 + priceChangePercent / 100 / 2);
  // LP value
  const lpValue = holdValue * (1 + il);
  const dollarLoss = lpValue - holdValue;

  return {
    priceChangePercent,
    impermanentLossPercent: Math.round(il * 10000) / 100,
    dollarLoss: Math.round(dollarLoss * 100) / 100,
    holdValue: Math.round(holdValue * 100) / 100,
    lpValue: Math.round(lpValue * 100) / 100,
  };
}

/**
 * Calculate net return: APY yield minus IL.
 */
export function calculateNetReturn(
  investedAmount: number,
  apy: number,
  priceChangePercent: number,
  durationDays: number
): {
  yieldEarned: number;
  ilLoss: number;
  netReturn: number;
  netApy: number;
  worthIt: boolean;
} {
  const years = durationDays / 365;
  const yieldEarned = investedAmount * (apy / 100) * years;
  const ilData = calculateILDetailed(investedAmount, priceChangePercent);
  const ilLoss = Math.abs(ilData.dollarLoss);
  const netReturn = yieldEarned - ilLoss;
  const netApy = (netReturn / investedAmount) / years * 100;

  return {
    yieldEarned: Math.round(yieldEarned * 100) / 100,
    ilLoss: Math.round(ilLoss * 100) / 100,
    netReturn: Math.round(netReturn * 100) / 100,
    netApy: Math.round(netApy * 100) / 100,
    worthIt: netReturn > 0,
  };
}

/**
 * Generate net return comparison at various time horizons.
 */
export function calculateNetReturnTable(
  investedAmount: number,
  apy: number,
  priceChangePercent: number
): { label: string; days: number; yieldEarned: number; ilLoss: number; netReturn: number; worthIt: boolean }[] {
  const horizons = [
    { label: "30 Days", days: 30 },
    { label: "90 Days", days: 90 },
    { label: "180 Days", days: 180 },
    { label: "1 Year", days: 365 },
    { label: "2 Years", days: 730 },
  ];

  return horizons.map((h) => {
    const result = calculateNetReturn(investedAmount, apy, priceChangePercent, h.days);
    return { label: h.label, days: h.days, ...result };
  });
}
