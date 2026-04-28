# Sovereign Investment Group

A DeFi yield platform that turns DeFiLlama data into multi-agent-reviewed investment strategies and live position monitoring. Built on Next.js 16 (App Router, React Compiler) with `wagmi` / `viem` for wallet integration and a triple-AI pipeline (Claude Opus 4.7, Codex GPT-5.5, Gemini 3.1 Pro) for strategy generation, contract auditing, and protocol risk scoring.

## What it does

- **Strategy generation** — Claude proposes an allocation, Codex + Gemini review it, Claude revises addressing every concern. The pipeline cross-checks against on-chain forensics, exploit history, TVL crashes, and dangerous deployer patterns before returning a strategy.
- **Multi-engine smart-contract audit** — Slither + Aderyn + Mythril run in parallel against verified contract source, then triple-AI plain-English explanations + OWASP SCSVS v12 mapping. 5–10 min per audit.
- **Live position monitoring** — every 15 min, scans active strategies for protocol TVL crashes, paused contracts, exploit alerts; pushes to a Discord webhook.
- **Wallet portfolio** — multi-chain balance aggregation across Ethereum, Optimism, BSC, Polygon, Base, Arbitrum, Avalanche.
- **DeFi tools** — pool correlation matrix, allocation simulator with stress scenarios.

## Requirements

- Node 20+
- One of: local `claude` / `codex` / `gemini` CLI binaries (dev), or Anthropic / OpenAI / Google API keys (prod)
- Etherscan V2 API key (covers ETH, Base, Arbitrum, Optimism, Polygon, BSC under one key)
- A WalletConnect Cloud project ID (free at https://cloud.walletconnect.com)
- Optional: Alchemy or Infura API key (public RPC fallbacks work but rate-limit aggressively)
- Optional: `slither` / `aderyn` / `mythril` for the audit pipeline (the orchestrator tolerates missing binaries — affected SCSVS checks become `indeterminate`)

## Local dev

```bash
cp .env.example .env.local
# fill in SESSION_SECRET, NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, ETHERSCAN_API_KEY at minimum
npm install
npm run dev
```

`.env.local` is gitignored. `SESSION_SECRET` must be ≥32 chars (`openssl rand -hex 32`).

The SQLite DB (`sovereign.db`) is created on first server route hit and migrates on every boot. Deleting it is safe.

### Running in production mode locally

```bash
npm run build
npm run start
```

This sets `NODE_ENV=production`, which activates the fail-fast guards in `wallet/config.ts` (rejects WalletConnect `"demo"` projectId) and `security/ai-mode.ts` (rejects `AI_MODE=cli`). For a local prod build, set `AI_MODE=api` and provide the AI keys, or comment out the `getAiMode()` callers.

## Deployment (Vercel)

The app is designed for Vercel's serverless runtime. Required configuration:

```bash
# Auth (≥32 chars, generate with: openssl rand -hex 32)
SESSION_SECRET=...
CRON_SECRET=...                         # for /api/strategies/monitor cron

# Wallet
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...

# RPCs (one of these, otherwise falls back to public RPCs which throttle)
ALCHEMY_API_KEY=...
# or INFURA_API_KEY=...
# or per-chain RPC_URL_ETHEREUM / RPC_URL_BASE / RPC_URL_ARBITRUM / etc.

# AI providers (CLI mode is unsupported on serverless)
AI_MODE=api
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GEMINI_API_KEY=...

# Data sources
ETHERSCAN_API_KEY=...
DISCORD_WEBHOOK_URL=...                 # for monitor alerts (optional)
```

`vercel.json` configures the monitor cron to POST `/api/strategies/monitor` every 15 min with `Authorization: Bearer ${CRON_SECRET}`.

**SQLite caveat:** the bundled persistence layer uses `better-sqlite3` against a local `sovereign.db` file. On Vercel that file lives on ephemeral function storage — it does not survive redeploys or cold starts across regions. For any real deployment you should swap the `getDb()` layer in `src/lib/db.ts` to a managed Postgres (Neon / Vercel Postgres / Supabase). This is the single biggest deployment blocker if you're past prototype phase.

## Commands

```bash
npm run dev          # next dev (Turbopack)
npm run build        # next build — runs full type-check
npm run start        # next start (production)
npm run lint         # eslint
npx tsc --noEmit     # standalone type-check (faster than build)
```

There is no test runner configured. `next build` is the canonical "does it compile" gate.

## Security model

- **SIWE auth** — `/api/auth/{nonce,verify,logout,me}` issues an HMAC-signed `sov_session` cookie (24h TTL).
- **Wallet-scoped routes** — every `/api/strategies*` route runs `requireWallet()` and queries by `wallet_address` from the session. Client-supplied wallet params are ignored.
- **Rate limiting** — token-bucket per wallet/IP: `strategy` 5/h, `audit` 3/h, `analyze`/`forensics` 20/h, `tools.*` 30/h.
- **SSRF guard** — outbound fetches against caller-influenced URLs go through `safeFetch` (scheme allowlist, private-IP filter, redirect re-validation).
- **Heuristic vetoes** — applied to AI scoring outputs (recent exploits, TVL crashes, "avoid"-rated deployers, broken audit links). The AI cannot override these.

See `CLAUDE.md` for the full architecture write-up — same file Claude Code reads when you open this repo.

## Repo layout

```
src/app/(app)/         # authenticated pages (discover, portfolio, strategies, security, tools)
src/app/(landing)/     # marketing
src/app/api/           # server routes
src/lib/auth/          # SIWE + session
src/lib/security/      # protocol scoring, multi-engine audit, on-chain forensics
src/lib/wallet/        # balance aggregation, RainbowKit config
src/lib/tools/         # correlation, simulator, pool history
src/types/             # shared types
vercel.json            # Vercel Cron config
```

## License

Private / unpublished. Don't redistribute without permission.
