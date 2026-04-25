# Sovereign Terminal

## Project Overview

**Sovereign Investment Group (SIG) / Sovereign Terminal** is a Next.js (App Router) based web application tailored for decentralized finance (DeFi) analytics and risk assessment. The platform scores DeFi pools on live Total Value Locked (TVL), audit posture, oracle health, and capital stickiness to provide an "honestly priced" view of on-chain yields.

A core feature of the application is the integration with large language models (LLMs) including Claude, Gemini, and Codex to perform automated security audits and exploit monitoring of DeFi smart contracts.

**Key Technologies:**
- **Framework:** Next.js (v16), React (v19)
- **Language:** TypeScript
- **Styling:** Tailwind CSS, Framer Motion, Geist Font
- **Web3:** Wagmi, Viem, RainbowKit
- **State/Data:** React Query (@tanstack/react-query), Better-SQLite3
- **Visualization:** Recharts
- **AI Integrations:** Custom clients for Gemini (`gemini CLI`), Claude, and Codex (`src/lib/security/`).

## Architecture & Directory Structure

- `src/app/`: The Next.js App Router containing all page routes. Includes landing page, dashboard (discover, portfolio), security analysis, strategies, and tools. API routes (`src/app/api/`) handle backend logic such as analyzing and scanning.
- `src/components/`: Reusable React components organized by feature domain (e.g., `dashboard`, `portfolio`, `scanner`, `security`, `ui`).
- `src/hooks/`: Custom React hooks containing the business logic for connecting UI to state (e.g., `useScanner`, `usePortfolio`, `useActiveStrategies`).
- `src/lib/`: Core utilities and integrations. Includes clients for AI analysis (`src/lib/security`), risk modeling, Web3 configurations, database setup, and various DeFi platform integrations (CoinGecko, DefiLlama, Beefy).
- `src/types/`: TypeScript interfaces and type definitions used across the application to ensure end-to-end type safety.
- `scripts/`: Shell scripts for orchestrating AI reviews (e.g., `gemini-review.sh`, `codex-review.sh`).

## Building and Running

The project relies on standard Next.js npm scripts:

- **Start Development Server:**
  ```bash
  npm run dev
  # or yarn dev, pnpm dev, bun dev
  ```
  The app will be accessible at [http://localhost:3000](http://localhost:3000).

- **Build for Production:**
  ```bash
  npm run build
  ```

- **Start Production Server:**
  ```bash
  npm run start
  ```

- **Run Linter:**
  ```bash
  npm run lint
  ```

## Development Conventions

- **Component Architecture:** The project separates complex state management into custom hooks (`src/hooks`) keeping components focused on presentation (`src/components/scanner/ScannerForm.tsx`).
- **Styling Strategy:** Relies heavily on Tailwind utility classes with custom theming logic utilizing `data-theme` and local storage for dark/light mode toggling (`src/app/layout.tsx`).
- **Web3 Integration:** The `Web3Provider` wraps the application in `WagmiProvider` and `RainbowKitProvider` using a custom "sovereignDark" theme.
- **AI Interaction:** The project interacts with AI models through custom local CLI integrations (e.g., spawning `gemini` in a Node child process as seen in `src/lib/security/gemini-client.ts`), prioritizing local, non-interactive execution for automated code review tasks.
