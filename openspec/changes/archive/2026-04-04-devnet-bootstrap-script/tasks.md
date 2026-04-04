## 1. Project scaffolding

- [x] 1.1 Create `scripts/` directory with `package.json` (name: `sol-sensor-scripts`, deps: `@solana/kit`, `@solana-program/system`, `@solana-program/token-2022`, `@solana-program/token`, `@solana-program/associated-token`, `tsx`) and `tsconfig.json`
- [x] 1.2 Add `scripts/keys/` to root `.gitignore`
- [x] 1.3 Run `npm install` in `scripts/` to generate lockfile

## 2. Keypair and wallet utilities

- [x] 2.1 Create `scripts/lib/keypair.ts` — helpers to load/generate Solana CLI-format keypairs (`[u8; 64]` JSON), write to `scripts/keys/<name>.json` with 0o600 perms, return `CryptoKeyPair` for `@solana/kit`
- [x] 2.2 Create `scripts/lib/rpc.ts` — create RPC client, devnet genesis hash check (abort if not devnet), SOL balance fetch, airdrop-with-fallback (try airdrop, catch and print faucet URL)

## 3. Anchor instruction builders

- [x] 3.1 Create `scripts/lib/instructions.ts` — compute Anchor discriminators via SHA-256 of `"global:<name>"`, export `buildInitializePoolIx(accounts, args)` and `buildRegisterSensorIx(accounts, args)` returning `IInstruction`
- [x] 3.2 PDA derivation helpers — `deriveGlobalState`, `deriveSensorPool`, `deriveExtraAccountMetaList(mint)`, `deriveHardwareEntry(sensorPubkey)`, `deriveContributorState(holder)` using program ID + seeds

## 4. Bootstrap steps

- [x] 4.1 Implement step 1: check payer SOL balance, airdrop if below 2 SOL (graceful fallback on failure)
- [x] 4.2 Implement step 2: create mock USDC mint (SPL Token, 6 decimals, authority = payer), mint 10,000 USDC to payer's ATA — skip if USDC mint address already saved in `scripts/keys/usdc-mint.json`
- [x] 4.3 Implement step 3: generate pool Token-2022 mint keypair, call `initialize_pool(max_supply=10_000_000)` with all required accounts — skip if GlobalState PDA already exists
- [x] 4.4 Implement step 4: load/generate sensor keypair, call `register_sensor(model_id=3)` with USDC fee transfer and pool token mint — skip if HardwareEntry PDA already exists
- [x] 4.5 Implement step 5: load/generate cosigner keypair (reuse `scripts/keys/cosigner.json`)

## 5. Output and documentation

- [x] 5.1 Print structured environment summary: Program ID, mock USDC mint, pool mint, all PDAs, keypair paths, suggested `.env` values for backend and frontend
- [x] 5.2 Update `backend/.env.example` and `frontend/.env.example` with comments referencing bootstrap output
- [x] 5.3 Update `README.md` Getting Started section with bootstrap instructions (`cd scripts && npm install && npx tsx bootstrap-devnet.ts`)

## 6. Verification

- [x] 6.1 Run the bootstrap script on devnet — verify all accounts created (requires funded payer)
- [x] 6.2 Run a second time — verify idempotency (all steps skipped, no errors)
- [x] 6.3 Verify backend can start with the generated `.env` values
