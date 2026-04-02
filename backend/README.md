<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-Express.js-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/HTTP-402%20Payments-4a9eff?style=for-the-badge" alt="HTTP 402"/>
  <img src="https://img.shields.io/badge/Solana-Kit-14F195?style=for-the-badge&logo=solana&logoColor=white" alt="Solana Kit"/>
</p>

# SolSensor — Backend API

**HTTP 402 micro-payment gateway for machine-to-machine IoT data monetization on Solana.**

This is the off-chain API layer of the SolSensor protocol. It acts as a **data tollbooth**: clients pay on-chain via a Solana instruction, receive a receipt, then present that receipt to this API to unlock cryptographically signed sensor data.

Built with `@solana/kit` (Web3.js 2.0) — no legacy `@solana/web3.js` dependency.

---

## How It Works

### Payment Flow

```
Client                          API Server                      Solana
  │                                │                              │
  │  GET /api/v1/sensors/AQI       │                              │
  │──────────────────────────────►│                              │
  │                                │                              │
  │  HTTP 402 Payment Required     │                              │
  │  { price, instruction, nonce } │                              │
  │◄──────────────────────────────│                              │
  │                                │                              │
  │  pay_for_query(sensor_id, nonce, 0.05 USDC)                  │
  │──────────────────────────────────────────────────────────────►│
  │                                │          QueryReceipt PDA    │
  │◄──────────────────────────────────────────────────────────────│
  │                                │                              │
  │  GET /api/v1/sensors/AQI       │                              │
  │  Header: x-query-receipt: PDA  │                              │
  │──────────────────────────────►│                              │
  │                                │  verify PDA on-chain         │
  │                                │─────────────────────────────►│
  │                                │  consume_receipt (co-signer) │
  │                                │─────────────────────────────►│
  │                                │  PDA closed, rent refunded   │
  │                                │◄─────────────────────────────│
  │                                │                              │
  │  HTTP 200 + signed data        │                              │
  │◄──────────────────────────────│                              │
```

### Key Concepts

| Concept | Implementation |
|---------|---------------|
| **Payment challenge** | Returns `HTTP 402` with the Anchor instruction schema, program ID, required accounts, USDC price, and a suggested random nonce |
| **Receipt verification** | Reads the `QueryReceipt` PDA on-chain via `@solana/kit` RPC — checks `consumed == false` and `sensor_id` match |
| **Receipt consumption** | Builds and signs `consume_receipt` instruction using the co-signer `KeyPairSigner`, sends via `client.sendTransaction()` |
| **Data signing** | Every response payload is signed with an Ed25519 keypair (simulating a hardware sensor). The signature + public key are included in the response for client-side verification |

---

## Technical Details

### Solana Kit Integration

The backend uses `@solana/kit` for all on-chain interactions. No legacy `@solana/web3.js` dependency — Kit types (`Address`, `KeyPairSigner`, `Rpc`) are used throughout.

**Client setup:**

```typescript
import { createClient } from '@solana/kit-client-rpc';
import { createKeyPairSignerFromBytes, address } from '@solana/kit';

// Load co-signer from file
const cosignerBytes = JSON.parse(fs.readFileSync(COSIGNER_KEYPAIR_PATH, 'utf-8'));
const cosigner = await createKeyPairSignerFromBytes(new Uint8Array(cosignerBytes));

// Create Kit client
const client = createClient({
  url: process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
  payer: cosigner,
});

const PROGRAM_ID = address(process.env.PROGRAM_ID!);
```

**Fetching a QueryReceipt PDA:**

```typescript
import { fetchEncodedAccount, assertAccountExists } from '@solana/kit';

const receiptAddress = address(req.headers['x-query-receipt'] as string);
const account = await fetchEncodedAccount(client.rpc, receiptAddress);
assertAccountExists(account);

// Decode using Anchor IDL-generated codec (via Codama / @solana/codecs)
const receipt = decodeQueryReceipt(account.data);

if (receipt.consumed) {
  return res.status(403).json({ error: 'Receipt already consumed' });
}
```

**Sending `consume_receipt` instruction:**

```typescript
import {
  pipe, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstruction,
  signAndSendTransactionMessageWithSigners,
} from '@solana/kit';

const { value: latestBlockhash } = await client.rpc.getLatestBlockhash().send();

const consumeIx = getConsumeReceiptInstruction({
  authority: cosigner,
  receipt: receiptAddress,
  payer: address(receipt.payer), // rent refund target
});

const message = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(cosigner, m),
  m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
  m => appendTransactionMessageInstruction(consumeIx, m),
);

await signAndSendTransactionMessageWithSigners(message);
```

