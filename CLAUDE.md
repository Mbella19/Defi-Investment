# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Next.js 16.2.1 (App Router, Turbopack) · React 19.2 with the React Compiler enabled (`reactCompiler: true` in `next.config.ts` + `babel-plugin-react-compiler`) · TypeScript · Tailwind 4 · `better-sqlite3` for local persistence (declared in `serverExternalPackages` so it isn't bundled) · `wagmi`/`viem`/RainbowKit for wallet UX (also used for in-site EVM payments). Imported `@AGENTS.md` warns: this Next.js has breaking changes vs. training data — consult `node_modules/next/dist/docs/` before changing routing, server actions, or config.

## Commands

```bash
npm run dev        # next dev (Turbopack)
npm run build      # next build — runs full type-check
npm run lint       # eslint (flat config in eslint.config.mjs)
npx tsc --noEmit   # standalone type-check (faster than build)
```

There is no test runner configured. `next build` is the canonical "does it compile" gate — it type-checks and statically generates all pages.

The SQLite DB (`sovereign.db`) is created on first server route hit via `src/lib/db.ts`'s `getDb()`; deleting it is safe (it migrates on next boot). Two DDL paths coexist: `db.ts`'s `migrate()` creates the eager tables (`active_strategies`, `strategy_alerts`, `strategy_breach_state`, `subscriptions`, `pending_payments`, `strategy_generations`) on first connection, while `src/lib/security/exploit-monitor.ts`'s `ensureSchema()` creates `exploit_alerts` lazily on first read. New tables should follow one of those two patterns — don't introduce a third.

## Big-picture architecture

### Three-stage protocol security analysis (`src/lib/anthropic.ts`)

`analyzeProtocol(protocol, pools)` is the security-scoring entry point. It runs three stages:

1. **Triple-AI scoring** — `tripleInvoke` (in `src/lib/security/dual-llm.ts`) fans the same prompt out to Claude Opus 4.7, Codex GPT-5.5 (xhigh), and Gemini 3.1 Pro Preview in parallel via `Promise.allSettled`. Each AI returns its own `legitimacyScore`, `verdict`, `redFlags`, `sections{...}`. Partial failures are tolerated.
2. **Synthesis** — Claude (`invokeClaude` again) reconciles the three outputs with a min-score / most-conservative-verdict bias and an explicit `disagreements[]` array. If synthesis fails, `mechanicalReconcile()` deterministically merges (min score, union flags, average sections) so the analysis still ships.
3. **Heuristic veto** — `applyHeuristicVetoes()` enforces hard ceilings the AI cannot override: recent on-chain exploits, TVL crashes, "avoid"-rated deployers, dangerous source-audit verdicts, all-broken audit links. Each applied veto is recorded on `ProtocolAnalysis.vetoes[]` and prepended to `redFlags` so downstream prompts see it.

Ground-truth facts (`src/lib/security/ground-truth.ts`) are gathered in parallel before stage 1: HEAD-checks each audit link, queries the local `exploit_alerts` table, detects TVL crashes (1d ≤ −40% or 7d ≤ −55%), and reads cached deployer/source-audit data. They're embedded verbatim in the scoring prompt and the synthesis prompt — the AIs are told they MUST engage with them.

Results are cached in-process for 1 hour keyed by protocol slug.

### Strategy generation (`src/lib/strategist.ts`)

`generateStrategy(criteria, opts)` is a separate three-stage pipeline for portfolio construction. `opts.mode` (default `"council"`) controls the reviewer panel and is set by the API layer from the caller's plan tier (see "Plans, paywall, and capability gating" below):

1. **Claude proposer** — fetches DeFiLlama pools + protocols, filters by APY/TVL/risk, runs `analyzeProtocol` on the top 30 protocols (in batches of 5), and asks Claude to compose an initial allocation strategy via `invokeClaudeCli` (local `claude` CLI subprocess). Always runs.
2. **Reviewer panel** —
   - `mode === "solo"` (Free tier): skipped entirely; the architect's proposal is returned with a stub `CollaborationTrail`.
   - `mode === "dual"` (Pro tier): only Gemini reviews via `runReviewer`.
   - `mode === "council"` (Ultra tier): Codex + Gemini both review in parallel. `mergeReviewerCritiques` deduplicates concerns by `category + normalized issue`, escalates severity, and tracks which reviewer(s) flagged each via `sources: ReviewerSource[]`.
   If every available reviewer approved with zero concerns, revision is skipped.
