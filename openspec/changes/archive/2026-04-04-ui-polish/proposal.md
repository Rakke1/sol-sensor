## Why

The core protocol and frontend chain integration are complete and working end-to-end on devnet. However, several rough edges remain that hurt demo quality and production readiness: precision-losing number formatting, missing error handling in the backend, an outdated README that doesn't reflect the current architecture, and integer truncation in progress bars. These are quick wins that elevate the project from "works" to "polished".

## What Changes

- Fix `formatUsdc` / `formatTokens` helpers across all components — replace `Number(bigint)` with BigInt-safe formatting to prevent precision loss on large values
- Fix `supplyPct` integer division truncation in `PoolStats` and `ContributorDashboard` (33.3% shows as 33%)
- Add global Express error middleware in the backend to prevent unhandled errors from crashing the process
- Update the root `README.md` with actual deployed addresses, working setup instructions, accurate project structure, and current tech stack references
- Add loading/error states to `ClientSimulator` step transitions for better UX feedback
- Extract duplicated `formatUsdc` / `formatTokens` into a shared `lib/format.ts` utility

## Capabilities

### New Capabilities
- `ui-formatting`: Safe BigInt-to-display formatting utilities and consistent number presentation across all frontend components

### Modified Capabilities

## Impact

- `frontend/src/lib/format.ts` (new shared formatting utility)
- `frontend/src/components/ContributorDashboard.tsx` — use shared formatters, fix supplyPct
- `frontend/src/components/PoolStats.tsx` — use shared formatters, fix supplyPct
- `backend/src/index.ts` — add error middleware
- `README.md` — rewrite getting started and project structure sections
