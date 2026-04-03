# SolSensor — Task List

> Hackathon deadline: April 7, 2026
> Each section = one `openspec propose` change.
> Execute top-to-bottom — each group depends on the ones above it.

---

## Phase 1 — Program: Make It Deployable

### 1. `complete-initialize-pool`

**Priority:** Critical blocker — everything downstream depends on this.

**Problem:** `initialize_pool` handler only writes `GlobalState` and `SensorPool` PDAs.
It does NOT create the Token-2022 mint, USDC vault, or ExtraAccountMetaList —
all of which are required for every other instruction to work.

**Scope:**
- Add CPI to create Token-2022 mint with `TransferHook` extension, mint authority = pool PDA
- Add CPI to create USDC vault ATA (associated token account of pool PDA for USDC mint)
- Add CPI to initialize `ExtraAccountMetaList` PDA (seeds: `["extra-account-metas", mint]`)
  with extra accounts needed by `transfer_hook`: `sensor_pool`, `sender_contributor`, `receiver_contributor`
- Update `InitializePool` accounts struct — add `usdc_mint`, `rent` sysvar if needed
- Add USDC mint account to the instruction so vault ATA can be derived

**Files:** `programs/sol-sensor/src/instructions/initialize_pool.rs`

---

### 2. `fix-refund-accumulator`

**Priority:** Economic bug — vault can be drained.

**Problem:** `refund_expired_receipt` returns 80% USDC from vault to payer and decrements
`total_distributed`, but does NOT reverse the `reward_per_token` increment that
`pay_for_query` added. Contributors can claim rewards from refunded payments,
eventually emptying the vault.

**Scope:**
- Option A (recommended): Store `pool_share` and `total_supply_at_payment` in `QueryReceipt`.
  On refund, compute exact reverse increment and subtract from `reward_per_token`.
  Requires adding 2 fields to `QueryReceipt` (u64 + u64 = 16 bytes) and updating `LEN`.
- Option B: Accept as design decision — document that refunds don't reverse accumulator,
  and that hw owners + contributors keep earnings from refunded queries. Simpler but less fair.
- Update `pay_for_query` to write the new fields if Option A.
- Update unit tests for the new behavior.

**Files:**
- `programs/sol-sensor/src/state/query_receipt.rs`
- `programs/sol-sensor/src/instructions/pay_for_query.rs`
- `programs/sol-sensor/src/instructions/refund_expired.rs`
- `programs/sol-sensor/tests/unit_tests.rs`

---

### 3. `program-build-deploy`

**Priority:** Gate for all integration work.

**Scope:**
- Generate real program keypair (`solana-keygen grind` or `solana-keygen new`)
- Update `declare_id!` in `lib.rs` (currently placeholder `Fg6PaFpo...`)
- Update `Anchor.toml` with real program ID
- Run `anchor build` — fix any compilation errors
- Run `anchor test` (unit tests) — ensure they pass
- Deploy to devnet: `anchor deploy --provider.cluster devnet`
- Record deployed program ID for backend/frontend config

**Files:**
- `programs/sol-sensor/src/lib.rs`
- `programs/Anchor.toml`
- `backend/.env.example` (update PROGRAM_ID)
- `frontend/src/lib/constants.ts` (update PROGRAM_ID)

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

**Problem:** Backend has the HTTP 402 gate and receipt verification, but:
- 402 challenge uses placeholder addresses (not real PDAs)
- `consume_receipt` is never called after serving data (co-signer is loaded but unused)
- Receipt `sensor_id` is not validated against the requested sensor
- No discriminator or length check on decoded receipt data

**Scope:**
- Replace `derivePoolAddress()` / `deriveVaultAddress()` with real PDA derivation
  using program ID + seeds (`["pool"]`, etc.) via `@solana/kit`
- Wire `hardwareOwner` from on-chain `HardwareEntry` or config
- After returning sensor data, build + sign + send `consume_receipt` tx using co-signer
- In `receiptVerifier`, compare `receipt.sensor_id` with the requested sensor's pubkey
- Add 8-byte discriminator check and `data.length >= 98` guard in `decodeQueryReceipt`
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

**Scope:**
- Implement `flow_tests.rs` (currently 4 stubs with `#[ignore]`):
  - `test_full_query_lifecycle`: init → register → pay → consume → claim
  - `test_receipt_expiry_refund`: pay → warp → refund
  - `test_transfer_hook_settles_rewards`: transfer triggers hook
  - `test_supply_cap_enforcement`: register until cap → fail
- Requires built `.so` (depends on task 3)
- Optional: E2E smoke test script (curl-based or TypeScript) that hits the real
  backend on devnet

**Files:**
- `programs/sol-sensor/tests/flow_tests.rs`
- `programs/sol-sensor/tests/fixtures/accounts.rs`
- Optional new: `scripts/e2e-smoke.ts`

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

## Execution Order (4 days)

```
Day 1:  complete-initialize-pool → fix-refund-accumulator → program-build-deploy
Day 2:  devnet-bootstrap-script → backend-payment-flow
Day 3:  frontend-wallet-verification → frontend-chain-integration
Day 4:  integration-tests → ui-polish → buffer
```

## Quick Reference

| # | Change Name                    | Component | Est. Effort |
|---|-------------------------------|-----------|-------------|
| 1 | `complete-initialize-pool`    | program   | Large       |
| 2 | `fix-refund-accumulator`      | program   | Medium      |
| 3 | `program-build-deploy`        | program   | Medium      |
| 4 | `devnet-bootstrap-script`     | scripts   | Medium      |
| 5 | `backend-payment-flow`        | backend   | Large       |
| 6 | `frontend-wallet-verification`| frontend  | Small       |
| 7 | `frontend-chain-integration`  | frontend  | Large       |
| 8 | `integration-tests`           | program   | Medium      |
| 9 | `ui-polish`                   | all       | Small       |