3. **Claude revision** (dual + council only) — Claude rewrites the strategy addressing every high-severity concern. `validateRevisedStrategy` enforces shape + budget tolerance (±1% or $50). `recomputeWeightedApy` ignores the model's stated APY in favour of the actual allocation-weighted average. `concernAddressed` is a deterministic post-hoc check (was the cited pool dropped? was its allocation cut ≥20%? was its reasoning rewritten?) — the AIs cannot self-mark concerns as addressed.

The per-stage trail is preserved on `InvestmentStrategy.collaboration` (`CollaborationTrail`) so the UI can show what each reviewer flagged and what changed.

### Multi-engine smart-contract audit (`src/lib/security/audit/`)

`runMultiEngineAudit(address, chainId)` (in `audit/orchestrator.ts`) is a separate pipeline from `analyzeProtocol` — it audits a contract's source/bytecode, not the protocol's market posture. Stages:

1. **Source fetch** — verified source via `getContractSource` (Etherscan-family).
2. **On-chain interrogation** — `onchain/interrogator.ts` reads live state with `viem` (proxy slots, owner, multisig, timelock).
3. **Static + symbolic tools in parallel** — `tools/slither.ts`, `tools/aderyn.ts`, `tools/mythril.ts`. Missing binaries or unverified source are tolerated; affected SCSVS checks become `indeterminate` instead of aborting the run.
4. **Consensus** — `audit/consensus.ts` groups + dedupes findings across engines and escalates confidence on agreement.
5. **AI explanation** — top-25 findings get `tripleInvoke`'d through Claude/Codex/Gemini for plain-English context. AIs cannot invent new findings — they only annotate what the tools already produced.
6. **SCSVS mapping** — `audit/scsvs.ts` maps findings to OWASP SCSVS v12 categories.

A full audit takes 5–10 minutes, so it runs as a background job (`audit/jobs.ts` — in-memory `Map` with TTL pruning, mirroring `strategy-jobs.ts`); the API exposes `start` + `status` endpoints and the client polls.

### Plans, paywall, and capability gating (`src/lib/plans/`)

Three subscription tiers — Free, Pro ($100/mo), Ultra ($200/mo) — with capabilities defined as a typed map in `src/lib/plans/access.ts` (`TIER_CAPS: Record<Tier, Capabilities>`). Every gated feature is a boolean (or list/number) on `Capabilities`, never an inline tier check, so adding a new gated feature means adding a key to one type.

- `resolveTier(wallet)` reads `subscriptions.expires_at` and returns `"free"|"pro"|"ultra"`. Expired rows fall back to free.
- `isOwnerWallet(wallet)` reads the `OWNER_WALLETS` env var (comma-separated lowercase 0x addresses) and short-circuits to Ultra. Use this for the project owner / staff testing.
- `requireCapability(wallet, capabilityKey)` is the **server-side gate** — returns `{ ok: true }` or `{ ok: false, response }` (a 402). Every paid-feature route calls it after `requireWallet()`.
- `activateSubscription({ wallet, tier, ... })` upserts `subscriptions` with a 30-day expiry (extends from existing expiry if still in the future).

Monthly strategy caps live in `src/lib/plans/usage.ts` — `strategy_generations` is appended-to on every job creation and counted against `TIER_CAPS[tier].monthlyStrategies` per calendar month (UTC).

Client-side: `src/hooks/usePlan.ts` hits `/api/me/plan` and exposes `{ tier, capabilities, isOwner, usage, refetch }`. Pages render `<Paywall>` (`src/components/site/Paywall.tsx`) when a capability is missing; the strategies composer disables risk-band / stable-only / custom-APY controls based on the same flags. The strategist's `mode` is set in `/api/strategy` from `plan.capabilities.strategistMode`, never from the client.

### Crypto payments & subscriptions (`src/lib/payments/`, `src/app/(app)/plans/checkout/`)

Subscriptions are paid in crypto from the SIWE-authed wallet. Supported tokens/chains live in `src/lib/payments/config.ts` (`PAYMENT_PAIRS`):

- **EVM** (in-site send via wagmi): ETH, USDC, USDT on Ethereum (chainId 1) and BSC (56).
- **Non-EVM** (manual paste-tx-hash flow): SOL, BTC, and USDC/USDT on Tron (Tron only enabled if `PAYMENT_ADDRESS_TRON` env is set).

Recipient addresses are loaded from env (`PAYMENT_ADDRESS_EVM` / `PAYMENT_ADDRESS_BTC` / `PAYMENT_ADDRESS_SOL` / `PAYMENT_ADDRESS_TRON`) with hardcoded fallbacks. The `GET /api/payments/quote` response **never includes the recipient address** — only the per-quote POST does, and the address is held in memory for the wagmi flow rather than rendered.

