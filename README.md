<p align="center">
  <a href="https://github.com/Rakke1/sol-sensor/actions/workflows/programs-ci.yml">
    <img src="https://github.com/Rakke1/sol-sensor/actions/workflows/programs-ci.yml/badge.svg" alt="Programs CI"/>
  </a>
  <img src="https://img.shields.io/badge/Solana-Devnet-14F195?style=for-the-badge&logo=solana&logoColor=white" alt="Solana Devnet"/>
  <img src="https://img.shields.io/badge/Token--2022-Transfer%20Hook-9945FF?style=for-the-badge" alt="Token-2022"/>
  <img src="https://img.shields.io/badge/HTTP-402%20Payments-4a9eff?style=for-the-badge" alt="HTTP 402"/>
  <img src="https://img.shields.io/badge/%40solana%2Fkit-v6-3178C6?style=for-the-badge" alt="Solana Kit"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License"/>
</p>

# SolSensor

**Tokenized IoT Sensor Pools × HTTP 402 Machine-to-Machine Micro-Payments on Solana**

> A DePIN protocol that pools real-world air quality sensors into a single tokenized network, then monetizes their data through HTTP 402 micro-payments — with atomic on-chain revenue splitting and trustless reward distribution.

---

## The Problem

Today's IoT data market is broken in two ways:

1. **For hardware operators:** Deploying a $300–$500 environmental sensor generates no revenue. DePIN projects that tokenize *individual* devices expose operators to single-point-of-failure risk — if your one sensor goes offline, your income drops to zero.

2. **For data consumers:** Enterprise clients needing hyper-local air quality data (insurers, agricultural firms, AI weather models) are locked into $350–$1,000/month SaaS subscriptions with interpolated, non-verifiable data. There's no pay-as-you-go API for cryptographically provable ground-truth measurements.

## The Solution

**SolSensor** bridges both sides:

- **Hardware operators** register sensors into a city-wide **pool** and receive Token-2022 contributor tokens. The pool diversifies risk — if one sensor goes offline, rewards still flow from the rest.
- **Data consumers** query the SolSensor API and receive an `HTTP 402 Payment Required` challenge. They pay 0.05 USDC on-chain via a single Solana instruction. The payment is **atomically split** (20% to the hardware owner, 80% to the pool vault) inside the same transaction — no crank, no off-chain settlement.
- **Token holders** claim their share of pooled revenue at any time using a gas-efficient O(1) reward accumulator (Synthetix-style), with full precision scaling to prevent rounding loss.

Every data response includes an **Ed25519 signature** from the source sensor, enabling clients to independently verify data authenticity without trusting the API.

---

## Architecture

```
┌─────────────────┐     HTTP 402      ┌──────────────────┐
│  Enterprise      │◄────────────────►│  SolSensor API    │
│  Client / Agent  │  pay → receipt   │  (Express.js)     │
└────────┬────────┘                   └────────┬─────────┘
         │                                      │
         │  pay_for_query(sensor_id, nonce)     │  consume_receipt (co-signer)
         │                                      │
         ▼                                      ▼
┌─────────────────────────────────────────────────────────┐
│                  Anchor Program (Solana)                 │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐  │
│  │ Sensor   │  │ Query    │  │ SensorPool            │  │
│  │ Registry │  │ Receipts │  │ • reward_per_token     │  │
│  │ (PDAs)   │  │ (PDAs)   │  │ • vault (USDC)        │  │
│  └──────────┘  └──────────┘  │ • Token-2022 Mint     │  │
│                               │   + Transfer Hook     │  │
│                               └───────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         ▲                              │
         │  claim_rewards()             │  20% direct to
         │                              │  hardware owner
┌────────┴────────┐                     ▼
│  Token Holder    │           ┌──────────────────┐
│  (Contributor)   │           │  Hardware Owner   │
└─────────────────┘           └──────────────────┘
```

### Core Components

