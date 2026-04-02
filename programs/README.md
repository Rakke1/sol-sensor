<p align="center">
  <img src="https://img.shields.io/badge/Anchor-0.32.x-14F195?style=for-the-badge" alt="Anchor 0.32"/>
  <img src="https://img.shields.io/badge/Rust-1.81.0-CE422B?style=for-the-badge&logo=rust&logoColor=white" alt="Rust"/>
  <img src="https://img.shields.io/badge/Solana-2.1.x%20devnet-9945FF?style=for-the-badge&logo=solana&logoColor=white" alt="Solana 2.1"/>
  <img src="https://img.shields.io/badge/Token--2022-Transfer%20Hook-4a9eff?style=for-the-badge" alt="Token-2022"/>
</p>

# SolSensor — On-Chain Program

**Anchor smart contract managing the Token-2022 sensor pool, HTTP 402 payment receipts, atomic revenue splitting, and precision-scaled reward distribution.**

Deployed on Solana **devnet (2.1.x)**. Built with **Anchor 0.32.x**, compiled via **rustc 1.81.0**.

---

## Toolchain

| Tool | Version | Notes |
|------|---------|-------|
| `rustc` | 1.81.0 | Pin via `rust-toolchain.toml` |
| `solana-cli` | 2.1.x | Target devnet cluster |
| `anchor-cli` | 0.32.x | Use AVM for version management |
| `anchor-lang` | 0.32.x | Includes `LazyAccount`, custom discriminators |
| `solana-program` | 3.x | Required alongside Anchor 0.32 |

```toml
# rust-toolchain.toml
[toolchain]
channel = "1.81.0"
```

> **Anchor 0.32.x compatibility:** Run `cargo update base64ct --precise 1.6.0 && cargo update constant_time_eq --precise 0.4.1 && cargo update blake3 --precise 1.5.5` after initial setup to resolve build conflicts.

---

## On-Chain vs. Off-Chain Data

### Stored On-Chain (Program PDAs)

Everything that involves **money, ownership, or trust** lives on-chain:

| Data | Account | Why On-Chain |
|------|---------|-------------|
| Pool config (mint, vault, reward index, supply cap) | `SensorPool` | Controls token minting + reward math — must be tamper-proof |
| Global counters (total queries, total sensors) | `GlobalState` | Judges want verifiable metrics; prevents inflation of stats |
| Consume authority pubkey | `GlobalState` | Must be on-chain so `consume_receipt` can enforce signer check |
| Sensor registration (owner, model, status, fee) | `HardwareEntry` | Sensor identity is an RWA — on-chain proves it exists |
| Holder reward state (paid index, owed rewards) | `ContributorState` | Reward math must be atomic with on-chain transfers |
| Payment receipts (payer, amount, expiry, consumed) | `QueryReceipt` | Replay protection + refund mechanism must be trustless |
| Token-2022 mint + holder balances | Token-2022 accounts | Native Solana token standard |
| ExtraAccountMetaList (Transfer Hook config) | PDA | Required by Token-2022 runtime for hook invocation |

### Stored Off-Chain (API Server / Frontend)

Everything that is **ephemeral, bulky, or non-financial**:

| Data | Where | Why Off-Chain |
|------|-------|-------------|
| Sensor readings (AQI, temperature, humidity) | API response | Too frequent + large for on-chain storage; signed with Ed25519 for verifiability |
| Ed25519 sensor keypairs | API server filesystem | Hardware identity; production: stored in TEE |
| API co-signer keypair | API server filesystem | Operational key; on-chain only stores the pubkey |
| Historical query logs | Backend DB / logs | Analytics; on-chain has `total_queries` counter for aggregate |
| Unit economics calculations | Frontend (client-side) | Pure math on on-chain data; no state to persist |
| Sensor location metadata | Instruction data at registration | Not stored on-chain to save rent; could add later |

---

## State Accounts

### Account Layout & Sizing

