## ADDED Requirements

### Requirement: 402 challenge returns real on-chain addresses
The 402 response SHALL include PDA addresses derived from the deployed program ID and canonical seeds: `SensorPool` from `["pool"]`, pool vault from the pool's associated USDC token account, `HardwareEntry` from `["hw", sensor_pubkey]`. The response SHALL also include the USDC mint address and the hardware owner's USDC token account address. Placeholder/fake addresses SHALL NOT appear in the response.

#### Scenario: Client receives 402 with real addresses
- **WHEN** a client sends `GET /api/v1/sensors/AQI` without an `x-query-receipt` header
- **THEN** the response is HTTP 402 with `payment.programId` equal to the deployed program ID, `payment.accounts.sensorPool` derived from `["pool"]` seed, `payment.accounts.poolVault` derived from the pool's vault ATA, and `payment.accounts.hardwareEntry` derived from `["hw", sensor_pubkey]`

#### Scenario: 402 includes USDC mint address
- **WHEN** a client receives the 402 challenge
- **THEN** `payment.accounts.usdcMint` SHALL be present and match the mock USDC Token-2022 mint configured via environment

### Requirement: Receipt decoder matches 114-byte layout
The `decodeQueryReceipt` function SHALL decode the full 114-byte `QueryReceipt` layout: `[0..8] discriminator, [8..40] sensor_id, [40..72] payer, [72..80] amount, [80..88] pool_share, [88..96] total_supply_at_payment, [96] consumed, [97..105] created_at, [105..113] expiry_slot, [113] bump`. It SHALL validate `data.length >= 114` and verify the 8-byte Anchor discriminator before decoding.

#### Scenario: Valid 114-byte receipt decoded
- **WHEN** `decodeQueryReceipt` receives a 114-byte account data with correct discriminator
- **THEN** it returns all fields including `poolShare` and `totalSupplyAtPayment` at the correct offsets

#### Scenario: Short data rejected
- **WHEN** `decodeQueryReceipt` receives data shorter than 114 bytes
- **THEN** it throws an error indicating invalid receipt data

#### Scenario: Wrong discriminator rejected
- **WHEN** `decodeQueryReceipt` receives 114+ bytes with an incorrect discriminator
- **THEN** it throws an error indicating discriminator mismatch

### Requirement: Receipt validation checks sensor ID
The receipt verification middleware SHALL pass the expected sensor public key from the route to the validation function. `validateReceipt` SHALL reject any receipt whose `sensor_id` does not match the requested sensor.

#### Scenario: Receipt for wrong sensor rejected
- **WHEN** a client sends `x-query-receipt` pointing to a receipt where `sensor_id` is sensor A, but the request is for sensor B
- **THEN** the response is HTTP 403 with error message indicating sensor mismatch

#### Scenario: Receipt for correct sensor accepted
- **WHEN** a client sends `x-query-receipt` pointing to a receipt whose `sensor_id` matches the requested sensor
- **THEN** the request passes validation and continues to the sensor data handler

### Requirement: Post-delivery receipt consumption
After successfully sending sensor data to the client, the backend SHALL build and submit a `consume_receipt` transaction signed by the co-signer keypair. The instruction requires accounts: `consume_authority` (signer), `global_state` (PDA `["global"]`), `query_receipt` (PDA `["receipt", nonce]`), `payer` (from receipt data), `clock` (sysvar), `system_program`.

#### Scenario: Successful consume after data delivery
- **WHEN** the sensor data route handler has sent the 200 response
- **THEN** the backend builds a `consume_receipt` instruction with the co-signer as `consume_authority`, signs the transaction, and submits it to the cluster

#### Scenario: Consume failure does not affect data delivery
- **WHEN** the `consume_receipt` transaction fails (network error, expired receipt, already consumed)
- **THEN** the 200 response with sensor data has already been sent to the client, and the failure is logged with `[Consume]` prefix but no error propagates to the client

#### Scenario: Co-signer keypair missing
- **WHEN** the co-signer keypair file is not found at the configured path
- **THEN** the backend logs a warning at startup, receipt consumption is disabled, but the server still starts and serves data without consuming receipts

### Requirement: PDA derivation service
The backend SHALL have a `services/pda.ts` module that derives and caches all protocol PDAs: `globalState` from `["global"]`, `sensorPool` from `["pool"]`, `hardwareEntry` from `["hw", sensor_pubkey]`, and `receipt` from `["receipt", nonce]`. All derivations SHALL use `getProgramDerivedAddress` from `@solana/kit` with the configured program ID.

#### Scenario: PDAs derived at module load
- **WHEN** the backend starts and imports `services/pda.ts`
- **THEN** `globalState` and `sensorPool` PDAs are derived and available as exported constants

#### Scenario: Receipt PDA derived on demand
- **WHEN** `deriveReceiptPda(nonce)` is called with a 32-byte nonce
- **THEN** it returns the correct PDA address matching `["receipt", nonce]` seeds

### Requirement: Nonce extraction from receipt PDA
The receipt verifier SHALL extract the nonce from the validated receipt so it can be passed to the `consume_receipt` instruction. The nonce is part of the PDA seeds and must be recovered from the `x-query-receipt` header context or stored for downstream use.

#### Scenario: Nonce available for consumption
- **WHEN** a receipt is validated and the handler needs to consume it
- **THEN** the 32-byte nonce is available via `res.locals.receipt` or a dedicated field, enabling the consume instruction to be built with the correct seeds

### Requirement: PaymentChallenge accounts extended
The `PaymentAccounts` type SHALL include `usdcMint` and `hardwareOwnerUsdc` fields in addition to the existing `sensorPool`, `poolVault`, `hardwareEntry`, and `hardwareOwner`.

#### Scenario: Updated type includes all required accounts
- **WHEN** the frontend or any client consumes the 402 response
- **THEN** it has all accounts needed to build the `pay_for_query` instruction: `sensorPool`, `poolVault`, `hardwareEntry`, `hardwareOwner`, `usdcMint`, `hardwareOwnerUsdc`
