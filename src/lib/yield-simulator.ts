export interface SimulationParams {
  principal: number;
  apy: number;
  durationDays: number;
  compoundFrequency: "daily" | "weekly" | "monthly" | "none";
  gasPerCompound: number;
}

export interface SimulationResult {
  grossReturn: number;
  totalGasCost: number;
  netReturn: number;
  effectiveApy: number;
  finalValue: number;
  dataPoints: { day: number; value: number }[];
}

const COMPOUNDS_PER_YEAR: Record<SimulationParams["compoundFrequency"], number> = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  none: 1,
};

export function simulateYield(params: SimulationParams): SimulationResult {
  const { principal, apy, durationDays, compoundFrequency, gasPerCompound } = params;
  const years = durationDays / 365;
  const periodsPerYear = COMPOUNDS_PER_YEAR[compoundFrequency];
  const totalPeriods = Math.floor(periodsPerYear * years);
  const ratePerPeriod = apy / 100 / periodsPerYear;

  // Calculate compounded value
  let value = principal;
  const dataPoints: { day: number; value: number }[] = [{ day: 0, value: principal }];
  const daysPerPeriod = compoundFrequency === "none" ? durationDays : 365 / periodsPerYear;

  if (compoundFrequency === "none") {
    // Simple interest
    const finalValue = principal * (1 + apy / 100 * years);
    const grossReturn = finalValue - principal;
    return {
      grossReturn: round(grossReturn),
      totalGasCost: 0,
      netReturn: round(grossReturn),
      effectiveApy: apy,
      finalValue: round(finalValue),
      dataPoints: generateSimplePoints(principal, apy, durationDays),
    };
  }

  let totalGas = 0;
  for (let i = 1; i <= totalPeriods; i++) {
    value = value * (1 + ratePerPeriod) - gasPerCompound;
    totalGas += gasPerCompound;
    const day = Math.round(i * daysPerPeriod);
    if (day <= durationDays) {
      dataPoints.push({ day, value: round(Math.max(value, 0)) });
    }
  }

  // Ensure final day is included
  if (dataPoints[dataPoints.length - 1].day !== durationDays) {
    dataPoints.push({ day: durationDays, value: round(Math.max(value, 0)) });
  }

  const grossReturn = value + totalGas - principal;
  const netReturn = value - principal;
  const effectiveApy = years > 0 ? (Math.pow(Math.max(value, 0) / principal, 1 / years) - 1) * 100 : 0;

  return {
    grossReturn: round(grossReturn),
    totalGasCost: round(totalGas),
    netReturn: round(netReturn),
    effectiveApy: round(effectiveApy),
    finalValue: round(Math.max(value, 0)),
    dataPoints,
  };
}

export function compareCompoundingFrequencies(
  principal: number,
  apy: number,
  durationDays: number,
  gasPerCompound: number
): { frequency: string; result: SimulationResult }[] {
  const frequencies: SimulationParams["compoundFrequency"][] = ["none", "monthly", "weekly", "daily"];
  const labels: Record<string, string> = {
    none: "No Compounding",
    monthly: "Monthly",
    weekly: "Weekly",
    daily: "Daily",
  };

  return frequencies.map((freq) => ({
    frequency: labels[freq],
    result: simulateYield({ principal, apy, durationDays, compoundFrequency: freq, gasPerCompound }),
  }));
}

function generateSimplePoints(principal: number, apy: number, days: number): { day: number; value: number }[] {
  const points: { day: number; value: number }[] = [];
  const step = Math.max(1, Math.floor(days / 100));
  for (let d = 0; d <= days; d += step) {
    points.push({ day: d, value: round(principal * (1 + apy / 100 * d / 365)) });
  }
  if (points[points.length - 1].day !== days) {
    points.push({ day: days, value: round(principal * (1 + apy / 100 * days / 365)) });
  }
  return points;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