| Account | Seeds | Rent (SOL) | Fields |
|---------|-------|-----------|--------|
| `GlobalState` | `["global"]` | ~0.0012 | `admin: Pubkey(32)`, `consume_authority: Pubkey(32)`, `total_sensors: u32(4)`, `total_queries: u64(8)`, `bump: u8(1)` |
| `SensorPool` | `["pool"]` | ~0.0016 | `mint: Pubkey(32)`, `vault: Pubkey(32)`, `reward_per_token: u128(16)`, `total_distributed: u64(8)`, `active_sensors: u32(4)`, `total_supply: u64(8)`, `max_supply: u64(8)`, `bump: u8(1)` |
| `HardwareEntry` | `["hw", sensor_pubkey]` | ~0.0014 | `owner: Pubkey(32)`, `sensor_pubkey: Pubkey(32)`, `model_id: u8(1)`, `is_active: bool(1)`, `registered_at: i64(8)`, `registration_fee: u64(8)`, `bump: u8(1)` |
| `ContributorState` | `["contrib", holder_pubkey]` | ~0.0011 | `holder: Pubkey(32)`, `reward_per_token_paid: u128(16)`, `rewards_owed: u64(8)`, `bump: u8(1)` |
| `QueryReceipt` | `["receipt", nonce]` | ~0.0014 | `sensor_id: Pubkey(32)`, `payer: Pubkey(32)`, `amount: u64(8)`, `consumed: bool(1)`, `created_at: i64(8)`, `expiry_slot: u64(8)`, `bump: u8(1)` |

> All sizes include the 8-byte Anchor discriminator. Rent values at ~6.96 lamports/byte for rent exemption.

### Account Lifecycle

```
GlobalState ──────── Created once at initialize_pool ─────── Lives forever
SensorPool ──────── Created once at initialize_pool ─────── Lives forever
HardwareEntry ───── Created at register_sensor ───────────── Lives while sensor is active
ContributorState ── Created at init_contributor ──────────── Lives while holder has tokens
QueryReceipt ────── Created at pay_for_query ──────────────── Closed at consume_receipt or refund
```

`QueryReceipt` is the **only ephemeral account** — it is created per query and destroyed after consumption (rent refunded). All other accounts are long-lived.

---

## Instructions

### Instruction Map

```
                ┌─────────────────────────────────┐
  Admin:        │  1. initialize_pool(max_supply)  │
                └─────────────────────────────────┘
                              │
     ┌────────────────────────┼──────────────────────────┐
     ▼                        ▼                          ▼
┌─────────────┐    ┌──────────────────┐    ┌───────────────────┐
│ 2. register │    │ 3. init_         │    │ 4. pay_for_query  │
│    _sensor  │    │    contributor   │    │    (sensor, nonce) │
└─────────────┘    └──────────────────┘    └─────────┬─────────┘
                                                     │
                           ┌─────────────────┬───────┴──────────┐
                           ▼                 ▼                  ▼
                   ┌──────────────┐  ┌───────────────┐  ┌──────────────┐
  API co-signer:   │ 5. consume_  │  │ 6. refund_    │  │ 7. claim_    │
                   │    receipt   │  │    expired_   │  │    rewards   │
                   │ (close PDA) │  │    receipt    │  │              │
                   └──────────────┘  └───────────────┘  └──────────────┘
                                                              │
                   ┌──────────────────────────────────────────┘
                   ▼
  Token-2022:  ┌───────────────┐     ┌───────────────┐
  (automatic)  │ 8. transfer_  │     │ 9. sync_      │  ← fallback
               │    hook       │     │    rewards    │
               └───────────────┘     └───────────────┘
```

### Fees & Compute Budget Estimates

| Instruction | Estimated CU | Accounts | Rent Cost | Notes |
|-------------|-------------|----------|-----------|-------|
| `initialize_pool` | ~100,000 | 8–10 | ~0.015 SOL | Creates mint, vault, GlobalState, SensorPool, ExtraAccountMetaList. One-time operation. High CU from Token-2022 CPI for mint creation with Transfer Hook extension. |
| `register_sensor` | ~80,000 | 8–9 | ~0.0014 SOL | HardwareEntry PDA init + Token-2022 `mint_to` CPI. USDC transfer CPI to vault. |
| `init_contributor` | ~25,000 | 4 | ~0.0011 SOL | Simple PDA init. Reads SensorPool for current `reward_per_token`. |
| `pay_for_query` | ~90,000 | 10–12 | ~0.0014 SOL | QueryReceipt PDA init + 2× Token-2022 transfer CPIs (hardware owner + vault) + accumulator math. Highest per-tx CU. Receipt rent is **refunded** on consume. |
| `consume_receipt` | ~30,000 | 5 | -0.0014 SOL | Marks consumed + closes PDA. **Net negative rent** — refunds to original payer. |
| `refund_expired_receipt` | ~60,000 | 8–10 | -0.0014 SOL | Reverses 20/80 split (2× transfer CPIs) + closes PDA. Clock sysvar read for slot check. |
| `claim_rewards` | ~45,000 | 7 | 0 | Reads SensorPool + ContributorState, computes pending, 1× transfer CPI from vault. |
| `transfer_hook` | ~50,000 | 6–8 | 0 | Pre-transfer balance reconstruction + 2× ContributorState updates. Invoked by Token-2022 runtime. Must fit within remaining CU budget of the parent transfer. |
| `sync_rewards` | ~45,000 | 6 | 0 | Same logic as `transfer_hook`, manually invoked. Fallback only. |

