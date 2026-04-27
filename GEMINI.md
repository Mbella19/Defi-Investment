# Sovereign Terminal: System Architecture & Agent Guidelines

## 1. Project Overview & Mission

**Sovereign Investment Group (SIG) / Sovereign Terminal** is a professional-grade, Next.js (App Router) based web application tailored for decentralized finance (DeFi) analytics, risk assessment, and portfolio management. 

The platform's primary mission is to provide an "honestly priced" view of on-chain yields by scoring DeFi pools based on:
- Live Total Value Locked (TVL)
- Security audit posture
- Oracle health
- Capital stickiness and volatility

A defining feature of the Sovereign Terminal is its **Automated Security Intelligence**, which leverages a triple-LLM architecture (Claude, Gemini, and Codex) to perform real-time security audits and exploit monitoring of DeFi smart contracts.

---

## 2. Technology Stack

- **Framework:** Next.js (v16 App Router)
- **UI & Components:** React (v19), Tailwind CSS (v4), Framer Motion
- **Typography & Icons:** Geist Font, Lucide React
- **Web3 / Blockchain:** Wagmi (v2), Viem (v2), RainbowKit (v2)
- **State Management & Data Fetching:** React Query (@tanstack/react-query)
- **Database:** Better-SQLite3 (Local persistent storage for strategies and alerts)
- **Data Visualization:** Recharts
- **PDF Generation:** jspdf, html2canvas (for exporting reports)

---

## 3. Directory Structure & Architecture

The codebase follows a strictly organized domain-driven structure within `src/`:

- **`src/app/`**: Next.js App Router root.
  - Contains route groups like `(app)` for the main dashboard and `(landing)` for the public face.
  - **`src/app/api/`**: Contains core backend API routes (`/analyze`, `/chains`, `/compare`, `/health`, `/monitor`, `/portfolio`, `/rebalance`, `/risk`, `/scan`, `/security`, `/strategies`, `/tools`, `/yields`). These handle AI processing, risk calculation, and blockchain interactions.
- **`src/components/`**: Reusable UI components grouped by domain:
  - `dashboard/`, `layout/`, `portfolio/`, `scanner/`, `wallet/`, `ui/`.
  - `sovereign/`: Contains core brand and aesthetic components (e.g., `HeroChart`, `RiskBar`, `Spark`, `YieldTape`).
- **`src/hooks/`**: Custom React hooks handling business logic and abstracting state from UI components (`useActiveStrategies`, `useChains`, `useLiveYields`, `usePortfolio`, `useScanner`, `useStrategyAlerts`).
- **`src/lib/`**: Core utilities, services, and integrations.
  - `security/`: AI clients (`gemini-client.ts`, `claude-client.ts`, `codex-client.ts`), `dual-llm.ts` (handling triple invocation), exploit monitoring, and source audits.
  - `tools/`: Correlation calculators, yield simulators, and pool history tools.
  - `wallet/`: Balance fetching, portfolio calculation, and token lists.
  - Web3 & Data Providers: `coingecko.ts`, `defillama.ts`, `beefy.ts`.
  - Core Logic: `db.ts` (database connections/migrations), `risk.ts`, `risk-models.ts` (VaR, Sharpe ratio calculations).
- **`src/types/`**: Strict TypeScript interfaces modeling the entire system.
- **`scripts/`**: Shell scripts for orchestrating batch AI reviews (`gemini-review.sh`, `codex-review.sh`).

---

## 4. Core Subsystems

### 4.1. AI Security Architecture (Triple LLM)
Sovereign Terminal runs critical security analyses through a parallel triple-LLM architecture ensuring consensus-based risk assessment.
- Located in `src/lib/security/`.
- **`tripleInvoke` / `tripleExtractJson`**: Functions located in `dual-llm.ts` that fan-out requests to Claude (Opus), Codex (GPT-5.5), and Gemini (3.1 Pro Preview).
- **Gemini CLI Integration**: The Gemini client (`gemini-client.ts`) spawns a child process invoking the local `gemini` CLI for high-speed, local non-interactive execution, with fallbacks to the API depending on configuration. 

### 4.2. Database & State
- **Better-SQLite3** (`src/lib/db.ts`): Runs locally using WAL journal mode.
- Contains critical tables: `active_strategies` (tracking user yields/allocations) and `strategy_alerts` (monitoring events, hacks, or warnings for specific pools).
- All database modifications and queries should strictly use parameterized queries to prevent SQL injection. Migrations are handled inline in the `getDb()` initialization.

### 4.3. Risk Modeling
- **`src/lib/risk-models.ts`**: Implements quantitative finance models including Historical Value at Risk (VaR), Pearson correlation matrixes, Sharpe ratios, and Maximum Drawdowns using historical APY series.
- **`src/lib/risk.ts`**: Aggregates protocol, audit, and on-chain metrics into composite risk scores.

### 4.4. Web3 Integration
- **Wagmi/Viem**: Handles wallet connections and on-chain reads. 
- Wrapped in `Web3Provider` (which includes `RainbowKitProvider`) applying the custom `sovereignDark` theme.

---

## 5. Development Guidelines & Agent Mandates

When interacting with this codebase as an AI assistant, you MUST adhere to the following rules:

### 5.1. Strict TypeScript & Type Safety
- **No `any` or `ts-ignore`**: You must NEVER bypass the type system. If types mismatch, fix the underlying interfaces in `src/types/` or ensure the data maps correctly.
- **Explicit Returns**: Always provide explicit return types for API routes and core logic functions in `src/lib/`.
- **Data Validation**: When handling LLM JSON outputs (e.g., via `extractJson`), always ensure the parsed data structure is validated against expected Typescript interfaces before use.

### 5.2. Component & Hook Architecture
- **Separation of Concerns**: UI components (`src/components/`) should be as dumb as possible. Complex state, React Query interactions, and side effects MUST reside in `src/hooks/`.
- **Tailwind v4**: Utilize Tailwind v4 utility classes. Avoid inline styles. Rely on the established `data-theme` logic for styling.
- **Server vs Client Components**: Next.js App Router is in use. Be extremely mindful of the `'use client'` directive. API calls and secrets must stay on the server (`src/app/api/` or Server Actions).

### 5.3. Modifying AI & Security Tools
- When updating AI prompts or integration logic in `src/lib/security/`, ensure that failures in one LLM do not crash the `tripleInvoke` pipeline. Code should be resilient and handle partial AI failures gracefully.
- Do not run interactive shell commands when automating AI reviews via the internal shell scripts.

### 5.4. Database Changes
- If modifying the SQLite schema, you must update the `migrate()` function in `src/lib/db.ts`. Note how migrations are currently handled (e.g., repairing malformed data in-place) and ensure backwards compatibility.

### 5.5. Running Commands
- **Dev Server**: `npm run dev`
- **Linting**: Always verify code quality using `npm run lint` before concluding a task.

> **Contextual Precedence**: This file dictates the absolute architectural laws of the Sovereign Terminal project. As an AI Agent, you must uphold these conventions meticulously during any code generation, refactoring, or investigation tasks.