import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const bootErrors = [];
const localEnv = resolve(process.cwd(), ".env.local");
if (existsSync(localEnv)) {
  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(localEnv);
    } else {
      // Node 20.9-20.11 predates process.loadEnvFile. This deliberately
      // supports the common KEY=value subset without printing any value.
      for (const line of readFileSync(localEnv, "utf8").split(/\r?\n/)) {
        const normalized = line.trim().replace(/^export\s+/, "");
        if (!normalized || normalized.startsWith("#")) continue;
        const separator = normalized.indexOf("=");
        if (separator < 1) continue;
        const key = normalized.slice(0, separator).trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
        let parsed = normalized.slice(separator + 1).trim();
        if (
          (parsed.startsWith('"') && parsed.endsWith('"')) ||
          (parsed.startsWith("'") && parsed.endsWith("'"))
        ) {
          parsed = parsed.slice(1, -1);
        } else {
          parsed = parsed.replace(/\s+#.*$/, "").trim();
        }
        process.env[key] = parsed;
      }
    }
  } catch {
    bootErrors.push(".env.local: could not be parsed");
  }
}

const errors = [...bootErrors];
const warnings = [];
const value = (name) => process.env[name]?.trim() ?? "";
const requireValue = (name, message) => {
  if (!value(name)) errors.push(`${name}: ${message}`);
};

if (value("SESSION_SECRET").length < 32) {
  errors.push("SESSION_SECRET: must contain at least 32 characters");
}

const originValues = [
  ["NEXT_PUBLIC_APP_HOST", value("NEXT_PUBLIC_APP_HOST")],
  ["APP_ORIGIN", value("APP_ORIGIN")],
].filter(([, configured]) => configured);
const parsedOrigins = new Map();
if (!value("NEXT_PUBLIC_APP_HOST")) {
  errors.push("NEXT_PUBLIC_APP_HOST: required canonical browser origin");
}
for (const [name, configured] of originValues) {
  try {
    const url = new URL(configured);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
    if (url.origin !== configured.replace(/\/$/, "") || (url.protocol !== "https:" && !local)) {
      errors.push(`${name}: must be a canonical HTTPS origin with no path/query`);
    } else {
      parsedOrigins.set(name, url.origin);
    }
  } catch {
    errors.push(`${name}: must be a valid canonical origin`);
  }
}
if (
  parsedOrigins.has("APP_ORIGIN") &&
  parsedOrigins.get("APP_ORIGIN") !== parsedOrigins.get("NEXT_PUBLIC_APP_HOST")
) {
  errors.push("APP_ORIGIN: must exactly match NEXT_PUBLIC_APP_HOST when both are set");
}

const projectId = value("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
if (!projectId || projectId === "demo") {
  errors.push("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: replace the demo value");
}

requireValue("ETHERSCAN_API_KEY", "required for contract source and on-chain review");

const databasePath = value("DATABASE_PATH");
if (!databasePath || !isAbsolute(databasePath)) {
  errors.push("DATABASE_PATH: use an absolute path on persistent storage");
}

if (!/^0x[a-fA-F0-9]{40}$/.test(value("PAYMENT_ADDRESS_EVM"))) {
  errors.push("PAYMENT_ADDRESS_EVM: required valid EVM merchant address for checkout");
}

const globalAiMode = value("AI_MODE") || "cli";
for (const [provider, key] of [
  ["OPENAI", "OPENAI_API_KEY"],
  ["GEMINI", "GEMINI_API_KEY"],
]) {
  const mode = value(`${provider}_MODE`) || globalAiMode;
  if (mode !== "api" && mode !== "cli") {
    errors.push(`${provider}_MODE: must be api or cli`);
  } else if (mode === "api" && !value(key)) {
    errors.push(`${key}: required while ${provider}_MODE resolves to api`);
  } else if (mode === "cli") {
    errors.push(`${provider}_MODE: production checks require api mode`);
  }
}

const rpcConfigured =
  value("ALCHEMY_API_KEY") ||
  value("INFURA_API_KEY") ||
  [
    "RPC_URL_ETHEREUM",
    "RPC_URL_ARBITRUM",
    "RPC_URL_OPTIMISM",
    "RPC_URL_POLYGON",
    "RPC_URL_BASE",
    "RPC_URL_BSC",
    "RPC_URL_AVALANCHE",
  ].some((name) => value(name));
if (!rpcConfigured) {
  warnings.push("RPC: no private provider configured; public endpoints may rate-limit monitoring and payments");
}

if (!value("CHANNEL_ENCRYPTION_KEY")) {
  warnings.push("CHANNEL_ENCRYPTION_KEY: endpoints will derive from SESSION_SECRET; rotating it will require reconnecting channels");
}
if (!value("AUDIT_SHARE_SECRET")) {
  warnings.push("AUDIT_SHARE_SECRET: share tokens will derive from SESSION_SECRET; rotating it invalidates links");
}
if (!value("CRON_SECRET")) {
  warnings.push("CRON_SECRET: external monitor/reconciliation trigger is disabled");
}
if (!new Set(["", "true", "false"]).has(value("TRUST_PROXY_HEADERS").toLowerCase())) {
  errors.push("TRUST_PROXY_HEADERS: must be true or false");
} else if (value("TRUST_PROXY_HEADERS").toLowerCase() !== "true") {
  warnings.push("TRUST_PROXY_HEADERS: anonymous clients share the conservative direct-connection rate-limit bucket; enable only behind a proxy that overwrites forwarded headers");
}
if (value("ENABLE_DEV_LOGIN").toLowerCase() === "true") {
  errors.push("ENABLE_DEV_LOGIN: must be false in production");
}

for (const warning of warnings) console.warn(`WARN  ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);

if (errors.length > 0) {
  console.error(`Production configuration failed with ${errors.length} error(s).`);
  process.exitCode = 1;
} else {
  console.log(`Production configuration passed with ${warnings.length} warning(s).`);
}
