# Sovereign Investment Group

A read-only DeFi intelligence terminal for yield discovery, strategy design, portfolio oversight, monitoring, and contract security review. Built with Next.js 16.2.x, React 19, the React Compiler, TypeScript, Tailwind 4, `wagmi` / `viem`, RainbowKit, and `better-sqlite3`.

The app combines live DeFiLlama/Beefy market data with tier-aware AI strategy generation, SIWE-scoped user data, plan-gated analytics, crypto subscription checkout, and a multi-engine audit workflow.

## What it does

- **Live yield discovery**: ranks DeFiLlama pools by TVL, APY, chain, category, stability, and safety. The landing and `/discover` views use cached live feeds and graceful stale fallbacks.
- **Tier-aware strategy engine**: filters by budget, APY, risk, TVL, stablecoin preference, recent APY volatility, and long-horizon APY stability. Protocols receive triple-model security analysis with ground-truth checks and heuristic vetoes. Strategy review depth scales by tier: Free = solo strategist, Pro = Gemini review, Ultra = Codex + Gemini review.
- **Active strategy monitoring**: stores accepted allocations by authenticated wallet, scans active strategies for APY drops, TVL drains, protocol-wide TVL crashes, paused contracts, and exploit alerts, then persists unread alerts and optionally posts Discord webhooks.
- **Security review console**: audits a contract with verified source fetch, Slither, Aderyn, Mythril, viem on-chain interrogation, consensus grouping, triple-AI explanations, and OWASP SCSVS v12 mapping. Missing analyzer binaries degrade to indeterminate coverage instead of aborting the report.
- **Portfolio and tools**: Pro/Ultra users get a read-only wallet portfolio lens across Ethereum, Arbitrum, Optimism, Polygon, Base, BSC, and Avalanche, plus a scenario simulator and APY-correlation matrix.
- **Plans and crypto checkout**: Free, Pro, and Ultra tiers are enforced server-side. Pro/Ultra subscriptions can be activated by on-chain crypto payments with quote creation, transaction verification, and 30-day subscription upsert.

## Requirements

- Node 20+ and npm.
- `SESSION_SECRET` with at least 32 characters.
- WalletConnect Cloud project ID for RainbowKit.
- One of the local `claude`, `codex`, and `gemini` CLIs for local CLI mode, or Anthropic/OpenAI/Google API keys for API mode.
- Etherscan V2 API key for source, creation, transaction, and deployer-forensics calls.
- Recommended: Alchemy, Infura, or explicit per-chain RPC URLs. Public RPC fallbacks work for development but can rate-limit.
- Optional: `slither`, `aderyn`, and `mythril` binaries for fuller audit coverage.
- Optional: Discord webhook for monitor alerts.
- Optional: payment address/RPC overrides for checkout verification.

## Local Dev

```bash
cp .env.example .env.local
# fill in SESSION_SECRET, NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, ETHERSCAN_API_KEY
npm install
npm run dev
```

The SQLite DB is created on first server route hit. By default it writes to `sovereign.db` in the project root; set `DATABASE_PATH` to move it. Deleting the DB is safe during development because schema migrations run on boot.

### Production Mode Locally

```bash
npm run build
npm run start
```

Production mode rejects `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=demo` and hosted runtimes reject AI CLI mode. For a production-like local run, set a real WalletConnect project ID, `AI_MODE=api`, and provider API keys.

## Environment

Minimum useful `.env.local`:

```bash
SESSION_SECRET=...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
ETHERSCAN_API_KEY=...

# Local dev defaults to CLI mode; hosted deployments should use api.
AI_MODE=cli
# AI_MODE=api
# ANTHROPIC_API_KEY=...
# OPENAI_API_KEY=...
# GEMINI_API_KEY=...

# Recommended for wallet, checkout, and on-chain interrogation reliability.
# ALCHEMY_API_KEY=...
# INFURA_API_KEY=...
# RPC_URL_ETHEREUM=...
# RPC_URL_BASE=...
# RPC_URL_ARBITRUM=...
# RPC_URL_OPTIMISM=...
# RPC_URL_POLYGON=...
# RPC_URL_BSC=...
# RPC_URL_AVALANCHE=...

# Production cron and notifications.
CRON_SECRET=...
# DISCORD_WEBHOOK_URL=...

# Plans / payments.
# OWNER_WALLETS=0xabc...,0xdef...
# PAYMENT_ADDRESS_EVM=...
# PAYMENT_ADDRESS_BTC=...
# PAYMENT_ADDRESS_SOL=...
# PAYMENT_ADDRESS_TRON=...
# TRONGRID_API_KEY=...
# SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
# MEMPOOL_API_URL=https://mempool.space/api
```

See `.env.example` for provider-specific model/base URL overrides and all payment options.

## Plans

Plans are defined in `src/lib/plans/access.ts` and returned by `/api/me/plan`.

- **Free**: 2 strategy generations/month, solo strategist mode, full audit access.
- **Pro ($100/month)**: 20 strategy generations/month, Gemini reviewer, risk-band selection, stablecoin-only sleeves, realtime alerts, simulator, correlation matrix, portfolio lens, Discord alerts.
- **Ultra ($200/month)**: 60 strategy generations/month, Codex + Gemini reviewer council, custom APY range, expanded alert channels, and priority support.

