## 1. Foundation — RPC Client, PDA Helpers, Types

- [x] 1.1 Create `frontend/src/lib/rpc.ts` — export `rpc` via `createSolanaRpc(SOLANA_RPC_URL)` from `@solana/kit`. Import `SOLANA_RPC_URL` from `constants.ts`.
- [x] 1.2 Create `frontend/src/lib/pda.ts` — export `deriveGlobalState()`, `deriveSensorPool()`, `deriveContributorState(wallet)`, `deriveHardwareEntry(sensorPubkey)`, `deriveReceiptPda(nonce)` using `getProgramDerivedAddress` from `@solana/kit` with `PROGRAM_ID` from constants. Also export `deriveAta(mint, owner)` for Token-2022 ATAs.
- [x] 1.3 Add `NEXT_PUBLIC_USDC_MINT_ADDRESS` and `NEXT_PUBLIC_POOL_MINT_ADDRESS` to `frontend/src/lib/constants.ts` with env fallbacks. Update `frontend/.env.example`.
- [x] 1.4 Update `PaymentChallenge` type in `frontend/src/types/index.ts` — add `globalState`, `usdcMint`, `hardwareOwnerUsdc` to `payment.accounts`.

## 2. Account Decoders

- [x] 2.1 Create `frontend/src/lib/decoders.ts` — export `decodeSensorPool(data: Uint8Array): SensorPool` for the 117-byte layout with discriminator check. Also export `decodeContributorState(data: Uint8Array): ContributorState & { holder: string }` for the 65-byte layout.
- [x] 2.2 Add `encodeBase58` / `decodeBase58` utilities in `frontend/src/lib/base58.ts` (or reuse from `verify.ts`). Needed for converting raw pubkey bytes to display strings in decoders.

## 3. On-Chain Data Hooks

- [x] 3.1 Rewrite `usePoolData` — import `rpc` from `lib/rpc`, `deriveSensorPool` from `lib/pda`, `decodeSensorPool` from `lib/decoders`. Fetch `SensorPool` PDA with `fetchEncodedAccount`, decode, return real data. Add 30s polling interval. Handle account-not-found gracefully.
- [x] 3.2 Rewrite `useContributor` — derive `ContributorState` PDA from `["contrib", walletAddress]`, fetch + decode. Compute `claimable` from on-chain `pool.rewardPerToken`, `contributor.rewardPerTokenPaid`, and token balance. Return `contributor: null` if PDA doesn't exist.
- [x] 3.3 Rewrite `useTokenBalance` — derive wallet's pool token ATA (pool mint + wallet + Token-2022), fetch Token-2022 account data, extract `amount` field (offset 64, u64 LE). Return `0n` if ATA doesn't exist.

## 4. Instruction Builders

- [x] 4.1 Rewrite `frontend/src/lib/program.ts` — compute real Anchor discriminators using Web Crypto `crypto.subtle.digest('SHA-256', ...)` for `pay_for_query`, `claim_rewards`, `init_contributor`. Cache computed discriminators.
- [x] 4.2 Implement `buildPayForQueryIx(accounts, nonce, amount)` — data: `disc(8) + nonce(32) + amount_u64_le(8)`. Account order: payer (WRITABLE_SIGNER), global_state (WRITABLE), sensor_pool (WRITABLE), hardware_entry (READONLY), hardware_owner_usdc (WRITABLE), payer_usdc (WRITABLE), pool_vault (WRITABLE), usdc_mint (READONLY), query_receipt (WRITABLE), token_program (READONLY), system_program (READONLY), clock (READONLY). Return `@solana/kit` `Instruction` with `AccountRole` metadata.
- [x] 4.3 Implement `buildClaimRewardsIx(accounts)` — data: disc only. Account order: holder (WRITABLE_SIGNER), sensor_pool (WRITABLE), contributor_state (WRITABLE), holder_token_account (READONLY), usdc_mint (READONLY), holder_usdc (WRITABLE), pool_vault (WRITABLE), token_program (READONLY), system_program (READONLY).
- [x] 4.4 Implement `buildInitContributorIx(accounts)` — data: disc only. Account order: holder (WRITABLE_SIGNER), sensor_pool (READONLY), contributor_state (WRITABLE), system_program (READONLY).

## 5. Transaction Signing Bridge

- [x] 5.1 Create `frontend/src/lib/tx.ts` — export `signAndSendTransaction(rpc, instructions, walletAddress)`. Build v0 transaction message with `@solana/kit` (`createTransactionMessage`, `setTransactionMessageLifetimeUsingBlockhash`, `appendTransactionMessageInstructions`). Serialize to wire bytes. Deserialize into a format `window.solana.signTransaction()` accepts. After signing, extract raw bytes, send via `rpc.sendTransaction`. Return signature string.
- [x] 5.2 Add confirmation polling in `signAndSendTransaction` — poll `getSignatureStatuses` until `confirmed`, with 60s timeout. Throw on error or timeout.

## 6. ClientSimulator — Real Payment Flow

- [x] 6.1 Rewrite `ClientSimulator.tsx` step 2 (paying) — replace `setTimeout` mock with: decode `suggestedNonce` from challenge, derive receipt PDA from `["receipt", nonce]`, derive wallet's USDC ATA, build `pay_for_query` instruction using 402 challenge accounts, call `signAndSendTransaction`, extract real tx signature and receipt PDA address.
- [x] 6.2 Rewrite step 3 (fetching) — pass real receipt PDA as `x-query-receipt` header and base64url nonce as `x-query-nonce` header to the backend.
- [x] 6.3 Add wallet connection guard — if wallet not connected when "Run Full Demo" clicked, show error message prompting connection.
- [x] 6.4 Update Solscan link to use real transaction signature (remove `demo_tx_` prefix handling).

## 7. Contributor Components — Real Transactions

- [x] 7.1 Rewrite `ContributorDashboard` claim handler — build `claim_rewards` instruction with all required accounts (derive contributor PDA, pool token ATA, USDC ATA), sign and send via `signAndSendTransaction`. Refresh hook data on success. Show tx signature on success.
- [x] 7.2 Rewrite `InitContributor` — build `init_contributor` instruction (derive contributor PDA, sensor pool PDA), sign and send. Call `onSuccess` callback on confirmation.
- [x] 7.3 Remove hardcoded "Reward History" from ContributorDashboard — either remove the section or populate from on-chain transaction history (simpler: remove for now, add in ui-polish).

## 8. Providers Cleanup

- [x] 8.1 Replace raw `fetch` JSON-RPC calls in `providers.tsx` (`fetchSolBalance`, `checkNetworkMismatch`) with `@solana/kit` RPC client from `lib/rpc.ts`.
- [x] 8.2 Expose `window.solana` reference from wallet context so components can access `signTransaction` without direct `window.solana` access.

## 9. Verification

- [x] 9.1 `npm run build` — verify Next.js builds without errors.
- [x] 9.2 Start frontend + backend, connect Phantom wallet on devnet, verify Dashboard shows real pool data from chain.
- [x] 9.3 Run the ClientSimulator "Run Full Demo" — verify full cycle: 402 → wallet popup → on-chain payment → receipt → sensor data → signature verified.
- [x] 9.4 Test InitContributor + claim flow if the wallet has pool tokens.
