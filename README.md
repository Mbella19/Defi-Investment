# Sovereign Investment Group

Sovereign is a private, read-only DeFi intelligence terminal for yield discovery, wallet-scoped strategy generation, monitoring, portfolio analysis, EVM subscription checkout, and smart-contract review. It uses Next.js 16.2, React 19, TypeScript, wagmi/viem, and SQLite.

## Product surfaces

- Live DeFiLlama yield discovery with bounded, compressed SQLite caching and stale-on-outage fallback.
- Tier-aware strategy generation backed by protocol ground truth and independent Codex/Gemini security review. AI-proposed pools and metrics are reconciled to the server-side catalogue before a strategy can be saved.
- Wallet-owned active strategies with APY/TVL, protocol TVL, on-chain pause, and chain-aware exploit monitoring.
- Durable alert incidents and a retrying notification outbox for email, Telegram, Slack, and Discord. Channel endpoints are encrypted at rest.
- Contract review using verified source, Slither, Aderyn, Mythril, on-chain interrogation, consensus grouping, and SCSVS mapping. Missing coverage is reported as unknown—not clean.
- A seven-chain, read-only EVM portfolio lens scoped to the SIWE wallet.
- APY-change correlation and a deterministic block-bootstrap scenario simulator. These tools are estimates and do not model every shared dependency or loss mechanism.
- Free, Pro, and Ultra plans with server-enforced capability and monthly usage limits.
- EVM-only checkout: ETH/USDC/USDT on Ethereum and USDC/USDT on BSC.

## Runtime model

This build intentionally targets one long-lived Node process with one persistent SQLite database. Do not run multiple application instances against copied databases, and do not deploy the database on ephemeral serverless storage.

SQLite stores sessions, nonces, rate limits, usage reservations, job payloads/results/leases, strategies, incidents, alert delivery attempts, payment quotes, subscriptions, AI telemetry, and public-data caches. In-process timers wake the durable workers and monitoring sweep; an external cron can call the protected cron route as a backup. If the process is stopped, work resumes from SQLite after the next start/request, but no monitoring can occur while the machine is offline.

## Requirements

- Node.js 22.13+ and npm.
- A persistent local filesystem for `DATABASE_PATH`.
- `SESSION_SECRET` of at least 32 characters.
- A real WalletConnect project ID for production.
- Codex and Gemini CLI binaries in development-only CLI mode, or their API keys in API mode. Production rejects CLI mode because protocol text is attacker-influenced and local agent CLIs are not a production isolation boundary.
- An Etherscan V2 key for contract source and on-chain review.
- Reliable RPC access through Alchemy, Infura, or explicit per-chain URLs.
- Optional Slither, Aderyn, and Mythril binaries. Their absence reduces reported audit coverage.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

The database defaults to `sovereign.db` in the repository root. Runtime artifacts and `.env.local` are ignored and must never be committed.

## Production deployment

Use a process supervisor such as systemd or pm2 and put the app behind one trusted TLS reverse proxy.

```bash
npm ci
npm run check:env
npm test
npm run lint
npm run build
npm run start
```

Operational requirements:

1. Set `DATABASE_PATH` to an absolute path on a backed-up persistent volume. Back up the database and its WAL consistently while the app is stopped or through SQLite's backup API.
2. Set `NEXT_PUBLIC_APP_HOST` to the canonical HTTPS origin. Only enable `TRUST_PROXY_HEADERS=true` when the app is reachable exclusively through a proxy that overwrites forwarded headers. When it is false, anonymous clients deliberately share one conservative direct-connection rate-limit bucket; this prevents header spoofing but can make one abusive client affect public availability.
3. Set `PAYMENT_ADDRESS_EVM` to the merchant wallet. There is no baked-in recipient fallback; an unset or invalid address disables every payment rail.
4. Configure `CRON_SECRET` and call `GET /api/cron/monitor` with `Authorization: Bearer <secret>` every 15 minutes if using an external scheduler.
5. Monitor disk space, SQLite backup success, job failures, dead alert-outbox rows, and AI usage/cost telemetry.
6. Exercise SIWE, one strategy job, one audit, each enabled notification channel, and a small real payment on every enabled chain before launch.

This repository does not include Docker, Postgres, Redis, or a hosted queue by design. Horizontal scaling requires a deliberate storage/worker redesign; copying this SQLite deployment across instances is unsafe.

## Configuration

See [.env.example](.env.example). Important values include:

- `SESSION_SECRET`: opaque session, CSRF, and default encryption-key material; at least 32 characters.
- `CHANNEL_ENCRYPTION_KEY`: optional dedicated stable key for notification endpoints. Set it before collecting channels and retain it across deployments.
- `AUDIT_SHARE_SECRET`: optional dedicated key for deterministic public-share capabilities. Retain it while links should remain valid.
- `NEXT_PUBLIC_APP_HOST`: canonical origin used for SIWE and origin checks.
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: required and non-placeholder in production.
- `AI_MODE=api`, `OPENAI_API_KEY`, and `GEMINI_API_KEY` for API mode.
- `OPENAI_*_USD_PER_MILLION` and `GEMINI_*_USD_PER_MILLION`: optional rates used only for cost telemetry; prompts and outputs are not stored in telemetry.
- `ETHERSCAN_API_KEY` and RPC configuration.
- `PAYMENT_ADDRESS_EVM`: enables the EVM checkout rails.
- `RESEND_API_KEY`, Telegram settings, and optional ops `DISCORD_WEBHOOK_URL`.
- `CRON_SECRET`: required when the external cron endpoint is used in production.
- `OWNER_WALLETS`, `ENABLE_DEV_LOGIN`, and `DEV_LOGIN_SECRET`: optional local staff bypass controls. The bypass requires a separate 32+ character secret and is disabled in production/Vercel.