**Account subscriptions (receipt monitoring):**

```typescript
import { createSolanaRpcSubscriptions } from '@solana/kit';

const rpcSubs = createSolanaRpcSubscriptions('wss://api.devnet.solana.com');

// Watch for new receipts (optional real-time monitoring)
const sub = await rpcSubs.accountNotifications(poolAddress, {
  encoding: 'base64',
  commitment: 'confirmed',
}).subscribe();

for await (const notif of sub) {
  console.log('Pool state changed:', notif);
}
```

### API Endpoints

#### `GET /api/v1/sensors/:sensorType`

**Without receipt** → returns `HTTP 402`:
```json
{
  "status": 402,
  "message": "Payment Required",
  "payment": {
    "programId": "<SolSensor program ID>",
    "instruction": "pay_for_query",
    "price": { "amount": 50000, "currency": "USDC", "decimals": 6 },
    "suggestedNonce": "<base58 random 32 bytes>",
    "accounts": {
      "sensorPool": "<pool PDA>",
      "poolVault": "<vault PDA>",
      "hardwareEntry": "<sensor PDA>",
      "hardwareOwner": "<owner wallet>"
    }
  }
}
```

**With valid receipt** → returns `HTTP 200`:
```json
{
  "data": {
    "sensorType": "AQI",
    "aqi": 42,
    "pm25": 12.3,
    "pm10": 28.1,
    "temperature": 22.5,
    "humidity": 65,
    "timestamp": 1712000000,
    "location": { "lat": 43.238, "lng": 76.945 }
  },
  "proof": {
    "signature": "<base58 Ed25519 signature over canonical data hash>",
    "sensorPubkey": "<base58 sensor Ed25519 public key>",
    "message": "<base64 canonical data hash>"
  }
}
```

#### `GET /api/v1/health`

Returns server status + on-chain program connectivity check.

### Middleware Architecture

```
Request
  │
  ▼
┌─────────────────────────┐
│  CORS + Rate Limiting   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐     No receipt header?
│  HTTP 402 Middleware     │────────────────────────► 402 Response
│  (x-query-receipt check)│
└────────────┬────────────┘
             │ Has receipt
             ▼
┌─────────────────────────┐     PDA invalid / consumed?
│  On-Chain Verification  │────────────────────────► 403 Forbidden
│  (fetchEncodedAccount)  │
└────────────┬────────────┘
             │ Valid & unconsumed
             ▼
┌─────────────────────────┐
│  consume_receipt ix     │──► pipe → sign → send via Kit
│  (co-signer signs)      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Sensor Data Service    │──► Generates data + Ed25519 signature
└────────────┬────────────┘
             │
             ▼
        200 Response
```

### Co-Signer Security Model

The API server holds a single `KeyPairSigner` (the **co-signer**) whose `address` is stored on-chain as `GlobalState.consume_authority`.

**What the co-signer CAN do:**
- Call `consume_receipt` to mark a receipt as used and close its PDA

**What the co-signer CANNOT do:**
- Move funds from the pool vault
- Modify pool parameters or token supply
- Register or deregister sensors
- Claim rewards on behalf of any holder

**Client protection if co-signer is compromised:**
- Receipts have an on-chain `expiry_slot` (~30 seconds)
- If a receipt isn't consumed in time, the payer can call `refund_expired_receipt()` to reclaim their USDC
- The worst a compromised co-signer can do is burn receipts without serving data — clients lose nothing because of the timeout refund

### Sensor Simulator

For the MVP, the backend includes a mock sensor simulator:

- Generates realistic AQI data using pseudo-random values within plausible ranges
- Signs every data payload with an Ed25519 keypair (using `@solana/kit` codecs for base58 encoding — no `bs58` dependency)
- The signing keypair simulates a real hardware sensor's identity
- In production, this would be replaced by actual SenseCAP / RAKwireless devices running inside TEEs

---

## Environment Variables