> **Total CU for a full query cycle** (pay + consume): ~120,000 CU. Well within the 200K default limit. Set compute budget to 150K with 1000 microlamports priority fee for devnet reliability.

### Net Cost Per Query (Client Perspective)

```
Payment:         0.05 USDC (fixed price)
Receipt rent:    ~0.0014 SOL (refunded on consume_receipt)
Transaction fee: ~0.000005 SOL × 2 txns (pay + later consume settles)
Priority fee:    ~0.00015 SOL (at 1000 microlamports × 150K CU)
─────────────────────────────────────────────────────────
Net cost:        0.05 USDC + ~0.000155 SOL in tx fees
                 (receipt rent is fully refunded)
```

---

## Constants

```rust
/// Precision scaling factor for reward_per_token accumulator.
/// Prevents integer truncation on micro-payments.
/// Example: 40,000 USDC-units / 1M tokens = 0 in integer math.
///          40,000 * 10^12 / 1M = 40,000,000,000 — no precision loss.
const PRECISION_FACTOR: u128 = 1_000_000_000_000; // 10^12

/// Hard cap on pool token supply. Prevents inflationary dilution.
const MAX_POOL_SUPPLY: u64 = 10_000_000;

/// Slots before an unconsumed receipt becomes refundable.
/// ~30 seconds at 400ms/slot during devnet 2.1.x.
const RECEIPT_EXPIRY_SLOTS: u64 = 75;

/// Revenue split in basis points (100 bps = 1%).
const SPLIT_HARDWARE_BPS: u16 = 2000; // 20% to hardware owner
const SPLIT_POOL_BPS: u16 = 8000;     // 80% to pool vault

/// Hardcoded sensor model allowlist with registration fees (USDC micro-units).
/// model_id => (name, registration_fee, tokens_minted)
const SENSOR_MODELS: [(u8, &str, u64, u64); 3] = [
    (1, "SenseCAP S2103", 150_000_000, 1_500),  // $150 fee → 1500 tokens
    (2, "RAKwireless RAK7204", 80_000_000, 800), // $80 fee → 800 tokens
    (3, "Mock Dev Sensor", 5_000_000, 50),        // $5 fee → 50 tokens (testing)
];
```

---

## Data Reading Strategy

### Primary: JSON-RPC via `@solana/kit`

All account data is read by clients using **standard Solana JSON-RPC** through `@solana/kit`:

```typescript
import { fetchEncodedAccount, assertAccountExists, address } from '@solana/kit';

// Fetch SensorPool PDA
const poolAddress = address('<pool PDA>');
const account = await fetchEncodedAccount(client.rpc, poolAddress);
assertAccountExists(account);

// Decode using Codama-generated decoder (from Anchor IDL)
const pool = decodeSensorPool(account.data);
// pool.rewardPerToken → bigint (u128)
// pool.totalSupply → bigint (u64)
// pool.maxSupply → bigint (u64)
```

| Method | Use Case | Kit API |
|--------|----------|---------|
| `getAccountInfo` | Fetch single PDA (SensorPool, ContributorState) | `fetchEncodedAccount(client.rpc, addr)` |
| `getMultipleAccounts` | Batch fetch pool + contributor + global in one RPC call | `fetchEncodedAccounts(client.rpc, [addr1, addr2, ...])` |
| `getTokenAccountsByOwner` | Get user's Token-2022 balance | `client.rpc.getTokenAccountsByOwner(owner, { mint }, { encoding: 'jsonParsed' }).send()` |
| `getProgramAccounts` | List all HardwareEntry PDAs (sensor registry) | `client.rpc.getProgramAccounts(programId, { filters: [...] }).send()` |
| `accountNotifications` | Real-time subscription to pool state changes | `rpcSubs.accountNotifications(addr, { encoding: 'base64' }).subscribe()` |

