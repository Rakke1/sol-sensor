## Approach

Small, targeted fixes across frontend formatting, backend error handling, and documentation. No architectural changes — all fixes are leaf-level edits.

## Key Decisions

### 1. BigInt-safe formatting via shared `lib/format.ts`

Currently `formatUsdc` and `formatTokens` are duplicated in `ContributorDashboard.tsx` and `PoolStats.tsx`, both using `Number(bigint)` which loses precision beyond `Number.MAX_SAFE_INTEGER` (2^53). For USDC with 6 decimals, this overflows at ~9 billion USDC — unlikely in MVP but wrong in principle.

**Decision:** Extract into `frontend/src/lib/format.ts`. Use BigInt division for the integer part and remainder for decimals. No external dependency needed.

```typescript
function formatUsdc(microUsdc: bigint): string {
  const whole = microUsdc / 1_000_000n;
  const frac = microUsdc % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, '0').slice(0, 2)}`;
}
```

### 2. Fix supplyPct truncation

`(totalSupply * 100n) / maxSupply` truncates to integer. Fix: multiply by 10_000n, divide, then format with 1 decimal. Applies to both `PoolStats` and `ContributorDashboard`.

### 3. Express global error handler

Add a catch-all error middleware as the last `app.use()` in `backend/src/index.ts`. Logs the error and returns a generic 500 JSON response. Prevents process crash on unexpected errors.

### 4. README update

Rewrite the "Getting Started" and "Project Structure" sections to reflect the actual current state:
- Correct tech stack (`@solana/kit` v6, not `@solana/client`)
- Include `fund-wallet.ts` in the quick start flow
- Update project tree to show `scripts/`, `openspec/`, and actual `frontend/src/lib/` structure
- Update roadmap checkboxes to reflect completed milestones

## File Changes

| File | Change |
|------|--------|
| `frontend/src/lib/format.ts` | New — `formatUsdc`, `formatTokens`, `formatSupplyPct` |
| `frontend/src/components/ContributorDashboard.tsx` | Import shared formatters, remove local copies, fix supplyPct |
| `frontend/src/components/PoolStats.tsx` | Import shared formatters, remove local copies, fix supplyPct |
| `backend/src/index.ts` | Add global error middleware |
| `README.md` | Update setup instructions, project structure, tech references, roadmap status |
