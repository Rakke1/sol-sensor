# SolSensor — Task List

> Hackathon deadline: April 7, 2026
> Each section = one `openspec propose` change.
> Execute top-to-bottom — each group depends on the ones above it.

---

## Phase 1 — Program: Make It Deployable

### ~~1. `complete-initialize-pool`~~ DONE

Completed in main. `initialize_pool` now:
- Creates Token-2022 mint with `TransferHook` extension via Anchor `init` macro
- Creates USDC vault ATA (`associated_token::mint = usdc_mint, authority = sensor_pool`)
- Initializes `ExtraAccountMetaList` with 3 extra accounts (sensor_pool, sender_contributor, receiver_contributor) via `spl_tlv_account_resolution`
- Added `usdc_mint` and `rent` sysvar to accounts struct

---

### ~~2. `fix-refund-accumulator`~~ DONE

Completed in main (Option A implemented):
- `QueryReceipt` now stores `pool_share` (u64) and `total_supply_at_payment` (u64)
- `pay_for_query` writes both new fields
- `refund_expired_receipt` computes exact reverse increment and subtracts from `reward_per_token`
- New unit test `refund_reverses_reward_increment` covers the round-trip
- `QueryReceipt::LEN` updated to 114 bytes

---

### ~~3. `program-build-deploy`~~ DONE

Completed by colleague. Program deployed to devnet:
https://explorer.solana.com/address/ETu1YLCnZyeeWBYYLSFXLNncJa4AgaHaZQ8JSUxTEosJ?cluster=devnet

Program ID: `ETu1YLCnZyeeWBYYLSFXLNncJa4AgaHaZQ8JSUxTEosJ`
All config files updated. CI pipeline active.

---

## Phase 2 — Devnet Environment

### 4. `devnet-bootstrap-script`

**Priority:** Required to test anything end-to-end.

**Scope:**
- Create a TypeScript setup script (`scripts/bootstrap-devnet.ts` or similar) that:
  1. Creates a mock USDC SPL token mint (6 decimals) on devnet, OR documents how to use Circle's devnet USDC
  2. Calls `initialize_pool` with the deployed program
  3. Registers a test sensor (model_id=3, Mock Dev Sensor)
  4. Generates co-signer keypair for the backend
  5. Generates sensor keypair for Ed25519 signing
  6. Mints test USDC to a payer wallet for testing
  7. Outputs all addresses/keypairs needed for `.env` files
- Add `.env` setup instructions to README

**Files:**
- New: `scripts/bootstrap-devnet.ts`
- `backend/.env.example`
- `frontend/.env.example`
- `README.md` (Getting Started section)

---

## Phase 3 — Backend: Close the Payment Loop

### 5. `backend-payment-flow`

**Priority:** Core product flow — 402 → pay → verify → consume → data.

**Note:** `QueryReceipt` layout changed (added `pool_share` + `total_supply_at_payment`
after `amount`). Backend `decodeQueryReceipt` must be updated to match the new 114-byte layout.

**Problem:** Backend has the HTTP 402 gate and receipt verification, but:
- 402 challenge uses placeholder addresses (not real PDAs)
- `consume_receipt` is never called after serving data (co-signer is loaded but unused)
- Receipt `sensor_id` is not validated against the requested sensor
- No discriminator or length check on decoded receipt data
- Binary decoder assumes old 98-byte layout — **now stale** after `QueryReceipt` gained 2 fields

**Scope:**
- **Update `decodeQueryReceipt`** to match new layout:
  `[0..8] disc, [8..40] sensor_id, [40..72] payer, [72..80] amount, [80..88] pool_share, [88..96] total_supply_at_payment, [96] consumed, [97..105] created_at, [105..113] expiry_slot, [113] bump`
- Replace `derivePoolAddress()` / `deriveVaultAddress()` with real PDA derivation
  using program ID + seeds (`["pool"]`, etc.) via `@solana/kit`