### Deserialization: Codama-Generated Decoders

The Anchor IDL is processed through **Codama** to generate Kit-native TypeScript decoders and instruction builders:

```bash
# Generate Kit-compatible client from Anchor IDL
npx @codama/cli generate \
  --idl target/idl/sol_sensor.json \
  --output ../frontend/src/lib/program.ts \
  --kit
```

This generates:
- `decodeSensorPool(data)`, `decodeContributorState(data)`, etc.
- `getPayForQueryInstruction({...})`, `getClaimRewardsInstruction({...})`, etc.
- All using Kit types (`Address`, `TransactionSigner`) — no `@solana/web3.js`

### Program Logs (Debugging & Analytics)

Program logs are emitted via Anchor's `msg!()` macro for key events:

```rust
msg!("pay_for_query: sensor={}, amount={}, nonce={:?}", sensor_id, amount, nonce);
msg!("reward_per_token updated: {} -> {}", old_index, new_index);
msg!("claim_rewards: holder={}, payout={}", holder, payout);
msg!("receipt_consumed: receipt={}, payer={}", receipt_pda, payer);
```

Logs are readable via:
- `getTransaction` RPC call (includes `logMessages` in response)
- Solscan / Solana Explorer transaction details
- `rpcSubs.logsNotifications(programId)` for real-time monitoring

> **No custom events / Anchor events in MVP.** Standard `msg!()` logs are sufficient for debugging and demo purposes. Anchor events (`emit!()`) add deserialization complexity without MVP value. Can be added post-hackathon for indexer integration (e.g., with Helius webhooks or Yellowstone gRPC).

---

## Testing Strategy

### Distribution: 80% Mollusk / 15% LiteSVM / 5% solana-test-validator

```
┌────────────────────────────────────────────────────────────┐
│                    Test Pyramid                            │
│                                                            │
│                        ╱╲                                  │
│                       ╱  ╲        5%  solana-test-         │
│                      ╱    ╲           validator            │
│                     ╱──────╲          (smoke tests)        │
│                    ╱        ╲                               │
│                   ╱   15%    ╲     LiteSVM                 │
│                  ╱  LiteSVM   ╲   (multi-ix flows)         │
│                 ╱──────────────╲                            │
│                ╱                ╲                           │
│               ╱    80% Mollusk   ╲  (unit tests per ix)    │
│              ╱────────────────────╲                         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Mollusk (80%) — Per-Instruction Unit Tests

Fast, in-process instruction-level testing with CU benchmarking. No validator startup. Ideal for verifying each instruction in isolation.

```rust
use mollusk_svm::Mollusk;
use mollusk_svm::result::Check;
use mollusk_svm_programs_token::token;

