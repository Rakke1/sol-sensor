## ADDED Requirements

### Requirement: Pool data fetched from chain
`usePoolData` SHALL fetch the `SensorPool` PDA account via `fetchEncodedAccount`, decode the 117-byte layout, and return real on-chain values for `totalSupply`, `maxSupply`, `rewardPerToken`, `activeSensors`, `totalQueries`, `totalDistributed`. The hook SHALL validate the Anchor discriminator before decoding.

#### Scenario: Pool data loads on mount
- **WHEN** the `usePoolData` hook mounts
- **THEN** it fetches the SensorPool PDA, decodes the account data, and returns `pool` with real on-chain values and `loading: false`

#### Scenario: Pool account not found
- **WHEN** the SensorPool PDA does not exist on-chain
- **THEN** the hook returns `pool: null`, `loading: false`, `error` with a descriptive message

#### Scenario: Pool data refreshes periodically
- **WHEN** 30 seconds have elapsed since the last fetch
- **THEN** the hook refetches the SensorPool PDA and updates the returned values

### Requirement: Contributor state fetched from chain
`useContributor` SHALL fetch the `ContributorState` PDA for the connected wallet via `fetchEncodedAccount`, decode the 65-byte layout, and compute `claimable` rewards using the on-chain formula: `pending = tokenBalance × (pool.rewardPerToken − contributor.rewardPerTokenPaid) / PRECISION_FACTOR; claimable = pending + contributor.rewardsOwed`.

#### Scenario: Contributor state loads for connected wallet
- **WHEN** the hook receives a non-null `walletAddress` and a valid `pool`
- **THEN** it derives the ContributorState PDA from `["contrib", walletAddress]`, fetches and decodes the account, and returns `contributor` with real values

#### Scenario: Contributor not initialized
- **WHEN** the ContributorState PDA does not exist for the connected wallet
- **THEN** the hook returns `contributor: null`, `claimable: 0n`, indicating the user needs to call `init_contributor`

### Requirement: Token balance fetched from chain
`useTokenBalance` SHALL derive the wallet's Associated Token Account (ATA) for the pool mint using Token-2022 program, fetch the account data, and return the token balance.

#### Scenario: Balance loads for wallet with tokens
- **WHEN** the hook receives a non-null `walletAddress` and the ATA exists with a non-zero balance
- **THEN** it returns `balance` matching the on-chain token amount

#### Scenario: ATA does not exist
- **WHEN** the wallet has no ATA for the pool mint
- **THEN** the hook returns `balance: 0n`, `loading: false`, no error

### Requirement: Shared RPC client
A shared `@solana/kit` RPC client SHALL be created once in `lib/rpc.ts` and imported by all hooks and transaction senders. Raw `fetch` JSON-RPC calls in `providers.tsx` SHALL be replaced with this client.

#### Scenario: All on-chain calls use shared client
- **WHEN** any hook or transaction sender makes an RPC call
- **THEN** it uses the shared `rpc` instance from `lib/rpc.ts`

### Requirement: PDA derivation helpers
A `lib/pda.ts` module SHALL export async functions for deriving all protocol PDAs: `deriveGlobalState`, `deriveSensorPool`, `deriveContributorState(wallet)`, `deriveHardwareEntry(sensorPubkey)`, `deriveReceiptPda(nonce)`.

#### Scenario: PDAs match on-chain addresses
- **WHEN** `deriveSensorPool()` is called
- **THEN** it returns the same address as the backend and bootstrap script derive for the `["pool"]` seed
