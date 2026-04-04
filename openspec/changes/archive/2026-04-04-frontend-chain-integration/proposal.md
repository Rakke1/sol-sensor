## Why

The frontend has a full UI shell — three tabs (Dashboard, Economics, Simulator) with wallet connection via `window.solana` — but every on-chain interaction is fake. The three data hooks (`usePoolData`, `useContributor`, `useTokenBalance`) return hardcoded BigInts. The instruction builders in `program.ts` have wrong discriminators and incomplete argument serialization. The `ClientSimulator` uses `setTimeout` instead of sending a real `pay_for_query` transaction. The `ContributorDashboard` claim button shows an alert instead of sending `claim_rewards`. `InitContributor` does nothing. Until these are replaced with real on-chain calls, the frontend is a static mockup.

The backend now returns real 402 challenges with on-chain PDA addresses and validates receipts. The bootstrap script has initialized the pool, registered a test sensor, and minted mock USDC. Everything is ready for the frontend to send real transactions.

## What Changes

- **PDA derivation** (`lib/pda.ts`) — new module with `deriveGlobalState`, `deriveSensorPool`, `deriveHardwareEntry`, `deriveContributorState`, `deriveReceiptPda` using `@solana/kit`'s `getProgramDerivedAddress`, plus ATA derivation helper
- **Instruction builders** (`lib/program.ts`) — rewrite with correct SHA-256 Anchor discriminators, proper Borsh serialization of args (`nonce: [u8;32]`, `amount: u64`), and `@solana/kit` `Instruction`-compatible return types with `AccountRole` metadata
- **On-chain data hooks**:
  - `usePoolData` — fetch `SensorPool` PDA via `fetchEncodedAccount`, decode 117-byte layout (disc + mint + vault + reward_per_token + total_distributed + active_sensors + total_supply + max_supply + bump)
  - `useContributor` — fetch `ContributorState` PDA, decode 65-byte layout (disc + holder + reward_per_token_paid + rewards_owed + bump), compute claimable from on-chain pool accumulator
  - `useTokenBalance` — fetch wallet's pool token ATA balance via Token-2022 account data
- **ClientSimulator** — replace fake payment with real `pay_for_query`: get 402 challenge → build tx with accounts from challenge → sign with wallet → submit → get receipt PDA → pass receipt + nonce to backend
- **ContributorDashboard** — real `claim_rewards` tx: build instruction with holder + pool + contributor_state + token accounts → sign → submit
- **InitContributor** — real `init_contributor` tx
- **Transaction signing** — use `window.solana.signTransaction` (already available from wallet provider) with `@solana/kit` transaction building
- **RPC client** — create shared `@solana/kit` `createSolanaRpc` instance in `lib/rpc.ts` (replacing raw `fetch` JSON-RPC in providers)
- **PaymentChallenge type** — update to match new backend 402 response (add `globalState`, `usdcMint`, `hardwareOwnerUsdc` in accounts)

## Capabilities

### New Capabilities
- `chain-data-hooks`: Real on-chain data fetching for pool stats, contributor state, and token balances
- `chain-transactions`: Real transaction building, wallet signing, and submission for pay_for_query, claim_rewards, init_contributor

### Modified Capabilities

## Impact

- New: `frontend/src/lib/pda.ts`
- New: `frontend/src/lib/rpc.ts`
- Modified: `frontend/src/lib/program.ts` (full rewrite)
- Modified: `frontend/src/hooks/usePoolData.ts`
- Modified: `frontend/src/hooks/useContributor.ts`
- Modified: `frontend/src/hooks/useTokenBalance.ts`
- Modified: `frontend/src/components/ClientSimulator.tsx`
- Modified: `frontend/src/components/ContributorDashboard.tsx`
- Modified: `frontend/src/components/InitContributor.tsx`
- Modified: `frontend/src/types/index.ts` (PaymentChallenge accounts extended)
- Modified: `frontend/src/app/providers.tsx` (use shared RPC client)
- Dependencies: existing `@solana/kit` (already in package.json, unused)
