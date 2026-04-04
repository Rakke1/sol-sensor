## 1. PDA Derivation Service

- [x] 1.1 Create `backend/src/services/pda.ts` — export `PROGRAM_ID` from env, implement `deriveGlobalState()`, `deriveSensorPool()`, `deriveHardwareEntry(sensorPubkey)`, `deriveReceiptPda(nonce)` using `getProgramDerivedAddress` from `@solana/kit`. Cache `globalState` and `sensorPool` at module load via top-level `await` or lazy init.
- [x] 1.2 Add `USDC_MINT` and `POOL_MINT` address exports to `backend/src/config.ts` from env vars (`USDC_MINT_ADDRESS`, `POOL_MINT_ADDRESS`), with validation that they are non-empty when the server starts.

## 2. Fix Receipt Decoder

- [x] 2.1 Update `QueryReceiptData` interface in `backend/src/services/solana.ts` — add `poolShare: bigint` and `totalSupplyAtPayment: bigint` fields.
- [x] 2.2 Update `decodeQueryReceipt` to the 114-byte layout: `[72..80] amount`, `[80..88] pool_share`, `[88..96] total_supply_at_payment`, `[96] consumed`, `[97..105] created_at`, `[105..113] expiry_slot`, `[113] bump`. Add length guard `data.length >= 114` and 8-byte Anchor discriminator check (`SHA-256("account:QueryReceipt")[0..8]`).

## 3. Real 402 Challenge Addresses

- [x] 3.1 Update `PaymentAccounts` type in `backend/src/types/index.ts` — add `usdcMint: string`, `hardwareOwnerUsdc: string`, and `globalState: string` fields.
- [x] 3.2 Rewrite `http402.ts` — replace `derivePoolAddress()`/`deriveVaultAddress()` stubs with imports from `services/pda.ts`. Populate all accounts with real PDA addresses: `sensorPool`, `poolVault` (pool's USDC ATA), `hardwareEntry`, `hardwareOwner` (fetched from on-chain `HardwareEntry` or derived), `usdcMint`, `globalState`.
- [x] 3.3 Make 402 challenge `async` — PDA derivation for `hardwareEntry` requires the sensor pubkey which may be fetched asynchronously. Update middleware signature to return `Promise<void>`.

## 4. Sensor ID Validation in Receipt Verification

- [x] 4.1 Update `receiptVerifier.ts` — extract sensor pubkey from `req` context (e.g. route param → sensor pubkey lookup) and pass it as `expectedSensorId` to `validateReceipt(receiptPda, expectedSensorId)`.
- [x] 4.2 Wire sensor pubkey resolution — the route `/:sensorType` maps to a sensor pubkey. Use `getSensorPubkey()` from `sensorSimulator.ts` (or derive from config) to get the expected pubkey for the requested sensor.

## 5. Consume Receipt After Data Delivery

- [x] 5.1 Add `buildConsumeReceiptIx` to `backend/src/services/solana.ts` — Anchor discriminator for `consume_receipt`, encode 32-byte `nonce` arg, accounts: `consume_authority` (signer), `global_state`, `query_receipt` (mut), `payer` (mut), `clock` (sysvar), `system_program`.
- [x] 5.2 Add `sendConsumeReceipt(receiptPda, nonce, payerAddress)` function in `solana.ts` — loads co-signer via `getCosigner()`, builds tx with `buildConsumeReceiptIx`, signs with co-signer, sends transaction, logs result. Returns void, never throws.
- [x] 5.3 Store nonce in `res.locals` — update `receiptVerifier.ts` or `receiptService.ts` to extract and store the 32-byte nonce alongside `res.locals.receipt` so the route handler can pass it to consume.
- [x] 5.4 Update `backend/src/routes/sensors.ts` — after `res.json(response)`, call `sendConsumeReceipt(receiptPda, nonce, receipt.payer)` as fire-and-forget (no `await` blocking response). Guard with `if (getCosigner())` check.

## 6. Type Updates and Cleanup

- [x] 6.1 Update `PaymentChallenge.payment.accounts` in `backend/src/types/index.ts` to match the extended `PaymentAccounts` type.
- [x] 6.2 Remove duplicate `encodeBase58` function — it exists in both `solana.ts` and `sensorSimulator.ts`. Extract to a shared `utils/base58.ts` or pick one source of truth.
- [x] 6.3 Update `backend/.env.example` with new env vars: `USDC_MINT_ADDRESS`, `POOL_MINT_ADDRESS`, `HARDWARE_OWNER_ADDRESS`.

## 7. Verification

- [x] 7.1 Start backend with devnet config (keypairs from bootstrap, real program ID) — verify server starts without errors and co-signer loads.
- [x] 7.2 `curl` the 402 endpoint — verify all addresses are real base58 pubkeys (not `111...` placeholders).
- [x] 7.3 Verify receipt decode — test with a known on-chain receipt PDA (from bootstrap or manual `pay_for_query`) that all fields decode at correct offsets.
