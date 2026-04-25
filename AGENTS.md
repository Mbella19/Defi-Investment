# Repository Guidelines

## Project Structure & Module Organization

This is a private Next.js 16 and React 19 TypeScript app for DeFi yield discovery, portfolio views, monitoring, and security analysis. App routes live in `src/app`, with route groups such as `src/app/(landing)` and `src/app/(app)`, plus API handlers under `src/app/api`. Shared UI is organized in `src/components` by feature (`scanner`, `portfolio`, `sovereign`, `views`, `ui`). Business logic and integrations live in `src/lib`, including wallet utilities in `src/lib/wallet` and audit tooling in `src/lib/security`. Shared types belong in `src/types`; reusable hooks belong in `src/hooks`; static assets belong in `public`; review scripts are in `scripts`.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`; use npm as the canonical package manager.
- `npm run dev`: start the local Next.js dev server, normally at `http://localhost:3000`.
- `npm run build`: compile and type-check the production app.
- `npm run start`: run the built app after `npm run build`.
- `npm run lint`: run ESLint with Next.js core-web-vitals and TypeScript rules.

## Coding Style & Naming Conventions

Use TypeScript with `strict` enabled. Prefer 2-space indentation, double quotes, semicolons, and named exports for shared library functions. React components use PascalCase filenames, for example `ScannerForm.tsx`. Hooks use `useX` naming, such as `usePortfolio.ts`. Keep data contracts in `src/types` and import internal modules with the `@/` alias. Mark interactive components with `"use client"` only when client-side state, effects, or browser APIs are required.

## Testing Guidelines

No automated test framework is currently configured. For every change, run `npm run lint` and `npm run build` before submitting. When adding tests, colocate them near the feature or under a future test directory using `*.test.ts` or `*.test.tsx`, and mock external APIs such as DefiLlama, CoinGecko, GoPlus, and wallet providers.

## Commit & Pull Request Guidelines

Recent history uses short imperative messages, sometimes with Conventional Commit prefixes such as `feat:`. Prefer concise messages that name the affected area, for example `feat: add strategy alert scheduler` or `Update security audit consensus`. Pull requests should include a brief summary, verification commands run, linked issues when applicable, and screenshots or screen recordings for UI changes.

## Security & Configuration Tips

Keep secrets in `.env.local`; `.env*` files are ignored. Do not commit local runtime artifacts such as `.next`, `sovereign.db`, `sovereign.db-wal`, `sovereign.db-shm`, or `*.tsbuildinfo`. Treat security audit outputs and wallet data as sensitive unless explicitly sanitized.