- Wire `hardwareOwner` from on-chain `HardwareEntry` or config
- After returning sensor data, build + sign + send `consume_receipt` tx using co-signer
- In `receiptVerifier`, compare `receipt.sensor_id` with the requested sensor's pubkey
- Add 8-byte discriminator check and `data.length >= 114` guard in `decodeQueryReceipt`
- Add proper error responses when consume fails (log but don't block data delivery)

**Files:**
- `backend/src/middleware/http402.ts`
- `backend/src/middleware/receiptVerifier.ts`
- `backend/src/services/solana.ts`
- `backend/src/services/receiptService.ts`
- `backend/src/routes/sensors.ts` (add consume after data response)

---

## Phase 4 — Frontend: Real Chain Data

### 6. `frontend-wallet-verification`

**Priority:** Colleague's request — "verify wallet connects and shows wallet info."

**Scope:**
- Verify wallet connect flow works end-to-end (Phantom on devnet)
- Add real SOL balance display after connect (one `getBalance` RPC call) as proof of chain connectivity
- Fix `disconnect` — call `window.solana.disconnect()` in addition to clearing React state
- Show connected network (devnet badge already exists, verify it's accurate)
- Handle edge cases: wallet not installed, user rejects connect, network mismatch

**Files:**
- `frontend/src/app/providers.tsx`
- `frontend/src/app/page.tsx` (header area — show SOL balance)
- New or existing hook for SOL balance

---

### 7. `frontend-chain-integration`

**Priority:** Replace all mocks with real data — the big frontend task.

**Problem:** All three hooks return hardcoded data. Instruction builders have fake
discriminators. No real transactions are sent.

**Scope:**
- **Instruction builders** (`lib/program.ts`): Either generate via Codama from IDL, or
  manually build correct Anchor discriminators (first 8 bytes of SHA256 of
  `"global:<instruction_name>"`), correct args serialization, and return proper
  `IInstruction` objects compatible with `@solana/kit`
- **`usePoolData`**: Replace mock with `fetchEncodedAccount(rpc, poolPda)` +
  manual decode of `SensorPool` (or Codama codec)
- **`useContributor`**: Replace mock with `fetchEncodedAccount(rpc, contribPda)` +
  decode `ContributorState`
- **`useTokenBalance`**: Fetch real Token-2022 ATA balance for connected wallet
- **`ClientSimulator`**: Build real `pay_for_query` transaction, sign with wallet,
  submit, get receipt PDA, pass to backend
- **`ContributorDashboard`**: Real `claim_rewards` transaction
- **`InitContributor`**: Real `init_contributor` transaction
- Add PDA derivation helpers (seeds + program ID → address)

**Files:**
- `frontend/src/lib/program.ts`
- `frontend/src/hooks/usePoolData.ts`
- `frontend/src/hooks/useContributor.ts`
- `frontend/src/hooks/useTokenBalance.ts`
- `frontend/src/components/ClientSimulator.tsx`
- `frontend/src/components/ContributorDashboard.tsx`
- `frontend/src/components/InitContributor.tsx`
- New: `frontend/src/lib/pda.ts` (PDA derivation helpers)

---

## Phase 5 — Testing & Polish

### 8. `integration-tests`

**Priority:** Confidence before demo.

**Blocker:** `litesvm >= 0.5` requires Solana 2.2.x which conflicts with
`anchor-lang 0.32.x` (Solana 2.1.x). LiteSVM and mollusk-svm have been removed
from dev-dependencies. Flow tests remain stubs.

**Revised scope:**
- ~~Implement `flow_tests.rs` with litesvm~~ Deferred — version conflict
- **Alternative A:** Write a TypeScript E2E smoke test that hits the real program on
  devnet (via `@solana/kit` — send real txs, verify state)
- **Alternative B:** Wait for Anchor 0.33.x / Solana 2.2.x compatibility and re-add litesvm
- **Alternative C:** Use `solana-program-test` (BanksClient) if compatible with 2.1.x
- At minimum: verify `anchor test` (unit tests) passes in CI

**Files:**
- New: `scripts/e2e-smoke.ts` (preferred alternative)
- `programs/sol-sensor/tests/flow_tests.rs` (kept as documentation of intent)

---

### 9. `ui-polish`

**Priority:** Nice-to-have for demo quality.

**Scope:**
- Fix `formatUsdc` / `formatTokens` — `Number(bigint)` loses precision on large values.
  Use BigInt division or `Intl.NumberFormat`
- Add global Express error middleware in `backend/src/index.ts`
- Replace hardcoded reward history with real data (transaction log parsing or recent claims)
- Update README with deployed program ID, devnet links, actual setup instructions
- Fix `supplyPct` integer division truncation (33.3% → 33%)

**Files:**
- `frontend/src/components/ContributorDashboard.tsx`
- `backend/src/index.ts`
- `README.md`

---

## Execution Order (3 remaining days)

```
Day 2 (today): program-build-deploy → devnet-bootstrap-script → backend-payment-flow
Day 3:         frontend-wallet-verification → frontend-chain-integration
Day 4:         integration-tests → ui-polish → buffer
```

## Quick Reference

| # | Change Name                    | Component | Status     | Est. Effort |
|---|-------------------------------|-----------|------------|-------------|
| 1 | `complete-initialize-pool`    | program   | DONE       | ~~Large~~   |
| 2 | `fix-refund-accumulator`      | program   | DONE       | ~~Medium~~  |
| 3 | `program-build-deploy`        | program   | DONE       | ~~Small~~   |
| 4 | `devnet-bootstrap-script`     | scripts   | DONE       | ~~Medium~~  |
| 5 | `backend-payment-flow`        | backend   | DONE       | ~~Large~~   |
| 6 | `frontend-wallet-verification`| frontend  | DONE       | ~~Small~~   |
| 7 | `frontend-chain-integration`  | frontend  | DONE       | ~~Large~~   |
| 8 | `integration-tests`           | program   | Blocked    | Medium      |
| 9 | `ui-polish`                   | all       | DONE       | ~~Small~~   |