#[test]
fn test_pay_for_query_splits_correctly() {
    let program_id = Pubkey::new_unique();
    let mollusk = Mollusk::new(&program_id, "target/deploy/sol_sensor");
    token::add_program(&mut mollusk);  // Add Token-2022

    // Setup accounts: payer USDC, vault, hardware owner, pool PDA, receipt PDA...
    let accounts = setup_pay_for_query_accounts(/*...*/);

    let ix = Instruction {
        program_id,
        accounts: vec![/* account metas */],
        data: PayForQueryData { sensor_id, nonce, amount: 50_000 }.try_to_vec().unwrap(),
    };

    mollusk.process_and_validate_instruction(
        &ix,
        &accounts,
        &[
            Check::success(),
            Check::compute_units(90_000),  // CU budget assertion
        ],
    );

    // Verify 20/80 split in resulting account states
    let hw_owner_balance = get_token_balance(&result, hw_owner_ata);
    let vault_balance = get_token_balance(&result, pool_vault);
    assert_eq!(hw_owner_balance, 10_000);  // 20% of 50,000
    assert_eq!(vault_balance, 40_000);     // 80% of 50,000
}
```

**Mollusk test coverage:**

| Test | What It Validates |
|------|-------------------|
| `test_initialize_pool` | Mint creation, GlobalState + SensorPool init, ExtraAccountMetaList setup |
| `test_register_sensor_valid_model` | HardwareEntry creation, token minting, fee deposit, supply cap enforcement |
| `test_register_sensor_invalid_model` | Rejects unrecognized `model_id` |
| `test_register_sensor_supply_cap` | Fails when `total_supply + mint_amount > max_supply` |
| `test_init_contributor` | ContributorState creation with current `reward_per_token` snapshot |
| `test_pay_for_query_split` | 20/80 USDC split, receipt PDA creation, accumulator increment |
| `test_pay_for_query_duplicate_nonce` | Rejects second call with same nonce (PDA already exists) |
| `test_pay_for_query_precision` | Accumulator math with extreme ratios (1 lamport / 1M supply) |
| `test_consume_receipt_authority` | Only `consume_authority` signer can consume; rejects others |
| `test_consume_receipt_closes_pda` | PDA closed, rent refunded to payer |
| `test_consume_already_consumed` | Rejects consuming a receipt twice |
| `test_refund_expired_receipt` | Refunds USDC after `expiry_slot`, closes PDA |
| `test_refund_not_expired` | Rejects refund before expiry |
| `test_claim_rewards_math` | Correct payout calculation with precision scaling |
| `test_claim_rewards_zero` | No-ops when pending = 0 |
| `test_transfer_hook_balance_reconstruction` | Sender pending uses pre-transfer balance, receiver indexed correctly |
| `test_transfer_hook_double_claim_prevention` | Transfer → claim by both parties → no over-distribution |

**CU Benchmarking:**

```rust
use mollusk_svm::MolluskComputeUnitBencher;

#[test]
fn bench_all_instructions() {
    let mollusk = Mollusk::new(&program_id, "target/deploy/sol_sensor");
    let bencher = MolluskComputeUnitBencher::new(mollusk)
        .must_pass(true)
        .out_dir("../target/benches");

    bencher.bench("initialize_pool", &init_ix, &init_accounts);
    bencher.bench("pay_for_query", &pay_ix, &pay_accounts);
    bencher.bench("consume_receipt", &consume_ix, &consume_accounts);
    bencher.bench("claim_rewards", &claim_ix, &claim_accounts);
    bencher.bench("transfer_hook", &hook_ix, &hook_accounts);

    // Generates markdown report: target/benches/*.md
}
```

### LiteSVM (15%) — Multi-Instruction Flow Tests

Tests that need **sequential state** across multiple instructions. Runs in-process (no validator), but simulates full transaction lifecycle.

```rust
use litesvm::LiteSVM;

#[test]
fn test_full_query_lifecycle() {
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(program_id, "target/deploy/sol_sensor.so");

    let admin = Keypair::new();
    let client = Keypair::new();
    let hw_owner = Keypair::new();
    svm.airdrop(&admin.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&client.pubkey(), 10_000_000_000).unwrap();

    // 1. Initialize pool
    let tx1 = build_initialize_pool_tx(&admin, &svm);
    svm.send_transaction(tx1).unwrap();

    // 2. Register sensor (hw_owner gets tokens)
    let tx2 = build_register_sensor_tx(&hw_owner, model_id: 3, &svm);
    svm.send_transaction(tx2).unwrap();

    // 3. Client pays for query
    let nonce = rand::random::<[u8; 32]>();
    let tx3 = build_pay_for_query_tx(&client, sensor_id, nonce, &svm);
    svm.send_transaction(tx3).unwrap();

    // Verify receipt PDA exists
    let receipt_pda = derive_receipt_pda(&nonce);
    let receipt_data = svm.get_account(&receipt_pda).unwrap();
    assert!(!receipt_data.consumed);

    // 4. Consume receipt (as API co-signer)
    let tx4 = build_consume_receipt_tx(&cosigner, receipt_pda, &svm);
    svm.send_transaction(tx4).unwrap();

    // Verify receipt PDA is closed (rent refunded)
    assert!(svm.get_account(&receipt_pda).is_none());

    // 5. Hardware owner claims rewards
    let tx5 = build_claim_rewards_tx(&hw_owner, &svm);
    svm.send_transaction(tx5).unwrap();

    // Verify USDC payout
    let hw_usdc = get_token_balance(&svm, hw_owner_ata);
    assert!(hw_usdc > 0);
}