Checkout flow:

1. `POST /api/payments/quote` (`src/lib/payments/quote.ts → createQuote`) prices the tier in the chosen token (USD-pinned for stables, live CoinGecko for ETH/BTC/SOL via `quoteAmount`), inserts a `pending_payments` row with a 30-min expiry, and returns the recipient + amount.
2. **EVM**: the checkout page (`src/app/(app)/plans/checkout/page.tsx`) uses wagmi's `useSendTransaction` (native) or `useWriteContract` (`erc20Abi.transfer`) to send. `useWaitForTransactionReceipt` watches confirmation and auto-submits the hash to verify.
3. **Non-EVM**: address is hidden behind a "Reveal deposit address" button (collapsed by default); user pastes the tx hash from their external wallet manually.
4. `POST /api/payments/verify` looks up the quote, dispatches to the appropriate verifier (`verify-evm.ts` / `verify-tron.ts` / `verify-solana.ts` / `verify-btc.ts`), confirms recipient + amount + sufficient confirmations, then calls `activateSubscription`.

Per-chain verifiers live one-per-file under `src/lib/payments/verify-*.ts` and are dispatched by `verify.ts`. EVM uses viem against `getRpcUrl(chainId)`; Tron hits TronGrid; Solana hits the configured RPC; BTC hits mempool.space. Confirmations: 6 (Ethereum), 12 (BSC), finalized (Solana), 1 block (BTC). Amount comparison uses `compareAmount` in `pricing.ts` with ±0.5% tolerance.

Real-gas display in checkout: gas units come from `useEstimateGas` against `chainId: targetChainId` (runs even when wallet is on the wrong chain — wagmi routes through the configured transport for that chain), per-gas fee from `useEstimateFeesPerGas`, native USD price from `/api/payments/native-prices` (60s server cache, 30s browser cache). If the simulator reverts (no token balance), the fee row falls back to the deterministic typical units (21000 native, 65000 ERC20) and is **labeled "typical"** — never silently mocked.

### Background scheduler & job stores

Two in-memory job stores back the long-running pipelines: `strategy-jobs.ts` for `generateStrategy` and `audit/jobs.ts` for `runMultiEngineAudit`. Both are `Map<id, Job>` with TTL pruning (a periodic `setInterval(...).unref()` sweep on top of the on-write checks) and append-only `events[]` arrays for progress streaming — clients poll `…/status` and render a live event log. New long-running pipelines should follow the same shape.

Alongside them, `monitor-scheduler.ts`'s `ensureSchedulerStarted()` is idempotently invoked from strategy API routes; on first call it spawns a 15-min `setInterval` that runs `monitorActiveStrategies()` to scan stored strategies and write new `strategy_alerts` rows. The scheduler lives inside the Next server process — for serverless deployments, `vercel.json` configures Vercel Cron to POST `/api/cron/monitor` every 15 min instead. That route accepts `Authorization: Bearer ${CRON_SECRET}` (required in prod, optional in dev) and runs one `monitorActiveStrategies()` sweep per invocation. GET on `/api/strategies/monitor` returns scheduler status with a `stale` flag if no scan has run in 30+ min.

### Auth & per-route guards

SIWE (EIP-4361) is the only auth path. The flow:

1. `GET /api/auth/nonce` → `src/lib/auth/nonce-store.ts` issues a single-use 10-min nonce.
2. Client (`src/hooks/useSiweAuth.ts` → `SiweAuthProvider`) signs the EIP-4361 message with the connected wallet.
3. `POST /api/auth/verify` → `src/lib/auth/siwe.ts` regex-parses the message, validates Domain/URI/Version/Chain ID/Issued At against the request Host (`expectedOrigin`), calls viem's `verifyMessage`, consumes the nonce, then `src/lib/auth/session.ts` mints an HMAC-signed `sov_session` cookie (24h TTL, `HttpOnly`, `SameSite=Lax`, `Secure` in prod). No JWT lib — just Node `crypto`.
4. `POST /api/auth/logout` clears the cookie. `GET /api/auth/me` returns `{ wallet }` or null.

The client wiring lives in `SiweAuthProvider` (mounted inside `Web3Provider` so it sits inside `WagmiProvider`). It auto-prompts the SIWE message when a wallet first connects — `useActiveStrategies`, `useStrategyAlerts`, and `usePlan` consume `useSiweAuth()` and gate their fetches on `status === "authed"` so unauthenticated calls don't fire 401s.

`SESSION_SECRET` (≥32 chars) is required — auth-protected routes return 503 if it's unset.

