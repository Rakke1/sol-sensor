## Why

The backend has the HTTP 402 skeleton (middleware chain: `http402` → `receiptVerifier` → sensor handler) but every on-chain interaction is faked. The 402 challenge returns hardcoded placeholder addresses, the receipt decoder reads the old 98-byte layout (missing `pool_share` and `total_supply_at_payment`), `consume_receipt` is never called after serving data, and the receipt's `sensor_id` is never validated against the requested sensor. Until these are fixed, the backend cannot participate in a real on-chain payment cycle — it's a UI demo, not a working protocol.

## What Changes

- **Fix `decodeQueryReceipt`** — update to the new 114-byte layout: `[0..8] disc, [8..40] sensor_id, [40..72] payer, [72..80] amount, [80..88] pool_share, [88..96] total_supply_at_payment, [96] consumed, [97..105] created_at, [105..113] expiry_slot, [113] bump`. Add 8-byte discriminator check and `data.length >= 114` guard.
- **Replace fake PDA addresses in 402 challenge** — derive real `SensorPool`, pool vault, and `HardwareEntry` PDAs from program ID + seeds using `@solana/kit`'s `getProgramDerivedAddress`. Return the real USDC mint address and hardware owner.
- **Validate `sensor_id` in receipt** — pass the expected sensor pubkey from the route to `receiptVerifier` → `validateReceipt`, reject if mismatch.
- **Build and send `consume_receipt` transaction** — after serving sensor data, construct the `consume_receipt` instruction (co-signer + global_state + query_receipt + payer + clock + system_program), sign with the co-signer keypair, and submit. Log but don't block data delivery on consume failure.
- **Add PDA derivation service** — new `services/pda.ts` with `deriveGlobalState`, `deriveSensorPool`, `deriveHardwareEntry`, `deriveReceipt(nonce)` using program ID.

## Capabilities

### New Capabilities
- `payment-flow`: End-to-end HTTP 402 payment cycle — real 402 challenge with on-chain addresses, receipt verification with sensor_id validation, and post-delivery receipt consumption

### Modified Capabilities

## Impact

- Modified: `backend/src/services/solana.ts` (receipt decoder + consume_receipt tx builder)
- Modified: `backend/src/middleware/http402.ts` (real PDA derivation)
- Modified: `backend/src/middleware/receiptVerifier.ts` (sensor_id pass-through)
- Modified: `backend/src/services/receiptService.ts` (sensor_id validation)
- Modified: `backend/src/routes/sensors.ts` (consume after data delivery)
- Modified: `backend/src/types/index.ts` (updated QueryReceiptData, new PaymentAccounts fields)
- New: `backend/src/services/pda.ts` (PDA derivation helpers)
- Dependencies: existing `@solana/kit` — no new deps