#[test]
fn test_receipt_expiry_refund() {
    let mut svm = LiteSVM::new();
    // ... setup ...

    // Pay for query
    svm.send_transaction(pay_tx).unwrap();

    // Warp clock past expiry
    svm.warp_to_slot(svm.get_slot() + RECEIPT_EXPIRY_SLOTS + 1);

    // Refund should succeed
    svm.send_transaction(refund_tx).unwrap();

    // Verify USDC returned to payer
    let payer_usdc = get_token_balance(&svm, payer_ata);
    assert_eq!(payer_usdc, original_balance); // Full refund
}

#[test]
fn test_transfer_hook_settles_rewards() {
    let mut svm = LiteSVM::new();
    // ... setup pool, register sensor, init 2 contributors ...

    // Generate some revenue (3 queries)
    for _ in 0..3 {
        svm.send_transaction(build_pay_for_query_tx(/*...*/)).unwrap();
    }

    // Transfer tokens from holder_a to holder_b
    svm.send_transaction(build_token_transfer_tx(holder_a, holder_b, 100)).unwrap();

    // Both holders should have correct pending rewards
    // holder_a: rewards based on pre-transfer balance
    // holder_b: indexed at current reward_per_token (no free rewards)
}
```

### solana-test-validator (5%) — Devnet Smoke Tests

End-to-end integration on a real validator. Used **only** for final validation before devnet deploy:

```bash
# Start local validator with Token-2022 program
solana-test-validator \
  --bpf-program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
    spl_token_2022.so \
  --reset

# Deploy program
NO_DNA=1 anchor deploy --provider.cluster localnet

# Run smoke tests
NO_DNA=1 anchor test --skip-build --provider.cluster localnet
```

**Smoke test scope** (TypeScript via Anchor TS + `@solana/web3-compat` boundary):
- Full happy-path: init → register → pay → consume → claim
- Token transfer triggers Transfer Hook
- Verify devnet RPC compatibility (no LiteSVM/Mollusk quirks)

### Test Layout

```
programs/sol-sensor/
├── src/
│   └── lib.rs
├── tests/
│   ├── unit/                          # 80% Mollusk
│   │   ├── mod.rs
│   │   ├── initialize_pool.rs
│   │   ├── register_sensor.rs
│   │   ├── init_contributor.rs
│   │   ├── pay_for_query.rs
│   │   ├── consume_receipt.rs
│   │   ├── refund_expired_receipt.rs
│   │   ├── claim_rewards.rs
│   │   ├── transfer_hook.rs
│   │   ├── sync_rewards.rs
│   │   └── cu_benchmarks.rs           # CU profiling
│   ├── flows/                         # 15% LiteSVM
│   │   ├── mod.rs
│   │   ├── full_query_lifecycle.rs
│   │   ├── receipt_expiry_refund.rs
│   │   ├── transfer_hook_settlement.rs
│   │   └── supply_cap_enforcement.rs
│   ├── smoke/                         # 5% solana-test-validator
│   │   └── e2e.ts                     # Anchor TS (behind web3-compat boundary)
│   └── fixtures/
│       ├── accounts.rs                # Shared account factory helpers
│       └── instructions.rs            # Shared instruction builders
├── Cargo.toml
└── Anchor.toml
```

---

## Project Structure

```
programs/
├── sol-sensor/
│   ├── src/
│   │   ├── lib.rs                     # Program entrypoint, declare_id!
│   │   ├── state/
│   │   │   ├── mod.rs
│   │   │   ├── global_state.rs        # GlobalState account struct
│   │   │   ├── sensor_pool.rs         # SensorPool + constants
│   │   │   ├── hardware_entry.rs      # HardwareEntry + model allowlist
│   │   │   ├── contributor_state.rs   # ContributorState + reward math
│   │   │   └── query_receipt.rs       # QueryReceipt + expiry logic
│   │   ├── instructions/
│   │   │   ├── mod.rs
│   │   │   ├── initialize_pool.rs     # Pool + mint + hook setup
│   │   │   ├── register_sensor.rs     # Sensor onboarding + token mint
│   │   │   ├── init_contributor.rs    # ContributorState PDA init
│   │   │   ├── pay_for_query.rs       # Core payment + split + accumulator
│   │   │   ├── consume_receipt.rs     # Authority-gated consumption + close
│   │   │   ├── refund_expired.rs      # Timeout-based refund
│   │   │   ├── claim_rewards.rs       # Precision-scaled payout
│   │   │   ├── transfer_hook.rs       # Token-2022 hook + balance reconstruction
│   │   │   └── sync_rewards.rs        # Manual fallback
│   │   └── errors.rs                  # Custom error codes
│   ├── tests/                         # Mollusk + LiteSVM + smoke tests
│   ├── Cargo.toml
│   └── Xargo.toml
├── Anchor.toml                        # Workspace config (cluster, program ID, wallet)
└── README.md
```

---

## Development Roadmap

### Sprint 1 — MVP *(Days 1–3 of hackathon)*

| Task | Day | Tests |
|------|-----|-------|
| Anchor workspace setup, `rust-toolchain.toml`, cargo version pins | Day 1 | Build sanity check |
| `initialize_pool` + Token-2022 Mint with Transfer Hook + ExtraAccountMetaList | Day 1 | Mollusk: mint creation, PDA seeds, hook config |
| `init_contributor` | Day 1 | Mollusk: PDA init, current index snapshot |
| `transfer_hook` + `sync_rewards` (fallback) | Day 2 | Mollusk: balance reconstruction, double-claim prevention |
| `register_sensor` | Day 2 | Mollusk: allowlist, fee transfer, supply cap |
| `pay_for_query` (nonce PDA) + `consume_receipt` (authority + close) | Day 2 | Mollusk: split math, nonce replay, authority check, PDA close |
| `claim_rewards` + `refund_expired_receipt` | Day 3 | Mollusk: precision edge cases, expiry timing |
| Full Anchor test suite | Day 3 | LiteSVM: full lifecycle, expiry refund, hook settlement |
| CU benchmarks | Day 3 | Mollusk: CU profiling for all 9 instructions |

### Sprint 2 — Hardening *(Day 4 + post-hackathon)*

| Task | Timeline |
|------|----------|
| Edge cases: insufficient balance, double-claim, inactive sensor | Day 4 |
| solana-test-validator smoke test (happy path) | Day 4 |
| Transfer Hook integration test with real Token-2022 transfers | Day 4 |
| Deploy to devnet, verify all PDAs | Day 5 |

### Sprint 3 — Post-Hackathon *(Q2 2026)*

- [ ] **On-chain Ed25519 verification** — add `ed25519_program` precompile check in `pay_for_query`
- [ ] **Multi-pool support** — parameterize SensorPool seeds by `pool_id`
- [ ] **Governance instruction** — DAO-controlled updates to split ratios, min price, sensor allowlist
- [ ] **Anchor events** — `emit!()` for indexer integration (Helius webhooks, Yellowstone gRPC)
- [ ] **Security audit** — formal review before mainnet
- [ ] **Pinocchio migration** — port hot paths (`pay_for_query`, `claim_rewards`) for CU optimization

---

## Build & Test Commands

```bash
# Build (agent-safe)
NO_DNA=1 anchor build

