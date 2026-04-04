## Why

The frontend wallet connect flow exists but has gaps: `disconnect` doesn't actually disconnect from the wallet provider, there's no proof of chain connectivity after connect (all displayed data is mock), and edge cases (no wallet installed, user rejects, network mismatch) are unhandled. A colleague specifically flagged "verify wallet connects and shows wallet info" as a priority. Adding a real SOL balance display is the simplest proof that the wallet ↔ chain link works before tackling the larger chain integration task.

## What Changes

- Fix `WalletProvider.disconnect()` to call `window.solana.disconnect()` instead of only clearing React state
- Add real SOL balance fetched via RPC (`getBalance`) displayed in the header after wallet connect
- Handle edge cases: wallet extension not installed, user rejects connect prompt, network mismatch detection
- Verify the existing devnet badge reflects the actual connected network

## Capabilities

### New Capabilities
- `wallet-connection`: Wallet connect/disconnect lifecycle, SOL balance display, network detection, and error handling for the Solana wallet integration

### Modified Capabilities

## Impact

- `frontend/src/app/providers.tsx` — disconnect fix, SOL balance state
- `frontend/src/app/page.tsx` — display SOL balance in header
- New hook or inline logic for `getBalance` RPC call
- No backend or program changes required
- No new dependencies — uses existing `@solana/kit` (already in package.json but unused) or raw RPC fetch
