<p align="center">
  <img src="https://img.shields.io/badge/Next.js-React-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js"/>
  <img src="https://img.shields.io/badge/Solana-Kit%20%2B%20React%20Hooks-14F195?style=for-the-badge&logo=solana&logoColor=white" alt="Solana Kit"/>
  <img src="https://img.shields.io/badge/Token--2022-Dashboard-9945FF?style=for-the-badge" alt="Token-2022"/>
</p>

# SolSensor — Frontend Dashboard

**Network contributor dashboard, unit economics simulator, and end-to-end client demo for the SolSensor DePIN protocol.**

A Next.js application built with `@solana/client` + `@solana/react-hooks` (framework-kit) and Wallet Standard-first connection. No legacy `@solana/wallet-adapter-react` — uses the modern Kit + framework-kit stack.

---

## Views

### View 1: Network Contributor Dashboard

The primary interface for token holders and hardware operators.

```
┌─────────────────────────────────────────────────────────────┐
│  🌐 SolSensor Network                    [Connect Wallet]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Your Position                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  1,250 SLSN  │  │  12.45 USDC  │  │  Pool: 78%   │      │
│  │  Token Balance│  │  Claimable   │  │  of Max Cap  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  [ Claim Rewards ]  [ Init Contributor Account ]            │
│                                                             │
│  Reward History                                             │
│  ├─ Claimed 3.20 USDC  ─  2 hours ago                      │
│  ├─ Claimed 5.10 USDC  ─  1 day ago                        │
│  └─ Claimed 4.15 USDC  ─  3 days ago                       │
│                                                             │
│  Pool Stats                                                 │
│  Total Supply: 8,000,000 / 10,000,000 SLSN                │
│  Active Sensors: 24    │    Total Queries: 15,230           │
│  Total Distributed: 761.50 USDC                            │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Real-time Token-2022 balance via `useBalance()` / account fetch hooks
- Claimable rewards computed client-side: `(balance × (global_index - paid_index)) / PRECISION_FACTOR`
- "Claim Rewards" button → sends `claim_rewards()` instruction via framework-kit transaction helpers
- "Init Contributor Account" button → calls `init_contributor()` (required before receiving tokens — needed by Transfer Hook)
- Pool utilization bar showing `total_supply / max_supply`
- Reward claim history from on-chain transaction parsing

### View 2: Unit Economics Playground

The **"Wow" factor** for hackathon judges. An interactive simulator that proves the economic viability of the SolSensor model.

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Unit Economics Simulator                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Adjust Parameters                                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Daily Queries:  ████████████░░░░░  500             │    │
│  │  Price / Query:  ████░░░░░░░░░░░░░  $0.05           │    │
│  │  Hardware Cost:  ██████████░░░░░░░  $300             │    │
│  │  Sensors in Pool: ████████░░░░░░░░  24              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Results                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  $25.00/day  │  │  $5.00/day   │  │  60 days     │      │
│  │  Network Rev │  │  HW Owner Rev│  │  Payback     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│      Revenue Over Time                                      │
│   $│                                    ╱──────            │
│    │                              ╱────╱                    │
│    │                        ╱────╱                          │
│    │                  ╱────╱                                │
│    │            ╱────╱                                      │
│    │      ╱────╱                 ── Network Revenue         │
│    │╱────╱                       ── HW Owner (20%)          │
│    └────────────────────────────────────── Days             │
│         30    60    90   120   150   180                    │
│                    ↑                                        │
│              Payback Point                                  │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Interactive sliders with real-time recalculation
- Core formula: `payback_days = hardware_cost / (daily_queries × price × 0.20)`
- Animated chart showing revenue accumulation over time (Recharts)
- Visual payback point indicator
- Comparison panel: SolSensor vs. Web2 API subscription pricing

### View 3: Client Simulator

A one-click end-to-end demo of the full HTTP 402 payment flow. Designed so judges can see the entire cycle in under 60 seconds.

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 Enterprise Client Simulator                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [ ▶ Run Full Demo ]                                        │
│                                                             │
│  Step 1: Request Data                          ✅ Complete  │
│  → GET /api/v1/sensors/AQI                                  │
│  ← HTTP 402: Payment Required (0.05 USDC)                  │
│                                                             │
│  Step 2: Pay On-Chain                          ✅ Complete  │
│  → pay_for_query(sensor_id, nonce)                          │
│  → Nonce: 7Hk9...mPq2                                      │
│  ← Receipt PDA: 4xR7...nB3w                                │
│  ← Tx: 2Yp5...kL8m  [View on Solscan ↗]                   │
│                                                             │
│  Step 3: Fetch Signed Data                     ✅ Complete  │
│  → GET /api/v1/sensors/AQI + receipt header                 │
│  ← AQI: 42 | Temp: 22.5°C | Humidity: 65%                  │
│                                                             │
│  Step 4: Verify Signature                      ✅ Verified  │
│  → Ed25519 signature verified against sensor pubkey         │
│  → Sensor: 9Bk2...rT4w                                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Raw Response JSON                              [Copy]│   │
│  │ {                                                    │   │
│  │   "data": { "aqi": 42, "temperature": 22.5, ... },  │   │
│  │   "proof": { "signature": "3xK...", ... }            │   │
│  │ }                                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Single "Run Full Demo" button executes all 4 steps sequentially with animated progress
- Each step shows the raw request/response for transparency
- Generates a random nonce using `crypto.getRandomValues()`
- Builds and sends the `pay_for_query` instruction using Kit types + framework-kit transaction helpers
- Links to Solscan for transaction verification
- **Client-side Ed25519 verification** using Kit's native codecs — proves cryptographic provenance without trusting the API
- Expandable raw JSON response panel

---

## Technical Implementation

### Provider Setup (`@solana/client` + `@solana/react-hooks`)

The app uses framework-kit's `SolanaProvider` with Wallet Standard-first auto-discovery — no manual wallet adapter configuration needed.

```tsx
// app/providers.tsx
'use client';