| Component | Tech | Role |
|-----------|------|------|
| **Smart Contract** | Rust / Anchor | Token-2022 pool management, on-chain payment verification, atomic revenue splits, claim-based rewards, Transfer Hook |
| **API Gateway** | TypeScript / Express / `@solana/kit` | HTTP 402 payment middleware, on-chain receipt verification via Kit RPC, Ed25519-signed sensor data delivery |
| **Dashboard** | Next.js / `@solana/kit` v6 + `@solana/web3.js` | Phantom wallet connection, contributor dashboard with real on-chain data, unit economics simulator, end-to-end client demo with signature verification |

### Key Technical Highlights

- **Token-2022 Transfer Hook** — automatically settles pending rewards for both sender and receiver on every token transfer, preventing double-claim exploits
- **Precision-Scaled Accumulator** — `reward_per_token` uses a `10^12` scaling factor to eliminate integer truncation on micro-payments
- **Nonce-Based Replay Protection** — each payment creates a PDA seeded by a client-generated random nonce; Solana's runtime rejects duplicates at the account-init level
- **Timeout Refund** — if the API doesn't consume a receipt within ~30 seconds, the client can call `refund_expired_receipt()` to reclaim USDC — no trust required
- **Verifiable Data** — every API response includes the raw Ed25519 signature and sensor public key for client-side verification

> See [`backend/README.md`](./backend/README.md) and [`frontend/README.md`](./frontend/README.md) for component-level technical details and roadmaps.

