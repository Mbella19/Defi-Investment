# Repository Guidelines

## Project Structure & Module Organization

This is a private Next.js 16.2.x and React 19 TypeScript app for DeFi yield discovery, strategy generation, wallet-scoped monitoring, plan-gated analytics, crypto checkout, and smart-contract/security review. App Router routes live in `src/app`, with `src/app/(landing)` for the public landing route, `src/app/(app)` for the terminal pages, and API handlers under `src/app/api`. Shared UI is organized by surface in `src/components/site`, `src/components/sovereign`, `src/components/notifications`, `src/components/providers`, and `src/components/wallet`.

Business logic lives in `src/lib`: `security/` for protocol scoring, audit orchestration, deployer forensics, and exploit monitoring; `wallet/` for wagmi/RainbowKit and balance aggregation; `plans/` for tier capabilities and usage; `payments/` for quote creation and on-chain payment verification; `tools/` for simulator/correlation utilities. Shared contracts belong in `src/types`, reusable client hooks in `src/hooks`, static assets in `public`, and ad-hoc review/backtest scripts in `scripts`.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`; npm is the canonical package manager.
- `npm run dev`: start the local Next.js dev server, normally at `http://localhost:3000`.
- `npm run build`: compile and type-check the production app.
- `npm run start`: run the built app after `npm run build`.
- `npm run lint`: run ESLint with Next.js core-web-vitals and TypeScript rules.
- `npx tsc --noEmit`: standalone type-check when a faster compiler-only pass is useful.

No automated test runner is configured. For code changes, run `npm run lint` and `npm run build` before handing off unless the change is docs-only or the environment blocks the command.

## Architecture Notes

Wallet-scoped data is protected by SIWE. Use `requireWallet(request)` for routes that read or mutate user strategies, alerts, portfolio data, plan state, or payment quotes. Never trust client-supplied wallet addresses for authorization; scope by the `sov_session` cookie. Use `requireCapability(wallet, capability)` for plan-gated features. Current tiers are Free, Pro, and Ultra: Free gets 2 monthly strategy generations and audit access; Pro unlocks simulator, correlation, portfolio lens, real-time alerts, risk selection, and stablecoin-only sleeves; Ultra adds custom APY mode, the full strategist council, expanded alert channels, and priority support.

Long-running strategy and audit work uses in-memory job stores (`src/lib/strategy-jobs.ts`, `src/lib/security/audit/jobs.ts`) with polling endpoints. Strategy generation always performs protocol ground-truth and triple-model security analysis, then uses tier-aware strategy depth: solo proposer for Free, proposer plus Gemini review for Pro, and proposer plus Codex/Gemini review for Ultra. The monitor has two entry points: authenticated manual scans at `POST /api/strategies/monitor`, and Vercel Cron at `GET /api/cron/monitor` with `Authorization: Bearer ${CRON_SECRET}`.

Use `fetchWithTimeout` and `warnUpstream` for external upstreams, `getRpcUrl(chainId)` for viem clients, `boundCache` for long-lived process caches, and `safeFetch` for caller-influenced URLs. Keep AI JSON parsing on the shared `extractJson` / `tripleExtractJson` helpers rather than ad-hoc `JSON.parse`.

## Coding Style & Naming Conventions

Use TypeScript with `strict` enabled. Prefer 2-space indentation, double quotes, semicolons, and named exports for shared library functions. React components use PascalCase filenames, for example `AlertBell.tsx` or `SiteShell.tsx`. Hooks use `useX` naming, such as `usePlan.ts` and `useActiveStrategies.ts`. Keep data contracts in `src/types` and import internal modules with the `@/` alias. Mark interactive components with `"use client"` only when client-side state, effects, wallet hooks, or browser APIs are required.

React Compiler is enabled in `next.config.ts`; do not add memoization just for routine render performance. Prefer existing site/sovereign UI primitives and current CSS conventions over introducing a new component system.

## Testing Guidelines

No automated test framework is currently configured. When adding tests later, colocate them near the feature or under a future test directory using `*.test.ts` or `*.test.tsx`. Mock external APIs and CLIs such as DeFiLlama, CoinGecko, GoPlus, Beefy, Etherscan, wallet providers, Slither, Aderyn, Mythril, Claude, Codex, and Gemini.

For high-risk areas, manually exercise the related route or UI path in addition to lint/build: SIWE auth, strategy generation and polling, plan gates, crypto quote/verify, monitor scans, and audit start/status polling.

## Commit & Pull Request Guidelines

Recent history uses short imperative messages, sometimes with Conventional Commit prefixes such as `feat:`. Prefer concise messages that name the affected area, for example `feat: add strategy alert scheduler` or `Update security audit consensus`. Pull requests should include a brief summary, verification commands run, linked issues when applicable, and screenshots or screen recordings for UI changes.

## Security & Configuration Tips

Keep secrets in `.env.local`; `.env*` files are ignored. Required production values include `SESSION_SECRET`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `AI_MODE=api` with provider keys, `ETHERSCAN_API_KEY`, and `CRON_SECRET` for cron. Optional but important values include `NEXT_PUBLIC_APP_HOST`, `ALCHEMY_API_KEY` or `INFURA_API_KEY`, per-chain `RPC_URL_*`, `DISCORD_WEBHOOK_URL`, `OWNER_WALLETS`, `DATABASE_PATH`, and payment address/RPC overrides.

Do not commit local runtime artifacts such as `.next`, `.playwright-cli`, `sovereign.db`, `sovereign.db-wal`, `sovereign.db-shm`, `sovereign 2.db-*`, or `*.tsbuildinfo`. Treat wallet data, pending payments, subscriptions, security audit outputs, and strategy alerts as sensitive unless explicitly sanitized.
