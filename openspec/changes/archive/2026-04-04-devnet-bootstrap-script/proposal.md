## Why

The program is deployed to devnet (`ETu1YLCnZyeeWBYYLSFXLNncJa4AgaHaZQ8JSUxTEosJ`) but has no on-chain state — no pool, no sensors, no USDC mint. Without initialized state, neither the backend payment flow nor the frontend chain integration can be tested. Every developer and demo run needs a reproducible one-command setup that provisions the full devnet environment.

## What Changes

- **New bootstrap script** (`scripts/bootstrap-devnet.ts`) that:
  - Creates a mock USDC SPL token mint (6 decimals) on devnet
  - Calls `initialize_pool` with the deployed program (creates GlobalState, SensorPool, Token-2022 mint with TransferHook, USDC vault ATA, ExtraAccountMetaList)
  - Registers a test sensor (model_id=3 "Mock Dev Sensor", fee=$5, 50 tokens) via `register_sensor`
  - Generates co-signer and sensor Ed25519 keypairs (or reuses existing ones)
  - Mints test USDC to a payer wallet for payment testing
  - Outputs all addresses and keypair paths needed for `.env` files
- **Updated `.env.example` files** with concrete variable descriptions and bootstrap output references
- **Updated README** Getting Started section with bootstrap instructions

## Capabilities

### New Capabilities
- `devnet-bootstrap`: Automated provisioning of all on-chain accounts and keypairs needed to run the full SolSensor stack on devnet

### Modified Capabilities

## Impact

- New: `scripts/bootstrap-devnet.ts` + `scripts/package.json` (standalone ts scripts with `@solana/kit` dependencies)
- Modified: `backend/.env.example`, `frontend/.env.example`, `README.md`
- Dependencies: `@solana/kit`, `@solana-program/token-2022`, `@solana-program/system`, `@solana-program/associated-token`
- Requires: local Solana CLI keypair at `~/.config/solana/id.json` funded with devnet SOL
