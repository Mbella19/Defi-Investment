import type { PortfolioPosition, AlertConfig, DEFAULT_ALERT_CONFIG } from "@/types/portfolio";
import type { InvestmentStrategy } from "@/types/strategy";

const KEYS = {
  portfolio: "sovereign_portfolio",
  alerts: "sovereign_alerts",
  strategies: "sovereign_strategies",
} as const;

function save<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    console.error(`Failed to save to localStorage: ${key}`);
  }
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Portfolio positions
export function savePortfolio(positions: PortfolioPosition[]): void {
  save(KEYS.portfolio, positions);
}

export function loadPortfolio(): PortfolioPosition[] {
  return load<PortfolioPosition[]>(KEYS.portfolio, []);
}

export function addPosition(position: PortfolioPosition): void {
  const positions = loadPortfolio();
  positions.push(position);
  savePortfolio(positions);
}

export function removePosition(id: string): void {
  const positions = loadPortfolio().filter((p) => p.id !== id);
  savePortfolio(positions);
}

// Alert config
export function saveAlertConfig(config: AlertConfig): void {
  save(KEYS.alerts, config);
}

export function loadAlertConfig(): AlertConfig {
  return load<AlertConfig>(KEYS.alerts, {
    apyDropWarning: 20,
    apyDropCritical: 50,
    tvlDrainWarning: 30,
    tvlDrainCritical: 50,
  });
}

// Saved strategies
export function saveStrategy(strategy: InvestmentStrategy & { criteria?: { budget: number; riskAppetite: string } }): void {
  const strategies = loadStrategies();
  strategies.unshift(strategy);
  // Keep last 20 strategies
  if (strategies.length > 20) strategies.length = 20;
  save(KEYS.strategies, strategies);
}

export function loadStrategies(): (InvestmentStrategy & { criteria?: { budget: number; riskAppetite: string } })[] {
  return load(KEYS.strategies, []);
}

export function clearStrategies(): void {
  save(KEYS.strategies, []);
}