# Run Mollusk + LiteSVM tests
cargo test-sbf

# Run CU benchmarks (generates reports in target/benches/)
cargo test-sbf -- cu_benchmarks --nocapture

# Run smoke tests (requires running solana-test-validator)
NO_DNA=1 anchor test --skip-build

# Deploy to devnet
NO_DNA=1 anchor deploy --provider.cluster devnet

# Verify deployment
solana program show <PROGRAM_ID> --url devnet
```

---

## Security Checklist

- [x] All accounts use typed `Account<'info, T>` over `UncheckedAccount`
- [x] PDA seeds are canonical and stable (no user-controlled seed material beyond pubkeys)
- [x] `consume_receipt` requires `consume_authority` signer check (`has_one`)
- [x] `refund_expired_receipt` validates `Clock::slot > expiry_slot`
- [x] Token transfers use `Interface<'info, TokenInterface>` for Token-2022 compatibility
- [x] `reward_per_token` uses `u128` with `PRECISION_FACTOR` to prevent truncation
- [x] Transfer Hook reconstructs pre-transfer balances to prevent reward theft
- [x] `MAX_POOL_SUPPLY` cap prevents inflationary token minting
- [x] Receipt PDAs seeded by random nonce — no predictable seeds for front-running
- [x] `close = payer` on receipts returns rent to the original payer, not a third party
- [ ] **TODO (post-hackathon):** Formal audit, overflow checks on accumulator math at u128 boundary

---

## License

[MIT](../LICENSE)
