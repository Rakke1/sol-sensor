## 1. Shared Formatting Utilities

- [x] 1.1 Create `frontend/src/lib/format.ts` — export `formatUsdc(microUsdc: bigint): string` using BigInt division (`/ 1_000_000n`) and remainder (`% 1_000_000n`). Pad fractional part to 2 digits. Add thousands separator on the integer part via `BigInt.toString()` + regex or manual grouping.
- [x] 1.2 Export `formatTokens(rawTokens: bigint): string` from `format.ts` — same approach as `formatUsdc`, 6-decimal token. Trim trailing zeros from fractional part.
- [x] 1.3 Export `formatSupplyPct(totalSupply: bigint, maxSupply: bigint): string` from `format.ts` — multiply by `1000n`, divide by `maxSupply`, format with 1 decimal. Guard against `maxSupply === 0n`. Cap at `"100.0"`.

## 2. Component Updates

- [x] 2.1 Update `ContributorDashboard.tsx` — remove local `formatUsdc` and `formatTokens` functions. Import from `@/lib/format`. Replace `supplyPct` calculation with `formatSupplyPct(pool.totalSupply, pool.maxSupply)`.
- [x] 2.2 Update `PoolStats.tsx` — remove local `formatUsdc` and `formatTokens` functions. Import from `@/lib/format`. Replace `supplyPct` calculation with `formatSupplyPct`.

## 3. Backend Error Handling

- [x] 3.1 Add global error middleware to `backend/src/index.ts` — after all route registrations, add `app.use((err, req, res, next) => ...)` that logs the error and returns `{ error: 'Internal server error' }` with status 500. Type the handler with Express `ErrorRequestHandler`.

## 4. README Update

- [x] 4.1 Update "Getting Started / Quick Start" section in root `README.md` — add `fund-wallet.ts` step, fix `.env.local` copy instructions, clarify that bootstrap output prints the addresses to paste.
- [x] 4.2 Update "Project Structure" tree in `README.md` — add `scripts/` directory with `bootstrap-devnet.ts`, `fund-wallet.ts`, `test-payment-flow.ts`, `lib/`. Add `openspec/` directory. Update `frontend/src/lib/` to list `rpc.ts`, `pda.ts`, `program.ts`, `tx.ts`, `decoders.ts`, `format.ts`. Remove reference to Codama.
- [x] 4.3 Update tech stack references — replace `@solana/client + @solana/react-hooks` with `@solana/kit v6 + @solana/web3.js`. Remove Codama mentions.
- [x] 4.4 Update roadmap checkboxes — mark completed milestones (Anchor program, Token-2022, HTTP 402, atomic splits, precision rewards, transfer hook, dashboard).

## 5. Verification

- [x] 5.1 `npm run build` in frontend — verify no TypeScript errors after formatter refactor.
- [x] 5.2 Visual check — open dashboard, verify pool stats display with correct decimal precision (e.g. supply percentage shows "x.x%" not "x%").