## Plans

- Free: 2 strategy generations per month, 2 contract reviews per month, and solo strategy proposal.
- Pro ($49/month): 20 strategies, 20 reviews, Gemini strategy review, risk selection, stablecoin-only sleeves, monitoring, portfolio lens, simulator, correlation, and Discord alerts.
- Ultra ($149/month): 60 strategies, unlimited reviews, Codex plus Gemini strategy council, custom APY mode, expanded channels, and priority support.

Usage is reserved atomically when a durable job is created. A retry with the same idempotency key returns the existing job rather than charging twice. Failed work remains billable once execution has started; reservations released before job creation do not count.

## Payments

Checkout lives at `/plans/checkout?tier=pro|ultra`.

- Quotes are bound to the authenticated SIWE wallet, chain, token contract, merchant, live unit price, creation time, and expiry.
- Verification requires the transaction sender to match the SIWE wallet, an exact-or-greater transfer, a payment block inside the quote window, and the configured confirmation count.
- Confirmed transaction hashes are unique per chain. Pending hashes cannot permanently squat a transaction.
- An active Ultra subscription is not downgraded by a Pro payment. Pro-equivalent value extends the active Ultra term.
- Only Ethereum and BSC EVM rails are supported. There is no manual transaction-hash flow for Bitcoin, Solana, or Tron.

## Security model

- SIWE issues random opaque sessions stored hashed in SQLite. The production session cookie is `__Host-`, `Secure`, `HttpOnly`, and `SameSite=Strict`; the paired readable CSRF cookie is also `__Host-`, `Secure`, and `SameSite=Strict`. State changes require that session-bound token plus canonical-origin validation.
- Nonces are one-time and persistent. Rate limits are persistent and wallet/IP scoped. Proxy headers are ignored unless explicitly trusted.
- Wallet-owned routes derive authorization from the session, never from a caller-supplied wallet address.
- External caller-influenced URLs use the guarded fetch path. Provider calls have bounded timeouts.
- Notification endpoints use AES-256-GCM at rest; verification codes are keyed hashes. API responses expose only redacted channel labels.
- Audit-share capabilities are hashed at rest, expire after 30 days, are owner-revocable, and are excluded from search indexing.
- Security reports distinguish unavailable coverage from a clean result. Automated agreement cannot claim formal proof.
- Production security headers include CSP, HSTS, clickjacking protection, MIME sniffing protection, and a restrictive permissions policy.

## Monitoring semantics

APY/TVL breaches must persist for two scans. A durable incident opens once, is not re-notified while ongoing, and can notify again only after recovery. Protocol and exploit matching is chain-aware. Exploit drain signals are refreshed on the normal scheduler path without sending a cross-wallet holdings set to an AI model. Per-user deliveries are placed in SQLite before sending and retry with bounded backoff.

`POST /api/strategies/monitor` is the authenticated manual trigger. `GET /api/cron/monitor` is the all-wallet operator trigger and requires `CRON_SECRET` in production.

## Verification commands

```bash
npm run check:env   # validates production-oriented configuration without printing secrets
npm test            # Vitest
npm run lint        # ESLint
npx tsc --noEmit    # standalone TypeScript check after Next type generation
npm run build       # production compile/type gate
npm audit --omit=dev
```

## Accepted product risks

- Strategy audit shortcuts use the protocol-level canonical address reported by DeFiLlama. That address may differ from a specific pool's vault, market, or strategy contract, so users must verify the intended contract before treating an audit as pool-specific.
- This software is analysis tooling, not investment advice, custody, execution, or a guarantee against loss. APY, TVL, token prices, security signals, and model output can be stale or wrong.
- The simulator and APY correlation tool are scenario aids, not forecasts. They do not fully model token-price covariance, impermanent loss, liquidations, gas, taxes, slippage, bridge risk, or composability dependencies.
- Public landing-page claims, example incident figures, social/community links, SMS channel metadata, and other marketing placeholders have intentionally not been changed in this engineering pass. They require owner/legal verification or implementation before a public commercial launch.
- Local single-process operation is an intentional constraint. Availability is limited by that machine and its backup/monitoring discipline.

## Repository layout

```text
src/app/(landing)/          public landing and shared-report pages
src/app/(app)/              authenticated terminal pages
src/app/api/                auth, strategy, audit, tools, payment, and cron routes
src/components/             wallet, provider, notification, and product UI
src/lib/security/           protocol scoring, audit, on-chain, and exploit logic
src/lib/wallet/             EVM chain/token balance aggregation
src/lib/payments/           quote, price, verifier, and reconciliation logic
src/lib/plans/              tier capability, subscription, and usage logic
src/lib/tools/              history, scenario, and correlation calculations
test/                       Vitest unit tests
scripts/                    review and backtest utilities
```

Private / unpublished. Do not redistribute without permission.
