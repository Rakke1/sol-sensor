# UI Formatting

## Overview

Safe BigInt-to-display number formatting for all on-chain values shown in the frontend. Eliminates precision loss and integer truncation bugs.

## Requirements

### REQ-1: BigInt-safe USDC formatting

- `formatUsdc(microUsdc: bigint)` returns a string like `"1,234.56"` with exactly 2 decimal places
- Must not use `Number(bigint)` — use BigInt division and remainder
- Thousands separator via `toLocaleString()` on the integer part
- Negative values show as `"-1.23"` (edge case — should not occur in practice)

### REQ-2: BigInt-safe token formatting

- `formatTokens(rawTokens: bigint)` returns a string like `"1,000,000.00"` with up to 2 decimal places
- Assumes 6-decimal token (same as USDC mint decimals)
- Thousands separator on the integer part
- Trailing zeros trimmed (e.g. `"1,000"` not `"1,000.00"` when fractional part is zero)

### REQ-3: Precise supply percentage

- `formatSupplyPct(totalSupply: bigint, maxSupply: bigint)` returns a string like `"33.3"` with 1 decimal place
- Must not truncate to integer — `33.3%` not `33%`
- Returns `"0.0"` when `maxSupply` is zero (guard)
- Returns `"100.0"` cap when `totalSupply >= maxSupply`

### REQ-4: Single source of truth

- All formatters exported from `frontend/src/lib/format.ts`
- `ContributorDashboard`, `PoolStats`, and any future components import from this module
- No duplicate formatting logic in component files

## Scenarios

### Scenario: Large USDC values don't lose precision
- Given `microUsdc = 9_007_199_254_740_993n` (just above MAX_SAFE_INTEGER)
- When `formatUsdc(microUsdc)` is called
- Then result is `"9,007,199,254.74"` (not a rounded/lossy value)

### Scenario: Supply percentage shows decimal
- Given `totalSupply = 333_333n`, `maxSupply = 1_000_000n`
- When `formatSupplyPct(totalSupply, maxSupply)` is called
- Then result is `"33.3"` (not `"33"`)

### Scenario: Zero supply is safe
- Given `totalSupply = 0n`, `maxSupply = 0n`
- When `formatSupplyPct(totalSupply, maxSupply)` is called
- Then result is `"0.0"`