Wallet-scoped routes use `requireWallet(request)` from `src/lib/auth/guard.ts`, which returns either `{ wallet }` or `{ response }` (a 401/503). All `/api/strategies*` routes scope queries by `wallet_address = ?` from the session and **ignore any client-supplied wallet/walletAddress params** — that's the auth boundary, not just a convenience. Paid-feature routes layer `requireCapability()` on top of `requireWallet()`.

### Cron / monitor scheduler

`/api/cron/monitor` (GET, `CRON_SECRET` Bearer-gated) is the production scan entry point — Vercel Cron sends GETs, so the cron lives on its own path rather than sharing `/api/strategies/monitor` (whose GET is a status check). `/api/strategies/monitor` POST is the manual UI trigger and uses `requireWallet` + `requireCapability("realtimeAlerts")` — Free wallets get a 402. Both paths call into `monitorActiveStrategies(strategyId?, wallet?)` in `src/lib/strategy-monitor.ts` — passing `wallet` scopes the scan to that user, the cron path passes neither and scans every active strategy.

### Rate limiting

`enforceRateLimit(request, endpoint, { max, windowMs })` from `src/lib/rate-limit.ts` is a fixed-window token bucket keyed by authenticated wallet (preferred) or IP. Returns `null` to pass, or a 429 `Response` with `Retry-After`. Per-endpoint caps live at the top of each route handler — current values: `strategy` 5/h, `audit` 3/h, `analyze` 20/h, `forensics` 20/h, `tools.*` 30/h, `payments.quote`/`payments.verify` 30/h. The store is in-process — for multi-instance deployments swap to Redis.

### SSRF guard

`safeFetch(url, init)` in `src/lib/security/ground-truth.ts` is the only outbound fetch path used for caller-influenced URLs (audit links, etc.). It enforces scheme allowlist (http/https), rejects literal private IPs (IPv4 RFC1918 + loopback/link-local; IPv6 ULA + loopback), DNS-resolves hostnames and re-checks every resolved address, and follows redirects manually (max 3) re-validating each hop. Use it instead of bare `fetch()` whenever the URL is user-supplied or comes from upstream API responses.

### AI client layer

Each provider has one exported entry point that branches on a runtime mode:

- `src/lib/security/claude-client.ts` → `invokeClaude` (CLI: `claude -p --model claude-opus-4-7 --effort max`; API: Anthropic Messages w/ extended thinking)
- `src/lib/security/codex-client.ts` → `invokeCodex` (CLI: `codex` exec; API: OpenAI Responses, reasoning effort mapped from xhigh→high)
- `src/lib/security/gemini-client.ts` → `invokeGemini` (CLI: `gemini -p` w/ approval-mode plan; API: Generative Language `:generateContent`)

Mode resolution lives in `src/lib/security/ai-mode.ts`. Precedence: per-provider env (`CLAUDE_MODE` / `OPENAI_MODE` / `GEMINI_MODE`) → global `AI_MODE` → default `cli`. API mode requires `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY`; model + base URL are also env-overridable. Local dev defaults to CLI for offline parity; hosted deployments set `AI_MODE=api`. See `.env.example`.

All three accept a prompt and resolve to a string regardless of mode, so callers (`tripleInvoke`, `analyzeProtocol`, `generateStrategy`, audit orchestrator) don't branch. Strategist's local Claude wrapper delegates to `invokeClaude` so it inherits the same switching. `extractJson()` in `claude-client.ts` is the shared JSON extractor — strips markdown fences, returns the outermost balanced `{...}`. Prefer it over ad-hoc parsing when adding a new AI consumer.

Two ad-hoc shell scripts exist for second-opinion review during development: `scripts/codex-review.sh` and `scripts/gemini-review.sh`. They take an instruction arg + optional piped context and print the model's response. Useful for security-review of diffs.

### Routes

App Router with two route groups:

- `src/app/(app)/{discover,portfolio,security,strategies,tools,plans}` — authenticated app pages. `security/audit/` hosts the multi-engine contract auditor UI; `plans/` hosts the pricing page; `plans/checkout/` hosts the wallet-driven crypto checkout.
- `src/app/(landing)` — marketing.
- `src/app/api/*` — server routes (DeFiLlama scan, analyze, strategy, monitor, security/forensics/audit/alerts, portfolio/balances, me/plan, payments/{quote,verify,native-prices}, etc.). All API routes are `ƒ` (dynamic, server-rendered on demand) — none are statically prerendered.

Strategies, alerts, subscriptions, and pending payments persist to SQLite via `getDb()` (`src/lib/db.ts`). The schema migrates on first connection.

### Data sources (mostly free-tier)