import React from 'react';
import { SolanaProvider } from '@solana/react-hooks';
import { autoDiscover, createClient } from '@solana/client';

const endpoint =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

const websocketEndpoint =
  endpoint.replace('https://', 'wss://').replace('http://', 'ws://');

export const solanaClient = createClient({
  endpoint,
  websocketEndpoint,
  walletConnectors: autoDiscover(), // Wallet Standard auto-discovery
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <SolanaProvider client={solanaClient}>{children}</SolanaProvider>;
}
```

Supported wallets (auto-discovered via Wallet Standard):
- Phantom
- Solflare
- Backpack
- Any Wallet Standard-compliant wallet

### Hook Usage

```tsx
import { useWalletConnection, useBalance } from '@solana/react-hooks';

function ContributorDashboard() {
  // Wallet connection (Wallet Standard)
  const { connected, walletAddress, connect, disconnect } = useWalletConnection();

  // SOL balance
  const { balance } = useBalance(walletAddress);

  // Custom hook for pool data (uses client.rpc directly)
  const { pool, contributor } = usePoolData(walletAddress);

  // ...
}
```

### On-Chain Data Fetching

All financial data is read directly from Solana PDAs via Kit's `fetchEncodedAccount` — never from the backend API:

```typescript
import { fetchEncodedAccount, assertAccountExists, address } from '@solana/kit';
import { solanaClient } from '@/app/providers';

// Fetch and decode SensorPool PDA
const poolAddress = address('<pool PDA>');
const account = await fetchEncodedAccount(solanaClient.rpc, poolAddress);
assertAccountExists(account);
const pool = decodeSensorPool(account.data);
```

**Reward calculation (client-side, mirrors on-chain math):**

```typescript
const PRECISION_FACTOR = BigInt(1_000_000_000_000); // 10^12

const pending = (
  userBalance * (pool.rewardPerToken - contributor.rewardPerTokenPaid)
) / PRECISION_FACTOR;

const claimable = pending + contributor.rewardsOwed;
```

Key accounts fetched:
| Account | Purpose |
|---------|---------|
| `SensorPool` | `reward_per_token`, `total_supply`, `max_supply`, `active_sensors` |
| `ContributorState` (user's) | `reward_per_token_paid`, `rewards_owed` |
| `GlobalState` | `total_queries`, `total_sensors` |
| Token-2022 Account (user's) | Token balance |

### Transaction Building

Instructions are built using Codama-generated Kit-compatible builders and sent via framework-kit transaction helpers:

```typescript
import {
  pipe, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstruction,
  signAndSendTransactionMessageWithSigners,
} from '@solana/kit';

// Example: claim_rewards instruction
const claimIx = getClaimRewardsInstruction({
  holder: walletSigner,           // Wallet Standard signer
  contributorState: contributorPDA,
  sensorPool: poolPDA,
  poolVault: vaultPDA,
  holderUsdc: holderUsdcATA,
  tokenProgram: address('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
});

const { value: latestBlockhash } = await solanaClient.rpc.getLatestBlockhash().send();

const message = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(walletSigner, m),
  m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
  m => appendTransactionMessageInstruction(claimIx, m),
);

const txSig = await signAndSendTransactionMessageWithSigners(message);
```

### Ed25519 Signature Verification

Client-side verification using Kit codecs for base58 decoding — no separate `bs58` dependency:

```typescript
import { getBase58Codec } from '@solana/kit';
import nacl from 'tweetnacl';

const base58 = getBase58Codec();

const isValid = nacl.sign.detached.verify(
  Buffer.from(proof.message, 'base64'),           // canonical data hash
  base58.encode(proof.signature)[0],                // Ed25519 signature
  base58.encode(proof.sensorPubkey)[0],             // sensor's public key
);
```

---

## Environment Variables

```env
# API
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=<deployed Anchor program ID>
NEXT_PUBLIC_SOLANA_NETWORK=devnet
```

---

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout, Providers wrapper
│   │   ├── providers.tsx            # SolanaProvider + client setup
│   │   ├── page.tsx                 # Landing / main dashboard
│   │   └── globals.css              # Design system tokens + global styles
│   ├── components/
│   │   ├── ContributorDashboard.tsx # View 1: balances, rewards, claim
│   │   ├── EconomicsPlayground.tsx  # View 2: sliders, charts, payback
│   │   ├── ClientSimulator.tsx      # View 3: end-to-end 402 demo
│   │   ├── PoolStats.tsx            # Pool metrics display
│   │   └── InitContributor.tsx      # init_contributor CTA button
│   ├── hooks/
│   │   ├── usePoolData.ts           # SensorPool PDA fetch + decode
│   │   ├── useContributor.ts        # ContributorState fetch + reward calc
│   │   └── useTokenBalance.ts       # Token-2022 balance hook
│   ├── lib/
│   │   ├── constants.ts             # Program ID, PDAs, precision factor
│   │   ├── program.ts              # Codama-generated instruction builders
│   │   └── verify.ts               # Ed25519 signature verification
│   └── types/
│       └── index.ts                 # Shared TypeScript interfaces
├── public/
│   └── favicon.ico
├── package.json
├── next.config.js
├── tsconfig.json
└── README.md
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@solana/kit` | Core SDK — addresses, signers, codecs, transaction building, `pipe` |
| `@solana/client` | Framework-kit client (`createClient` with wallet connectors) |
| `@solana/react-hooks` | `SolanaProvider`, `useWalletConnection`, `useBalance`, etc. |
| `@solana-program/token-2022` | Token-2022 instruction builders + account decoders |
| `@solana-program/system` | System program instructions |
| `next` | React framework |
| `recharts` | Interactive charts for Unit Economics view |
| `tweetnacl` | Ed25519 signature verification |

> **No `@solana/web3.js` or `@solana/wallet-adapter-react`** — the entire frontend uses Kit + framework-kit. Wallet Standard handles wallet discovery automatically.

---

## Development Roadmap

### Sprint 1 — MVP *(Days 1–4 of hackathon)*

| Task | Day | Details |
|------|-----|---------|
| Next.js scaffold + framework-kit provider | Day 1 | `create-next-app`, install `@solana/client`, `@solana/react-hooks`, `@solana/kit`. Wire up `SolanaProvider` with `autoDiscover()` |
| Layout + routing + design system | Day 1 | Global CSS tokens (colors, fonts, spacing), responsive shell with sidebar navigation between 3 views |
| View 3: Client Simulator | Day 3 | Build first — this is the end-to-end demo that validates the full stack. Random nonce generation, `pipe`-based `pay_for_query` transaction, receipt fetching, API call, Ed25519 verification |
| View 1: Contributor Dashboard | Day 4 | On-chain PDA fetching via `fetchEncodedAccount`, precision-scaled reward calculation with `BigInt`, `claim_rewards` button, `init_contributor` button, pool utilization bar |
| View 2: Economics Playground | Day 4 | Interactive sliders (daily queries, price, hardware cost), payback formula, animated revenue chart using Recharts, Web2 vs. SolSensor comparison panel |
| Polish + responsiveness | Day 5 | Animations, loading states, error toasts, mobile responsiveness, dark mode refinement |

### Sprint 2 — Post-Hackathon UX *(Q2 2026)*

- [ ] **Real-Time Updates** — use Kit's `rpcSubscriptions.accountNotifications()` for live reward accrual without page refresh
- [ ] **Sensor Map** — interactive map (Mapbox GL) showing registered sensor locations with status indicators (active / offline)
- [ ] **Transaction History** — full history of claims, payments, and token transfers parsed from on-chain signatures
- [ ] **Responsive Mobile** — PWA with mobile-optimized views for sensor operators checking rewards on the go
- [ ] **Notifications** — browser push notifications when claimable rewards exceed a threshold
- [ ] **Multi-language** — i18n support (EN / RU / KZ) for the target hackathon audience

### Sprint 3 — Platform Features *(Q3–Q4 2026)*

- [ ] **Sensor Registration Wizard** — step-by-step UI for hardware operators: select model → deposit registration fee → receive tokens → activate sensor
- [ ] **Pool Analytics Dashboard** — charts for query volume over time, revenue per sensor, reward distribution history, holder concentration
- [ ] **Data Explorer** — browse historical sensor data with search/filter by location, date, data type — each query paid via 402
- [ ] **Governance UI** — DAO proposal creation and voting interface for pool parameter changes (min price, split ratio, sensor allowlist)
- [ ] **SDK Playground** — in-browser code editor where developers can test `@solsensor/client` Kit plugin calls against the live devnet API

---

## Scripts

```bash
# Install dependencies
npm install

# Start dev server (hot reload on localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

---

## Design Principles

1. **Kit-first, no legacy** — all Solana interactions use `@solana/kit` types (`Address`, `Signature`, `KeyPairSigner`). No `PublicKey`, `Connection`, or `Transaction` from `@solana/web3.js`.
2. **Data from chain, not API** — all financial figures (balances, rewards, pool stats) are fetched directly from Solana PDAs via Kit's `fetchEncodedAccount`. The backend API is only used for sensor data delivery.
3. **Wallet Standard-first** — `autoDiscover()` finds all installed wallets. No manual adapter configuration or maintaining a wallet list.
4. **Verify, don't trust** — the Client Simulator demonstrates cryptographic verification at every step: on-chain receipt validation, Ed25519 data signatures, Solscan links.
5. **Progressive disclosure** — View 3 (Client Simulator) is the most impressive for demos. View 1 is the daily-use dashboard. View 2 sells the economics. Each serves a different audience.
6. **Precision math** — reward calculations use `BigInt` with the same `PRECISION_FACTOR = 10^12` as the on-chain program to ensure displayed values match exactly.

---

## License

[MIT](../LICENSE)
