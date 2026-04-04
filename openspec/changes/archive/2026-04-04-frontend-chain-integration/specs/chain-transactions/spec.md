## ADDED Requirements

### Requirement: Real pay_for_query transaction in ClientSimulator
The `ClientSimulator` SHALL build a real `pay_for_query` Anchor instruction using accounts from the 402 challenge, sign it with the connected wallet via `window.solana`, submit to the cluster, and use the resulting receipt PDA + nonce to fetch data from the backend.

#### Scenario: Full payment cycle
- **WHEN** the user clicks "Run Full Demo" with a connected wallet
- **THEN** the simulator: (1) fetches 402 challenge, (2) builds `pay_for_query` tx with accounts from challenge + wallet's USDC ATA + derived receipt PDA, (3) signs via wallet popup, (4) submits and waits for confirmation, (5) calls backend with `x-query-receipt` and `x-query-nonce` headers, (6) displays real sensor data

#### Scenario: Wallet not connected
- **WHEN** the user clicks "Run Full Demo" without a connected wallet
- **THEN** the simulator shows an error asking the user to connect their wallet first

#### Scenario: Transaction rejected by user
- **WHEN** the wallet popup appears and the user clicks "Reject"
- **THEN** the simulator shows an error "Transaction rejected" and returns to idle state

#### Scenario: Insufficient USDC balance
- **WHEN** the wallet's USDC ATA has insufficient balance for the query price
- **THEN** the transaction fails on-chain and the simulator shows a descriptive error

### Requirement: Real claim_rewards transaction
The `ContributorDashboard` SHALL build and submit a real `claim_rewards` instruction when the user clicks "Claim Rewards".

#### Scenario: Successful claim
- **WHEN** the user has claimable rewards > 0 and clicks "Claim Rewards"
- **THEN** the dashboard builds a `claim_rewards` instruction with: holder (signer), sensor_pool, contributor_state, holder_token_account, usdc_mint, holder_usdc, pool_vault, token_program, system_program — signs with wallet, submits, and refreshes balances on success

#### Scenario: No rewards to claim
- **WHEN** the user has 0 claimable rewards
- **THEN** the claim button is disabled

### Requirement: Real init_contributor transaction
The `InitContributor` component SHALL build and submit a real `init_contributor` instruction when the user clicks "Initialize".

#### Scenario: Successful initialization
- **WHEN** the user clicks "Initialize Contributor Account" with a connected wallet
- **THEN** the component builds `init_contributor` with: holder (signer), sensor_pool, contributor_state (PDA to create), system_program — signs with wallet, submits, and calls `onSuccess` callback

#### Scenario: Already initialized
- **WHEN** the ContributorState PDA already exists for the wallet
- **THEN** the InitContributor component is not shown (parent checks `contributor !== null`)

### Requirement: Correct Anchor instruction encoding
All instruction builders SHALL compute discriminators as `SHA-256("global:<instruction_name>")[0..8]` using Web Crypto API. Arguments SHALL be Borsh-encoded (little-endian). Account lists SHALL use `AccountRole` from `@solana/kit` with correct signer/writable flags matching the Anchor struct.

#### Scenario: pay_for_query encoding
- **WHEN** `buildPayForQueryIx` is called with nonce and amount
- **THEN** the instruction data is: `discriminator(8) + nonce(32) + amount_u64_le(8)` = 48 bytes, and accounts match the Anchor `PayForQuery` struct order

#### Scenario: claim_rewards encoding
- **WHEN** `buildClaimRewardsIx` is called
- **THEN** the instruction data is only the 8-byte discriminator (no args), and accounts match `ClaimRewards` struct order

#### Scenario: init_contributor encoding
- **WHEN** `buildInitContributorIx` is called
- **THEN** the instruction data is only the 8-byte discriminator, and accounts match `InitContributor` struct order

### Requirement: Transaction signing bridge for Phantom
A `lib/tx.ts` utility SHALL bridge `@solana/kit` transaction messages to `window.solana.signTransaction()`. It SHALL build the transaction with Kit, serialize to v0 wire format, wrap for Phantom signing, and send the signed bytes via Kit's RPC.

#### Scenario: Transaction signed and submitted
- **WHEN** `signAndSendTransaction(instructions, walletAddress)` is called
- **THEN** it builds a v0 transaction message, gets a recent blockhash, serializes, passes to `window.solana.signTransaction()`, extracts the signed bytes, and sends via `rpc.sendTransaction`

### Requirement: PaymentChallenge type updated
The `PaymentChallenge` type SHALL include the extended accounts from the backend 402 response: `globalState`, `usdcMint`, `hardwareOwnerUsdc` in addition to existing fields.

#### Scenario: Type matches backend response
- **WHEN** the frontend receives a 402 response
- **THEN** the `PaymentChallenge` type correctly types all account fields including `globalState`, `usdcMint`, and `hardwareOwnerUsdc`
