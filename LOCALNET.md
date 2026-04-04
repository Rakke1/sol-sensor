# Localnet Setup for SolSensor

This guide explains how to set up the SolSensor dapp on localnet for development.

## Quick Start

```bash
cd scripts && npm install
cd backend && npm install
cd fronted && npm install
```

```bash
# One-command setup (starts validator, deploys program, bootstraps)
./run-localnet.sh
```

This will:
1. Start `solana-test-validator` (if not running)
2. Deploy the sol_sensor program
3. Create mock USDC, initialize pool, register test sensor
4. Output all addresses and keypairs


## Configuration Files

After bootstrap completes, create these files:

### backend/.env
```bash
SOLANA_RPC_URL=http://localhost:8899
PROGRAM_ID=ETu1YLCnZyeeWBYYLSFXLNncJa4AgaHaZQ8JSUxTEosJ
COSIGNER_KEYPAIR_PATH=./scripts/keys/cosigner.json
SENSOR_KEYPAIR_PATH=./scripts/keys/sensor.json
```

## Testing

### E2E Payment Flow Test

```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Run test
cd scripts && npm run test-payment-flow:localnet http://localhost:3001
```

## Stop Localnet

To stop:

```bash
stop-localnet.sh
```

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `npm run bootstrap:localnet` | Bootstrap localnet (USDC, pool, sensor) |
| `npm run fund-wallet:localnet <ADDR>` | Fund wallet with mock USDC |
| `npm run test-payment-flow:localnet` | E2E test of payment flow |


## Troubleshooting

### "Transaction simulation failed"

**Cause**: Program not deployed  
**Fix**: Run `solana program deploy` manually with full path to keypair

### "Cannot connect to localnet at http://localhost:8899"

**Cause**: Test-validator not running  
**Fix**: Start with `solana-test-validator --bpf-program... spl_token_2022.so`

### "AccountNotFound: usdc-mint"

**Cause**: Bootstrap not completed  
**Fix**: Run `npm run bootstrap:localnet`

### Validator Crashes

The test-validator sometimes crashes with a `--reset` flag. Use startup without `--reset` to preserve state:

```bash
solana-test-validator --bpf-program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb spl_token_2022.so