DeFiLlama (protocols, pools, TVL), CoinGecko (token market data + native gas-token USD prices for the checkout fee row), GoPlus (contract security), Beefy (auto-compound vaults), Etherscan-family (on-chain deployer forensics + source audits). Each lives in its own `src/lib/<source>.ts` module and exports a typed result + a `formatXForPrompt()` helper used by `analyzeProtocol`.

## Conventions worth knowing

- **Heuristic veto layer is non-negotiable.** When adding new safety rules, prefer extending `applyHeuristicVetoes` over tightening the AI prompt — heuristics are deterministic and survive AI hallucination.
- **Ground-truth before AI.** Any new safety signal that's verifiable from a free API or local DB should land in `gatherGroundTruth` and be formatted into the prompt, not asked of the AI.
- **Partial AI failure must not abort the pipeline.** Both `tripleInvoke` and the strategy reviewer pair are designed for `Promise.allSettled` semantics. Mirror that pattern when adding new AI calls.
- **Use the provided `extractJson` helper.** AI outputs frequently include prose around the JSON; ad-hoc `JSON.parse(text)` will break.
- **Long timeouts are intentional.** Scoring/synthesis use 360s timeouts; strategy proposer/reviser use 600s. The AI CLIs at max effort are slow — don't shorten without a reason.
- **React Compiler is on.** Don't reach for `useMemo` / `useCallback` for performance — the compiler memoizes function components automatically. Hand-written memoization is only justified when memoizing on a value the compiler can't see (e.g., refs, mutable instances).
- **GEMINI.md is the parallel file for Gemini reviews.** The local `gemini` CLI loads it the way Claude loads `CLAUDE.md`. The two have drifted before — when you change architecture-affecting facts here, mirror the relevant bit in `GEMINI.md`, or at least don't let it contradict.
- **Use `fetchWithTimeout` + `warnUpstream` for upstream APIs.** All DeFiLlama / CoinGecko / GoPlus / Beefy / Etherscan calls go through `src/lib/fetch-utils.ts`'s `fetchWithTimeout` (10s default via AbortController) and log failures via `warnUpstream(source, err)`. Don't bare-`fetch()` upstreams — a hung connection will block a route past its `maxDuration`.
- **Use `boundCache(map, maxSize)` before `cache.set()`.** Long-lived process caches in `anthropic.ts`, `source-audit.ts`, `deployer-forensics.ts` are bounded to 500 entries via `src/lib/cache-utils.ts` — TTL prune first, then FIFO drop. New caches should follow the same shape rather than growing unboundedly.
- **Use `getRpcUrl(chainId)` from `src/lib/rpc.ts` for viem clients.** Resolves per-chain `RPC_URL_*` env first, then `ALCHEMY_API_KEY`, then `INFURA_API_KEY`, then falls back to viem's public RPC. Don't `http()` with no argument — public RPCs rate-limit aggressively under load.
- **Capability-first gating.** Don't write `if (tier === "pro")` inline — add the boolean to `Capabilities` in `src/lib/plans/access.ts`, gate the route with `requireCapability(wallet, "yourFlag")`, and gate the UI on `usePlan().capabilities.yourFlag`. Tier strings only appear in three places: `TIER_CAPS`, the plans page copy, and the checkout tier-price map.
- **Owner-wallet bypass exists for testing.** `OWNER_WALLETS` (comma-separated lowercase 0x addresses) resolves listed wallets to Ultra unconditionally. Use it for local development and demo accounts — don't use it as a substitute for actual subscription state in code.
- **Store EVM addresses lowercase in payment config.** viem rejects mixed-case addresses unless the EIP-55 checksum matches exactly — so `src/lib/payments/config.ts` keeps every contract / recipient as all-lowercase. The protocol treats lowercase and checksummed addresses as identical; the checksum is purely an integrity hint. If you add a new EVM token, lowercase the contract address before committing.
- **Real gas, never fake.** The checkout's "Network fee" row shows live values: gas units from `useEstimateGas` (real RPC simulation), per-gas fee from `useEstimateFeesPerGas`, native USD price from CoinGecko. The deterministic 21000/65000 fallback only triggers when `useEstimateGas` errors (typically because the wallet has no token balance), and the UI labels that state explicitly with "· typical" so users can tell. Don't paper over a missing estimate with hardcoded numbers in any new payment code.
- **Address is never rendered in the EVM checkout summary.** The recipient flows from quote → wagmi tx params → user wallet, never into a copy/paste block. For non-EVM, address reveal is gated behind an explicit "Reveal deposit address" click. Treat the recipient as a system value, not user-facing copy.
