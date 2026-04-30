# Sovereign Investment Group: Gemini Agent Guide

This file is the repo-specific operating guide for Gemini and other AI coding
agents working inside Sovereign Investment Group. Keep it aligned with the
actual codebase; do not treat older dashboard, scanner, or risk-module names as
authoritative if they are not present in `src/`.

## Project Identity

Sovereign Investment Group is a private Next.js 16.2.x / React 19 TypeScript
application for read-only DeFi intelligence:

- live yield discovery from DeFiLlama and Beefy;
- wallet-scoped portfolio views and active strategy monitoring;
- tier-aware AI strategy generation with Claude, Codex, and Gemini;
- smart-contract and protocol security review;
- Free, Pro, and Ultra plans with on-chain crypto checkout.

The product must stay non-custodial. It can analyze, score, quote, monitor, and
surface wallet transactions, but it should never take custody of funds or hide a
transaction from the user.

## Stack

- Framework: Next.js App Router, React 19, React Compiler enabled in
  `next.config.ts`.
- Language: TypeScript with strict mode.
- Styling: Tailwind CSS 4 plus global site CSS in `src/app/globals.css`.
- Web3: wagmi, viem, RainbowKit, WalletConnect.
- Data fetching/cache: React Query on the client, in-process Maps on the server.
- Persistence: `better-sqlite3`, loaded as a server external package.
- Icons/UI: lucide-react, local SVG/PNG assets in `public/`.
- Charts/math: Recharts plus local tools in `src/lib/tools/`.

