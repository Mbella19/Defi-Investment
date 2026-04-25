# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Next.js 16.2.1 (App Router, Turbopack) · React 19.2 with the React Compiler enabled (`reactCompiler: true` in `next.config.ts` + `babel-plugin-react-compiler`) · TypeScript · Tailwind 4 · `better-sqlite3` for local persistence (declared in `serverExternalPackages` so it isn't bundled) · `wagmi`/`viem`/RainbowKit for wallet UX. Imported `@AGENTS.md` above warns: this Next.js has breaking changes vs. training data — consult `node_modules/next/dist/docs/` before changing routing, server actions, or config.

## Commands

```bash
npm run dev        # next dev (Turbopack)
npm run build      # next build — runs full type-check
npm run lint       # eslint (flat config in eslint.config.mjs)
npx tsc --noEmit   # standalone type-check (faster than build)
```

There is no test runner configured. `next build` is the canonical "does it compile" gate — it type-checks and statically generates all pages.

The SQLite DB (`sovereign.db`) is created on first server route hit via `src/lib/db.ts`'s `getDb()`; deleting it is safe (it migrates on next boot). Two DDL paths coexist: `db.ts`'s `migrate()` creates `active_strategies` + `strategy_alerts` eagerly on first connection, while `src/lib/security/exploit-monitor.ts`'s `ensureSchema()` creates `exploit_alerts` lazily on first read. New tables should follow one of those two patterns — don't introduce a third.

## Big-picture architecture

### Three-stage protocol security analysis (`src/lib/anthropic.ts`)

`analyzeProtocol(protocol, pools)` is the security-scoring entry point. It runs three stages:

1. **Triple-AI scoring** — `tripleInvoke` (in `src/lib/security/dual-llm.ts`) fans the same prompt out to Claude Opus 4.7, Codex GPT-5.5 (xhigh), and Gemini 3.1 Pro Preview in parallel via `Promise.allSettled`. Each AI returns its own `legitimacyScore`, `verdict`, `redFlags`, `sections{...}`. Partial failures are tolerated.
2. **Synthesis** — Claude (`invokeClaude` again) reconciles the three outputs with a min-score / most-conservative-verdict bias and an explicit `disagreements[]` array. If synthesis fails, `mechanicalReconcile()` deterministically merges (min score, union flags, average sections) so the analysis still ships.
3. **Heuristic veto** — `applyHeuristicVetoes()` enforces hard ceilings the AI cannot override: recent on-chain exploits, TVL crashes, "avoid"-rated deployers, dangerous source-audit verdicts, all-broken audit links. Each applied veto is recorded on `ProtocolAnalysis.vetoes[]` and prepended to `redFlags` so downstream prompts see it.

Ground-truth facts (`src/lib/security/ground-truth.ts`) are gathered in parallel before stage 1: HEAD-checks each audit link, queries the local `exploit_alerts` table, detects TVL crashes (1d ≤ −40% or 7d ≤ −55%), and reads cached deployer/source-audit data. They're embedded verbatim in the scoring prompt and the synthesis prompt — the AIs are told they MUST engage with them.

Results are cached in-process for 1 hour keyed by protocol slug.

### Strategy generation (`src/lib/strategist.ts`)

`generateStrategy(criteria)` is a separate three-stage pipeline for portfolio construction:

1. **Claude proposer** — fetches DeFiLlama pools + protocols, filters by APY/TVL/risk, runs `analyzeProtocol` on the top 30 protocols (in batches of 5), and asks Claude to compose an initial allocation strategy via `invokeClaudeCli` (local `claude` CLI subprocess).
2. **Codex + Gemini reviewers** — both review Claude's proposal in parallel via `runReviewer`. `mergeReviewerCritiques` deduplicates concerns by `category + normalized issue`, escalates severity, and tracks which reviewer(s) flagged each via `sources: ReviewerSource[]`. If both reviewers approve with zero concerns, revision is skipped.
3. **Claude revision** — Claude rewrites the strategy addressing every high-severity concern. `validateRevisedStrategy` enforces shape + budget tolerance (±1% or $50). `recomputeWeightedApy` ignores the model's stated APY in favour of the actual allocation-weighted average. `concernAddressed` is a deterministic post-hoc check (was the cited pool dropped? was its allocation cut ≥20%? was its reasoning rewritten?) — the AIs cannot self-mark concerns as addressed.

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