```env
# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=<deployed Anchor program ID>
COSIGNER_KEYPAIR_PATH=./keys/cosigner.json

# Sensor Simulator
SENSOR_KEYPAIR_PATH=./keys/sensor.json

# Server
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

---

## Project Structure

```
backend/
├── src/
│   ├── index.ts                 # Express app entry point
│   ├── config.ts                # Environment + Kit client setup
│   ├── middleware/
│   │   ├── http402.ts           # Payment challenge middleware
│   │   └── receiptVerifier.ts   # On-chain PDA verification + consumption
│   ├── services/
│   │   ├── solana.ts            # Kit client, consume_receipt transaction builder
│   │   ├── sensorSimulator.ts   # Mock data generation + Ed25519 signing
│   │   └── receiptService.ts    # Receipt lookup and validation helpers
│   ├── routes/
│   │   ├── sensors.ts           # /api/v1/sensors/* routes
│   │   └── health.ts            # /api/v1/health
│   └── types/
│       └── index.ts             # Shared TypeScript interfaces
├── keys/                        # Keypair files (gitignored)
│   ├── cosigner.json
│   └── sensor.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@solana/kit` | Core SDK — addresses, signers, codecs, transaction building |
| `@solana/kit-client-rpc` | `createClient` for RPC + transaction sending |
| `@solana-program/system` | System program instructions |
| `@solana-program/token-2022` | Token-2022 instruction builders |
| `express` | HTTP server |
| `tweetnacl` | Ed25519 signing for sensor data simulation |

> **No `@solana/web3.js`** — the entire backend uses Kit-native types. If Anchor TS client is needed for IDL deserialization, it is isolated behind a `@solana/web3-compat` boundary in `src/services/solana.ts`.

---

## Development Roadmap

### Sprint 1 — MVP *(Days 2–4 of hackathon)*

| Task | Day | Details |
|------|-----|---------|
| Express scaffold + TypeScript config | Day 2 | Basic Express app, CORS, health endpoint |
| Kit client setup | Day 2 | `createClient` with co-signer `KeyPairSigner`, RPC connection to devnet |
| HTTP 402 middleware (stub) | Day 2 | Returns 402 with hardcoded instruction schema; no on-chain verification yet |
| Sensor simulator + Ed25519 signing | Day 2 | Ed25519 keypair, sign mock AQI data, return `proof` object in response |
| On-chain receipt verification | Day 3 | `fetchEncodedAccount` + `assertAccountExists` + decode `QueryReceipt` PDA |
| `consume_receipt` integration | Day 3 | Build instruction via Codama client, `pipe` → sign → send via Kit |
| End-to-end flow testing | Day 3 | Full cycle: 402 → pay → receipt → consume → data delivery with devnet |
| Error handling + edge cases | Day 4 | Expired receipts, invalid PDAs, wrong sensor_id, network errors, graceful retries |
| Response format finalization | Day 4 | Finalize JSON schema, add proper HTTP status codes, CORS headers, rate limiting |

### Sprint 2 — Post-Hackathon Hardening *(Q2 2026)*

- [ ] **Real Hardware Integration** — replace mock simulator with SenseCAP SDK / MQTT bridge for real sensor data ingestion
- [ ] **TEE Attestation Relay** — accept attestation reports from hardware TEEs and relay them to the on-chain program for verification
- [ ] **WebSocket Feed** — add `ws://` endpoint for real-time sensor data streaming (still payment-gated), using Kit's `rpcSubscriptions`
- [ ] **API Key System** — optional pre-paid API keys for enterprise clients who want batch access without per-query 402 challenges
- [ ] **Monitoring & Alerting** — Prometheus metrics (receipt latency, consume success rate, RPC errors), Grafana dashboards
- [ ] **Multi-Region Deployment** — deploy API instances close to sensor clusters for lower latency

### Sprint 3 — Protocol Maturation *(Q3–Q4 2026)*

- [ ] **x402 Standard Conformance** — align 402 response format with the emerging x402 spec (Coinbase / a16z) for cross-protocol interoperability
- [ ] **AI Agent SDK** — publish `@solsensor/client` npm package as a Kit plugin (`solSensorProgram()`) with auto-discovery, auto-payment, and data verification baked in
- [ ] **Dynamic Pricing** — AI-driven pricing engine that adjusts `min_price` based on demand, data freshness, and sensor density
- [ ] **Multi-Pool Routing** — API automatically routes queries to the best sensor pool by geography and data type

---

## Scripts

```bash
# Install dependencies
npm install

# Start dev server (hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Generate a new co-signer keypair
npx ts-node scripts/generate-keypair.ts cosigner

# Generate a new sensor simulator keypair
npx ts-node scripts/generate-keypair.ts sensor
```

---

## License

[MIT](../LICENSE)
