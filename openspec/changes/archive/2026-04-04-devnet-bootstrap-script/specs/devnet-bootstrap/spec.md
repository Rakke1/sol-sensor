## ADDED Requirements

### Requirement: Bootstrap creates mock USDC mint
The script SHALL create a new SPL token mint with 6 decimals on devnet to serve as mock USDC. The mint authority SHALL be the payer wallet. The script SHALL mint a configurable amount of test USDC (default 10,000 USDC = 10_000_000_000 micro-units) to the payer's associated token account.

#### Scenario: Fresh devnet with no existing mock USDC
- **WHEN** the bootstrap script runs and no prior mock USDC mint exists
- **THEN** a new SPL token mint is created with 6 decimals, and 10,000 USDC is minted to the payer's ATA

#### Scenario: Script outputs mock USDC mint address
- **WHEN** the mock USDC mint is created
- **THEN** the mint address is printed in the output summary for use in `.env` configuration

### Requirement: Bootstrap initializes the sensor pool
The script SHALL call `initialize_pool` on the deployed program, creating GlobalState PDA (`["global"]`), SensorPool PDA (`["pool"]`), a Token-2022 pool mint with TransferHook extension, the USDC vault ATA for the pool, and the ExtraAccountMetaList PDA (`["extra-account-metas", mint]`). The `max_supply` SHALL default to 10,000,000 tokens.

#### Scenario: Pool initialization on fresh devnet
- **WHEN** the bootstrap script runs and GlobalState does not exist
- **THEN** `initialize_pool` is called with `max_supply = 10_000_000`, creating all required PDAs and accounts

#### Scenario: Pool already initialized
- **WHEN** the bootstrap script runs and GlobalState already exists at the expected PDA
- **THEN** the pool initialization step is skipped with a log message "Pool already initialized"

### Requirement: Bootstrap registers a test sensor
The script SHALL call `register_sensor` with `model_id = 3` (Mock Dev Sensor, fee = $5 USDC, mints 50 pool tokens) using a generated or existing sensor keypair. The owner SHALL be the payer wallet.

#### Scenario: Register test sensor on initialized pool
- **WHEN** the pool is initialized and no HardwareEntry exists for the sensor keypair
- **THEN** `register_sensor` is called, creating a HardwareEntry PDA at `["hw", sensor_pubkey]`, transferring 5 USDC fee to pool vault, and minting 50 pool tokens to the owner's ATA

#### Scenario: Test sensor already registered
- **WHEN** the HardwareEntry PDA for the sensor keypair already exists
- **THEN** the sensor registration step is skipped with a log message "Sensor already registered"

### Requirement: Bootstrap generates required keypairs
The script SHALL generate a co-signer keypair and a sensor keypair in Solana CLI format (`[u8; 64]` JSON array) and write them to `scripts/keys/`. If keypair files already exist, they SHALL be reused without overwriting.

#### Scenario: First run generates keypairs
- **WHEN** the bootstrap script runs and `scripts/keys/cosigner.json` does not exist
- **THEN** a new Ed25519 keypair is generated and written to `scripts/keys/cosigner.json` with file permissions 0o600

#### Scenario: Existing keypairs are reused
- **WHEN** the bootstrap script runs and `scripts/keys/cosigner.json` already exists
- **THEN** the existing keypair is loaded and used without regeneration

### Requirement: Bootstrap outputs environment summary
The script SHALL print a structured summary at the end containing all addresses, keypair paths, and suggested `.env` values needed to configure the backend and frontend.

#### Scenario: Successful bootstrap prints summary
- **WHEN** all bootstrap steps complete (or are skipped due to idempotency)
- **THEN** the script prints: Program ID, Mock USDC mint address, Pool mint address, GlobalState PDA, SensorPool PDA, Pool vault address, Sensor pubkey, Cosigner pubkey, keypair file paths, and suggested `SOLANA_RPC_URL`, `PROGRAM_ID`, `COSIGNER_KEYPAIR_PATH`, `SENSOR_KEYPAIR_PATH` values

### Requirement: Bootstrap is devnet-only
The script SHALL verify the RPC endpoint resolves to devnet by checking the genesis hash. If the cluster is not devnet, the script SHALL abort with an error message.

#### Scenario: Script run against mainnet RPC
- **WHEN** the bootstrap script is invoked with a mainnet-beta RPC URL
- **THEN** the script exits with error "This script only works on devnet" before any transactions

#### Scenario: Script run against devnet RPC
- **WHEN** the bootstrap script is invoked with a devnet RPC URL (default or explicit)
- **THEN** the genesis hash check passes and the script proceeds

### Requirement: Bootstrap handles airdrop failure gracefully
The script SHALL attempt to airdrop SOL to the payer wallet if the balance is below a threshold (2 SOL). If the airdrop fails (rate limit, faucet dry), the script SHALL print a warning with instructions to use the web faucet and continue execution if sufficient SOL exists.

#### Scenario: Payer has insufficient SOL and airdrop succeeds
- **WHEN** payer balance is below 2 SOL and devnet airdrop succeeds
- **THEN** SOL is airdropped and the script continues

#### Scenario: Payer has insufficient SOL and airdrop fails
- **WHEN** payer balance is below 2 SOL and airdrop request fails
- **THEN** a warning is printed with a link to https://faucet.solana.com, and the script continues if balance is above 0.5 SOL, or aborts if balance is 0