---

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) ≥ 1.75
- [Solana CLI](https://docs.solanalabs.com/cli/install) ≥ 1.18
- [Anchor](https://www.anchor-lang.com/docs/installation) ≥ 0.30
- [Node.js](https://nodejs.org/) ≥ 18
- A Solana wallet with devnet SOL (`solana airdrop 2`)

### Quick Start (Devnet)

The program is already deployed to devnet at [`ETu1YLCnZyeeWBYYLSFXLNncJa4AgaHaZQ8JSUxTEosJ`](https://explorer.solana.com/address/ETu1YLCnZyeeWBYYLSFXLNncJa4AgaHaZQ8JSUxTEosJ?cluster=devnet).

```bash
# 1. Clone the repo
git clone https://github.com/Rakke1/sol-sensor.git
cd sol-sensor

# 2. Bootstrap devnet environment (creates mock USDC, pool, test sensor, keypairs)
cd scripts && npm install
npx tsx bootstrap-devnet.ts
# The script prints all on-chain addresses — copy them for the next step

# 3. Configure environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Paste USDC_MINT_ADDRESS, POOL_MINT_ADDRESS, etc. from bootstrap output

# 4. Fund your Phantom wallet with mock USDC for testing
npx tsx fund-wallet.ts <YOUR_PHANTOM_ADDRESS> 100
cd ..

# 5. Start the API server
cd backend && npm install
npx ts-node src/index.ts

# 6. Start the frontend (in another terminal)
cd frontend && npm install
npm run dev
```

Open http://localhost:3000, connect Phantom (devnet), and run the **Client Simulator** demo.

The bootstrap script is **idempotent** — re-running it skips already-completed steps.

### Build & Deploy (from source)

```bash
# Build the Anchor program
cd programs
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Run unit tests
anchor test
```

---

## Project Structure

```
sol-sensor/
├── programs/                 # Anchor smart contract (Rust)
│   └── sol-sensor/src/
│       ├── instructions/     # initialize_pool, pay_for_query, consume_receipt, etc.
│       └── state/            # GlobalState, SensorPool, QueryReceipt, ContributorState
├── backend/                  # HTTP 402 API gateway (TypeScript + @solana/kit)
│   ├── src/
│   │   ├── middleware/       # http402 payment challenge, receiptVerifier
│   │   ├── services/        # solana.ts (RPC + consume_receipt), pda.ts, sensorSimulator
│   │   ├── utils/           # base58, ATA derivation
│   │   └── index.ts
│   └── keys/                # cosigner.json, sensor.json
├── frontend/                 # Next.js dashboard (@solana/kit + @solana/web3.js)
│   ├── src/
│   │   ├── components/      # ContributorDashboard, ClientSimulator, PoolStats
│   │   ├── hooks/           # usePoolData, useContributor, useTokenBalance (on-chain)
│   │   └── lib/             # rpc, pda, program, tx, decoders, format, verify
│   └── .env.example
├── scripts/                  # Devnet tooling (@solana/kit)
│   ├── bootstrap-devnet.ts  # One-command devnet setup
│   ├── fund-wallet.ts       # Mint mock USDC to any wallet
│   ├── test-payment-flow.ts # E2E smoke test
│   └── lib/                 # Shared: keypair, rpc, pda, instructions
└── openspec/                 # Change management artifacts
```

---

## Roadmap

### Phase 0 — Hackathon MVP *(Now → April 7, 2026)*

| Day | Milestone | Status |
|-----|-----------|--------|
| 1 | Anchor scaffold, Token-2022 Mint + Transfer Hook + `ExtraAccountMetaList`, `init_contributor` instruction, Next.js skeleton | ✅ |
| 2 | `transfer_hook` + `sync_rewards` fallback, `register_sensor`, `pay_for_query` (nonce PDA), `consume_receipt` (authority + close), API with Ed25519 signing | ✅ |
| 3 | `claim_rewards` (precision-scaled), `refund_expired_receipt`, full Anchor test suite, end-to-end Client Simulator view | ✅ |
| 4 | Edge case hardening, Contributor Dashboard + Unit Economics Playground, sensor simulator cron | ✅ |
| 5 | Buffer — integration testing, devnet deploy, UI polish, pitch video | ✅ |

**MVP deliverables:**
- ✅ Deployed Anchor program on Solana devnet
- ✅ Token-2022 with Transfer Hook for airtight reward accounting
- ✅ HTTP 402 payment flow with on-chain receipt verification
- ✅ Atomic 20/80 revenue split in a single instruction
- ✅ Precision-scaled O(1) claim-based rewards
- ✅ Timeout-based refund for client protection
- ✅ Interactive dashboard with unit economics simulator

### Phase 1 — Post-Hackathon Hardening *(Q2 2026)*

- [ ] **TEE-Attested Hardware** — replace the mock sensor simulator with real SenseCAP / RAKwireless devices using Trusted Execution Environments for on-chain attestation
- [ ] **On-Chain Ed25519 Verification** — verify sensor signatures via Solana's `ed25519_program` precompile directly in `pay_for_query`, making data provenance fully trustless
- [ ] **Multi-Sensor Pool Support** — extend from a single pool to city-specific or sensor-type-specific pools with cross-pool analytics
- [ ] **Governance** — introduce a DAO for pool parameter management (min price, split ratios, sensor allowlist updates)
- [ ] **Mainnet Deployment** — security audit + mainnet launch with real USDC

### Phase 2 — Network Growth *(Q3–Q4 2026)*

- [ ] **x402 Standard Conformance** — align the HTTP 402 response format with the emerging x402 specification (Coinbase / a16z) for interoperability with other x402 clients
- [ ] **AI Agent SDK** — publish an npm/pip package enabling AI agents to autonomously discover, pay for, and consume SolSensor data feeds
- [ ] **Dynamic Pricing Oracle** — AI-driven pricing that adjusts micro-payment rates based on demand, data freshness, and sensor density
- [ ] **Hardware Onboarding Portal** — streamlined UX for sensor operators: plug in device → scan QR → register on-chain → start earning
- [ ] **Cross-Chain Bridges** — accept payments from EVM chains via Wormhole, expanding the client base beyond Solana-native wallets

### Phase 3 — Platform *(2027+)*

- [ ] **SolSensor Marketplace** — a discovery layer where data consumers browse available sensor pools by geography, data type, and quality score
- [ ] **Parametric Insurance Integration** — direct pipeline from SolSensor data feeds into on-chain parametric insurance contracts (crop insurance, flood insurance)
- [ ] **Hardware Financing** — use pool token revenue projections as collateral for under-collateralized loans to deploy new sensors in underserved areas

---

## License

[MIT](./LICENSE)