### Background scheduler & job stores

Two in-memory job stores back the long-running pipelines: `strategy-jobs.ts` for `generateStrategy` and `audit/jobs.ts` for `runMultiEngineAudit`. Both are `Map<id, Job>` with TTL pruning and append-only `events[]` arrays for progress streaming — clients poll `…/status` and render a live event log. New long-running pipelines should follow the same shape.

Alongside them, `monitor-scheduler.ts`'s `ensureSchedulerStarted()` is idempotently invoked from strategy API routes; on first call it spawns a 15-min `setInterval` that runs `monitorActiveStrategies()` to scan stored strategies and write new `strategy_alerts` rows. The scheduler lives inside the Next server process — a serverless deployment would need to externalize it.

### AI client layer

The three AI providers each shell out to a local CLI:

- `src/lib/security/claude-client.ts` → `claude -p --model claude-opus-4-7 --effort max`
- `src/lib/security/codex-client.ts` → `codex` CLI
- `src/lib/security/gemini-client.ts` → `gemini` CLI

All three accept a prompt over stdin and resolve to a string. `extractJson()` in `claude-client.ts` is the shared JSON extractor — it strips markdown fences and returns the outermost balanced `{...}`. Prefer it over ad-hoc parsing when adding a new AI consumer.

Two ad-hoc shell scripts exist for second-opinion review during development: `scripts/codex-review.sh` and `scripts/gemini-review.sh`. They take an instruction arg + optional piped context and print the model's response. Useful for security-review of diffs.

### Routes

App Router with two route groups:

- `src/app/(app)/{discover,portfolio,security,strategies,tools}` — authenticated app pages. `security/audit/` is a nested route hosting the multi-engine contract auditor UI.
- `src/app/(landing)` — marketing.
- `src/app/api/*` — server routes (DeFiLlama scan, analyze, strategy, monitor, security/forensics/audit/alerts, portfolio/balances, etc.). All API routes are `ƒ` (dynamic, server-rendered on demand) — none are statically prerendered.

Strategies and alerts persist to SQLite via `getDb()` (`src/lib/db.ts`). The schema migrates on first connection.

### Data sources (mostly free-tier)

DeFiLlama (protocols, pools, TVL), CoinGecko (token market data), GoPlus (contract security), Beefy (auto-compound vaults), Etherscan-family (on-chain deployer forensics + source audits). Each lives in its own `src/lib/<source>.ts` module and exports a typed result + a `formatXForPrompt()` helper used by `analyzeProtocol`.

## Conventions worth knowing

- **Heuristic veto layer is non-negotiable.** When adding new safety rules, prefer extending `applyHeuristicVetoes` over tightening the AI prompt — heuristics are deterministic and survive AI hallucination.
- **Ground-truth before AI.** Any new safety signal that's verifiable from a free API or local DB should land in `gatherGroundTruth` and be formatted into the prompt, not asked of the AI.
- **Partial AI failure must not abort the pipeline.** Both `tripleInvoke` and the strategy reviewer pair are designed for `Promise.allSettled` semantics. Mirror that pattern when adding new AI calls.
- **Use the provided `extractJson` helper.** AI outputs frequently include prose around the JSON; ad-hoc `JSON.parse(text)` will break.
- **Long timeouts are intentional.** Scoring/synthesis use 360s timeouts; strategy proposer/reviser use 600s. The AI CLIs at max effort are slow — don't shorten without a reason.
- **React Compiler is on.** Don't reach for `useMemo` / `useCallback` for performance — the compiler memoizes function components automatically. Hand-written memoization is only justified when memoizing on a value the compiler can't see (e.g., refs, mutable instances).
- **GEMINI.md is the parallel file for Gemini reviews.** The local `gemini` CLI loads it the way Claude loads `CLAUDE.md`. The two have drifted before — when you change architecture-affecting facts here, mirror the relevant bit in `GEMINI.md`, or at least don't let it contradict.
