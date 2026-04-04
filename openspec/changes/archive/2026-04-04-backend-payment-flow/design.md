## Context

The backend Express server has a working middleware chain (`http402` → `receiptVerifier` → sensor route) but all on-chain interactions are stubbed. The program is deployed to devnet at `ETu1YLCnZyeeWBYYLSFXLNncJa4AgaHaZQ8JSUxTEosJ`, and the devnet environment was bootstrapped with mock USDC, a pool, and a test sensor. The co-signer keypair exists at `backend/keys/cosigner.json` and is loaded via `getCosigner()` in `solana.ts` but never used.

The `QueryReceipt` on-chain layout was updated to 114 bytes (added `pool_share` and `total_supply_at_payment` after `amount`), but the backend decoder still reads the old 98-byte layout — field offsets for `consumed`, `created_at`, `expiry_slot`, and `bump` are all wrong.

## Goals / Non-Goals

**Goals:**
- Real 402 challenge with on-chain PDA addresses derived from program seeds
- Receipt decoder matching the current 114-byte `QueryReceipt` layout
- Sensor ID validation — reject receipts not for the requested sensor
- Post-delivery `consume_receipt` transaction sent via co-signer
- Graceful failure — consume errors logged, data still delivered

**Non-Goals:**
- Frontend changes (separate task `frontend-chain-integration`)
- `pay_for_query` instruction building (done client-side, not in backend)
- Changing the route structure or adding new endpoints
- Handling `refund_expired_receipt` (client-side concern)

## Decisions

### 1. PDA derivation with `@solana/kit` at startup

**Decision:** Derive all PDAs once at module load time in a new `services/pda.ts`, export them as resolved `Address` values. The 402 middleware and consume logic import these pre-computed addresses.

**Rationale:** PDA derivation is deterministic and `async` (requires SHA-256). Computing once and caching avoids doing async work on every request. The program ID and seeds are constants.

**Alternative considered:** Derive per-request. Rejected — wasteful for deterministic values.

### 2. Discriminator check + length guard on receipt decode

**Decision:** Before decoding, verify `data.length >= 114` and check that the first 8 bytes match the Anchor discriminator for `QueryReceipt` (SHA-256 of `"account:QueryReceipt"`[0..8]).

**Rationale:** Prevents decoding garbage data or accounts from other programs. The discriminator is a cheap constant check.

### 3. Consume receipt as fire-and-forget after data delivery

**Decision:** After `res.json()` sends the sensor data, kick off `consume_receipt` as an async operation. If it fails (network error, expired, already consumed), log a warning but don't affect the client response.

**Rationale:** The client has already paid and deserves data. Receipt consumption is a bookkeeping concern — worst case, the receipt expires and the payer can refund. Blocking the response on consume would add latency and make the API unreliable.

### 4. Pass sensor pubkey from route to receipt validation

**Decision:** The sensor route extracts the hardware entry's sensor pubkey and passes it through `receiptVerifier` to `validateReceipt(receiptPda, expectedSensorId)`. This activates the existing but unused sensor_id check in `receiptService.ts`.

**Rationale:** Without this, a receipt for sensor A could be used to query sensor B's data. The `receiptService` already has the conditional check — it just needs the parameter.

### 5. Hand-build `consume_receipt` instruction (same pattern as bootstrap)

**Decision:** Build the Anchor instruction manually: SHA-256 discriminator + 32-byte nonce arg + ordered accounts. Same approach used in `scripts/lib/instructions.ts`.

**Rationale:** No IDL dependency, and the consume instruction has a simple layout (1 arg: `nonce: [u8; 32]`, 5 accounts). Keeps the backend free of Anchor TS client dependencies.

## Risks / Trade-offs

- **[Co-signer not consume_authority]** → The on-chain `GlobalState.consume_authority` is set to the admin wallet (whoever called `initialize_pool`), not our co-signer. Mitigation: either update `consume_authority` on-chain via an admin instruction (if one exists), or for MVP use the same keypair as admin for both bootstrap and co-signer. Flag this as a known limitation.
- **[Receipt expiry window is tight (~30s)]** → If the client pays and the backend is slow to respond, the receipt may expire before `consume_receipt`. Mitigation: consume immediately after sending data; the ~30s window is sufficient for normal request latency.
- **[Fire-and-forget consume may silently fail]** → If consume fails repeatedly, receipts pile up un-consumed. Mitigation: structured logging with `[Consume]` prefix so failures are visible in logs. Not a correctness issue — payers can refund expired receipts.