Use npm. The supported commands are:

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
npx tsc --noEmit
```

There is no automated test runner. For code changes, run `npm run lint` and
`npm run build` before handing off unless the task is docs-only or the
environment blocks the command.

## Current User-Facing Routes

- `/`: landing page with live market metrics, pixel safe hero, feature dock,
  security signals, and social links.
- `/discover`: market discovery view for yield pools.
- `/portfolio`: read-only wallet portfolio view.
- `/strategies`: strategy composer, generated draft display, active mandates,
  pause/resume/archive/delete, and manual scans.
- `/security/audit`: smart-contract audit console.
- `/tools`: workspace tools index.
- `/tools/simulator`: Pro/Ultra scenario simulator.
- `/tools/correlation`: Pro/Ultra APY correlation matrix.
- `/plans`: Free, Pro, Ultra pricing and feature matrix.
- `/plans/checkout`: crypto checkout for Pro and Ultra.

The shared app chrome lives in `src/components/site/SiteShell.tsx`. Branding is
handled by `BrandMark`, social art by `SocialIcon`, token/pool visuals by
`PoolIcon`, and the pixel background by `PixelField`.

## API Surface

Important API handlers under `src/app/api`:

- Auth: `/api/auth/nonce`, `/api/auth/verify`, `/api/auth/logout`,
  `/api/auth/me`.
- Plan state: `/api/me/plan`.
- Payments: `/api/payments/quote`, `/api/payments/verify`,
  `/api/payments/native-prices`.
- Strategy generation: `/api/strategy`.
- Active strategies: `/api/strategies`, `/api/strategies/[id]`,
  `/api/strategies/alerts`, `/api/strategies/forecast`,
  `/api/strategies/monitor`.
- Cron monitoring: `/api/cron/monitor`.
- Portfolio: `/api/portfolio/balances`.
- Tools: `/api/tools/simulate`, `/api/tools/correlation`.
- Security: `/api/analyze`, `/api/security/audit/start`,
  `/api/security/audit/status`, `/api/security/alerts`,
  `/api/security/forensics`.
- Live yields: `/api/yields/live`.

Wallet-scoped routes must derive the wallet from the signed `sov_session`
cookie via `requireWallet(request)`. Never authorize from client-supplied wallet
addresses.

## Directory Map

- `src/app/(landing)`: public landing route.
- `src/app/(app)`: terminal pages for discover, portfolio, strategies,
  security, tools, and plans.
- `src/app/api`: route handlers.
- `src/components/site`: current site shell, app UI primitives, brand/social
  visuals, paywall, wallet button.
- `src/components/sovereign`: terminal visual primitives still reused by parts
  of the app.
- `src/components/providers`: wagmi, RainbowKit, React Query, SIWE providers.
- `src/components/notifications`: alert bell and alert dropdown.
- `src/components/wallet`: wallet connection UI.
- `src/hooks`: client hooks such as `usePlan`, `useSiweAuth`,
  `useActiveStrategies`, `usePortfolio`, and `useStrategyAlerts`.
- `src/lib/auth`: SIWE nonce/session verification.
- `src/lib/security`: AI scoring, source audit, deployer forensics, exploit
  monitor, and multi-engine audit pipeline.
- `src/lib/plans`: tier capabilities, subscription resolution, usage counters.
- `src/lib/payments`: payment pair config, quotes, pricing, and chain-specific
  transaction verification.
- `src/lib/wallet`: chain config, token lists, balance fetching, portfolio math.
- `src/lib/tools`: pool history, simulator, correlation utilities.
- `src/types`: shared TypeScript contracts.
- `scripts`: ad-hoc Codex/Gemini review scripts and drain backtest.
- `public`: brand, social, visual, and framework static assets.

## Auth And Sessions

SIWE login is implemented in `src/lib/auth`. The session cookie is an
HMAC-signed JSON blob named `sov_session` with a 24-hour TTL. The cookie stores
the lower-case wallet address and expiration.

Rules:

- `SESSION_SECRET` is required and must be at least 32 characters.
- Domain, URI host, SIWE version, chain ID, nonce, issued time, expiration, and
  signature are verified in `verifySiweMessage`.
- Nonces are consumed before signature verification to prevent replay.
- Protected routes should return immediately if `requireWallet` returns a
  response.

## Plans And Capability Gates

Plans are defined in `src/lib/plans/access.ts`.

- Free: 2 monthly strategy generations, solo strategist mode, audit access.
- Pro: 20 monthly generations, Gemini review, risk-band selection,
  stablecoin-only sleeves, realtime alerts, simulator, correlation, portfolio
  lens, Discord alerts.
- Ultra: 60 monthly generations, Codex plus Gemini council review,
  custom APY range, expanded alert channels, priority support.

Use capability gates, not scattered tier checks:

- server: `requireCapability(wallet, "capabilityName")`;
- client: `usePlan().capabilities`;
- owner bypass: `OWNER_WALLETS` resolves listed lower-case EVM wallets to Ultra.

Strategy usage is recorded in `strategy_generations` when a generation job is
created, even if the user never activates the draft.

## Strategy Engine

The generation API is `src/app/api/strategy/route.ts`; the core engine is
`src/lib/strategist.ts`.

Pipeline:

1. Fetch DeFiLlama protocols and enriched DeFiLlama/Beefy pools.
2. Filter by budget, TVL, APY range, risk appetite, stablecoin preference, and
   APY stability gates.
3. Run protocol analysis through `analyzeProtocol`, which gathers ground-truth
   facts and sends prompts through the triple-AI scoring flow.
4. Claude proposes the allocation.
5. Depending on plan capability, Gemini and/or Codex review it.
6. Claude revises when reviewer concerns need a fix.
7. The result is returned through an in-memory job store.

Modes:

- `solo`: proposer only, used by Free.
- `dual`: proposer plus Gemini review, used by Pro.
- `council`: proposer plus Codex and Gemini review, used by Ultra.

The generated strategy should preserve the collaboration trail so the UI can
show reviewer concerns, decisions, and revisions.

## Active Monitoring

Active strategies are persisted in SQLite and scoped by wallet. Monitoring lives
in `src/lib/strategy-monitor.ts`, with helper logic in `src/lib/monitor.ts`,
`src/lib/monitor-scheduler.ts`, and `src/lib/security/exploit-monitor.ts`.

Manual scans:

- `POST /api/strategies/monitor`;
- require SIWE auth;
- require `realtimeAlerts`;
- scan only the caller's active strategies.

Cron scans:

- `GET /api/cron/monitor`;
- protected by `Authorization: Bearer ${CRON_SECRET}` in production;
- scans all active strategies.

Alerts are written to `strategy_alerts`, deduplicated over a 24-hour window, and
can be sent to Discord if `DISCORD_WEBHOOK_URL` is configured.

## Security And Audit Systems

Protocol scoring is in `src/lib/anthropic.ts` and `src/lib/security`.

Ground-truth facts include:

- audit-link reachability with SSRF-safe redirect handling;
- recent exploit alerts in SQLite;
- protocol TVL crash checks;
- cached source-audit and deployer-forensics data.

Triple-AI helpers live in `src/lib/security/dual-llm.ts`. They call Claude,
Codex, and Gemini in parallel and tolerate partial failures. Use
`tripleInvoke`, `tripleExtractJson`, and shared `extractJson` helpers rather
than ad-hoc model calls or brittle JSON parsing.

Smart-contract audit flow is orchestrated by
`src/lib/security/audit/orchestrator.ts`:

1. fetch verified source from Etherscan;
2. materialize a temporary workspace;
3. read live contract state with viem;
4. run Slither, Aderyn, Mythril, and on-chain checks;
5. build consensus findings;
6. add triple-AI explanations;
7. map to OWASP SCSVS v12;
8. assemble an `AuditReport`.

Analyzer failures must degrade gracefully. A missing binary should create
warnings or indeterminate coverage, not crash the entire report.

## Payments And Subscriptions

Checkout is non-custodial and lives at `/plans/checkout?tier=pro|ultra`.
Server code is under `src/lib/payments` and `src/app/api/payments`.

Supported configured pairs:

- ETH, USDC, and USDT on Ethereum;
- USDC and USDT on BNB Chain;
- BTC on Bitcoin;
- SOL on Solana;
- Tron USDC/USDT only when `PAYMENT_ADDRESS_TRON` is set.

Payment flow:

1. `GET /api/payments/quote` returns enabled pairs and tier prices, but never
   recipient addresses.
2. `POST /api/payments/quote` requires SIWE auth, creates a 30-minute
   wallet-scoped quote, stores it in `pending_payments`, and returns recipient
   plus amount for that quote.
3. EVM payments are sent through wagmi; non-EVM payments use manual tx-hash
   verification.
4. `POST /api/payments/verify` checks wallet ownership, quote status,
   expiration, duplicate tx hashes, recipient, amount, and confirmations.
5. Confirmed payments call `activateSubscription` and extend the subscription by
   30 days.

Keep EVM contract and recipient addresses all-lowercase in config unless they
are valid EIP-55 checksums. Do not render the EVM recipient as ordinary
copy/paste UI; it should flow into wagmi transaction params.

## Database

`src/lib/db.ts` opens `DATABASE_PATH` or `sovereign.db`, enables WAL and foreign
keys, and runs inline migrations on first connection.

Current eager tables:

- `schema_migrations`;
- `active_strategies`;
- `strategy_alerts`;
- `strategy_breach_state`;
- `subscriptions`;
- `pending_payments`;
- `strategy_generations`.

The exploit monitor lazily creates `exploit_alerts`. If you add schema, update
the existing migration path. Use parameterized statements only.

SQLite and in-process Maps are prototype-grade for multi-instance production.
For durable production deployment, move persistence, rate limits, jobs, and
long-lived caches to managed infrastructure.

## External Data And Utilities

Use existing utilities before adding new fetch logic:

- `fetchWithTimeout` and `warnUpstream` for upstream APIs.
- `boundCache` before writing to long-lived process caches.
- `getRpcUrl(chainId)` for viem clients.
- `safeFetch` logic in ground-truth code for caller-influenced URLs.
- DeFiLlama helpers in `src/lib/defillama.ts`.
- Beefy helpers in `src/lib/beefy.ts`.
- CoinGecko helpers in `src/lib/coingecko.ts`.
- GoPlus helpers in `src/lib/goplus.ts`.
- Etherscan helpers in `src/lib/security/etherscan.ts`.

Public RPC fallbacks are acceptable for local development but should not be
relied on for production traffic.

## UI And Brand Guidelines

The current aesthetic is a dark, pixel-terminal DeFi console:

- black/charcoal surfaces with grid and pixel accents;
- neon green, blue, yellow, and red signal colors;
- compact command strips, metric tiles, boost panels, and icon-led controls;
- branded Sovereign Investment Group logo in the nav;
- social icons from `public/social`;
- pool/token symbols rendered by `PoolIcon` instead of generic gradient slashes.

When changing UI, reuse `src/components/site` primitives and existing global CSS
classes before introducing a new component system. Keep pages useful as
application surfaces, not marketing-only landers.

## Coding Rules

- Use strict TypeScript. Avoid `any`, `ts-ignore`, and broad casts.
- Prefer named exports for shared library functions.
- Use the `@/` alias for internal imports.
- Mark components `"use client"` only when they need state, effects, wallet
  hooks, or browser APIs.
- Keep secrets and privileged work on the server.
- Do not trust client-supplied wallet addresses for authorization.
- Do not bare-fetch expensive upstreams; add timeouts and graceful degradation.
- Do not introduce new payment, auth, or monitor behavior without server-side
  validation.
- Do not make AI outputs self-authorizing. Apply deterministic validation and
  heuristic vetoes after model output.
- Preserve user data and local changes. Never revert unrelated edits.

## Environment Notes

Minimum local setup usually needs:

- `SESSION_SECRET`;
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`;
- `ETHERSCAN_API_KEY`;
- either local AI CLIs with `AI_MODE=cli` or API keys with `AI_MODE=api`.

Recommended production settings:

- `AI_MODE=api` plus provider keys;
- `CRON_SECRET`;
- `NEXT_PUBLIC_APP_HOST`;
- `ALCHEMY_API_KEY`, `INFURA_API_KEY`, or per-chain `RPC_URL_*`;
- `DISCORD_WEBHOOK_URL` if alerts should post externally;
- `OWNER_WALLETS` for project-owner testing;
- payment address/RPC overrides as needed.

Never commit `.env*`, `.next`, `.playwright-cli`, SQLite DB files, WAL/SHM
artifacts, or `*.tsbuildinfo`.