`OWNER_WALLETS` is a comma-separated bypass list that always resolves those wallets to Ultra. Strategy generation usage is recorded when a job starts, even if the draft is discarded.

## Payments

Checkout lives at `/plans/checkout?tier=pro|ultra`.

- `GET /api/payments/quote` lists enabled payment pairs without recipient addresses.
- `POST /api/payments/quote` creates a 30-minute wallet-scoped quote.
- `POST /api/payments/verify` verifies the transaction, prevents double-claiming the same tx hash, and activates or extends the subscription by 30 days.

Supported pairs are configured in `src/lib/payments/config.ts`: ETH/USDC/USDT on Ethereum, USDC/USDT on BSC, BTC, SOL, and Tron USDC/USDT when `PAYMENT_ADDRESS_TRON` is set. EVM payments can be sent directly from the checkout with wagmi; BTC/SOL/Tron use manual send plus tx-hash verification.

## Commands

```bash
npm run dev          # next dev
npm run build        # next build, including type-check
npm run start        # next start after build
npm run lint         # eslint
npx tsc --noEmit     # standalone type-check
```

There is no test runner configured. `npm run build` is the canonical compile gate.

## Security Model

- **SIWE auth**: `/api/auth/nonce`, `/api/auth/verify`, `/api/auth/logout`, and `/api/auth/me` issue and clear an HMAC-signed `sov_session` cookie with a 24h TTL.
- **Wallet scoping**: `/api/strategies*`, portfolio, plan, alert, and payment routes use the authenticated wallet from the cookie. Client-supplied wallet params are ignored for authorization.
- **Plan guards**: `requireCapability()` enforces Pro/Ultra features server-side, not just in the UI.
- **Rate limiting**: in-process fixed-window buckets key by authenticated wallet when available, otherwise by IP. Current high-cost caps include strategy 5/h, audit 3/h, analyze/forensics/security alerts 20/h, tools and payments 30/h, and manual monitor scans 10/h.
- **Ground-truth vetoes**: protocol scoring includes audit-link checks, recent exploit alerts, TVL-crash checks, deployer/source-audit cache reads, and deterministic veto ceilings the AI cannot override.
- **SSRF guard**: caller-influenced outbound URLs should go through the safe fetch path in `src/lib/security/ground-truth.ts`.
- **Payment safety**: quotes are wallet-scoped, expire, tolerate only small amount drift, and confirmed transaction hashes are unique.

## Monitoring And Cron

Manual UI scans call `POST /api/strategies/monitor` and are SIWE + Pro/Ultra gated. Vercel Cron calls `GET /api/cron/monitor` every 15 minutes as configured in `vercel.json`; production requires `Authorization: Bearer ${CRON_SECRET}`.

`GET /api/strategies/monitor` is only a health/status endpoint. It reports scheduler state and a stale flag when no scan has run in 30+ minutes.

## Deployment Notes

The app is designed for Vercel-style Node serverless routes, but several stateful parts are prototype-grade:

- SQLite (`better-sqlite3`) stores active strategies, alerts, breach state, subscriptions, pending payments, and usage counters. On Vercel, local files are ephemeral and not region-stable. Replace `src/lib/db.ts` with managed Postgres/Supabase/Neon before real production use.
- Job stores, rate limits, and some caches are in-process `Map`s. Multi-instance deployments should move jobs/limits to durable storage or a queue.
- AI CLI mode is not supported on hosted runtimes. Use `AI_MODE=api` and provider keys.
- Slither/Aderyn/Mythril must exist in the runtime image for full audit coverage. If they are missing, the audit still returns a report with reduced/indeterminate coverage.

## Repo Layout

```text
src/app/(landing)/          public landing route
src/app/(app)/              terminal pages: discover, portfolio, strategies, security, tools, plans
src/app/api/                server routes for auth, yields, strategies, tools, payments, security, cron
src/components/site/        current site shell, landing/app UI primitives, paywall, wallet button
src/components/sovereign/   legacy/terminal visual primitives reused by notifications and views
src/components/providers/   wagmi/RainbowKit/React Query/SIWE providers
src/components/notifications/ alert bell and alert dropdown
src/lib/security/           AI scoring, audit pipeline, source audit, deployer forensics, exploit monitor
src/lib/wallet/             chain config, token lists, balance fetcher, portfolio calculator
src/lib/plans/              tier capabilities, subscription resolution, usage counters
src/lib/payments/           quote creation, pricing, and chain-specific verification
src/lib/tools/              pool history, simulator, correlation
src/types/                  shared TypeScript contracts
scripts/                    ad-hoc Codex/Gemini review helpers and exploit backtest script
vercel.json                 Vercel Cron config for /api/cron/monitor
```

## Scripts

- `scripts/codex-review.sh`: pipe a diff/file/question to Codex GPT-5.5 for a read-only second opinion.
- `scripts/gemini-review.sh`: pipe a diff/file/question to Gemini 3.1 Pro Preview.
- `scripts/backtest-drain.ts`: backtests the drain-detection heuristic against the Euler exploit fixture.

## License

Private / unpublished. Do not redistribute without permission.
