## Context

The frontend is a Next.js app using a custom wallet provider that talks to `window.solana` (Phantom-style injection API). `@solana/kit` is in `package.json` but not imported anywhere. All on-chain data is mocked in hooks, and all instructions are stubs with wrong discriminators. The backend now returns a real 402 challenge with all PDA addresses needed for `pay_for_query`, and the devnet pool/sensor/USDC are bootstrapped.

Key constraint: the wallet provider uses `window.solana` (not `@solana/wallet-adapter-react`), so transaction signing must go through `window.solana.signTransaction()`. `@solana/kit`'s `signTransactionMessageWithSigners` won't work because we don't have a `KeyPairSigner` — we have a browser wallet.

## Goals / Non-Goals

**Goals:**
- Replace all mock data with real on-chain fetches using `@solana/kit`
- Build correct Anchor instructions with SHA-256 discriminators and Borsh-encoded args
- Sign transactions via `window.solana.signTransaction()` and submit via RPC
- Full `pay_for_query` → backend data retrieval cycle in ClientSimulator
- Real `claim_rewards` and `init_contributor` in contributor components
- Shared RPC client for all on-chain calls

**Non-Goals:**
- Migrating to `@solana/wallet-adapter-react` (different task)
- Adding new UI views or components
- Supporting multiple wallet providers beyond `window.solana`
- Token swap or secondary market features

## Decisions

### 1. Wallet signing via `window.solana.signTransaction`

**Decision:** Build unsigned `VersionedTransaction` using `@solana/kit`, serialize to `VersionedTransaction` (legacy web3.js format expected by Phantom), call `window.solana.signTransaction(tx)`, then encode the signed bytes and send via `rpc.sendTransaction`.

**Rationale:** Phantom's `window.solana` expects a `Transaction` or `VersionedTransaction` object. `@solana/kit` v6 uses a different transaction format internally. We need a bridge: build with Kit, convert to wire format, wrap in a `VersionedTransaction`-like object that Phantom can sign, then extract signed bytes.

**Alternative considered:** Use `@solana/wallet-adapter-react`. Rejected — large migration, already have working `window.solana` provider, would affect the entire app.

### 2. Hand-built Anchor discriminators (same pattern as backend)

**Decision:** Compute `SHA-256("global:<instruction_name>")[0..8]` at module init using Web Crypto API (`crypto.subtle.digest`). Same pattern used in the backend and bootstrap scripts.

**Rationale:** No IDL dependency, and we only need 3 instructions (`pay_for_query`, `claim_rewards`, `init_contributor`). The discriminators are constant — compute once.

### 3. On-chain account decoding via DataView

**Decision:** Manually decode `SensorPool` (117 bytes) and `ContributorState` (65 bytes) from raw `Uint8Array` using `DataView`, with Anchor discriminator validation. Same approach as `decodeQueryReceipt` in the backend.

**Rationale:** No Codama/IDL dependency. The structs are stable and have documented layouts. Manual decode is a few lines per struct.

**Account layouts:**

`SensorPool` (117 bytes):
```
[0..8]     discriminator
[8..40]    mint (Pubkey)
[40..72]   vault (Pubkey)
[72..88]   reward_per_token (u128, LE)
[88..96]   total_distributed (u64, LE)
[96..100]  active_sensors (u32, LE)
[100..108] total_supply (u64, LE)
[108..116] max_supply (u64, LE)
[116]      bump (u8)
```

`ContributorState` (65 bytes):
```
[0..8]    discriminator
[8..40]   holder (Pubkey)
[40..56]  reward_per_token_paid (u128, LE)
[56..64]  rewards_owed (u64, LE)
[64]      bump (u8)
```

### 4. Shared RPC client in `lib/rpc.ts`

**Decision:** Single `createSolanaRpc(SOLANA_RPC_URL)` instance exported from `lib/rpc.ts`. Hooks and transaction senders import from here. Replace raw `fetch` JSON-RPC calls in `providers.tsx` with this client.

**Rationale:** Avoids duplicating RPC creation. `@solana/kit` handles batching, retries, and type safety.

### 5. ClientSimulator uses 402 challenge accounts directly

**Decision:** The backend 402 response now includes all accounts needed for `pay_for_query` (`globalState`, `sensorPool`, `poolVault`, `hardwareEntry`, `hardwareOwner`, `hardwareOwnerUsdc`, `usdcMint`). The ClientSimulator reads these directly from the challenge — no client-side PDA derivation needed for the payment flow.

**Rationale:** DRY — the backend already derives the PDAs. The client just needs to add its own accounts (payer, payerUsdc, queryReceipt) plus the nonce.

### 6. Transaction building with `@solana/kit` + Phantom bridge

**Decision:** Create a `lib/tx.ts` utility that:
1. Uses `@solana/kit` to build and encode the transaction message
2. Deserializes into web3.js-compatible `VersionedTransaction` for Phantom signing
3. After signing, re-serializes and sends via Kit's RPC

**Rationale:** `@solana/kit` v6 doesn't have a direct Phantom adapter. The bridge is the standard approach for using Kit with browser wallets that expect legacy formats.

**Alternative considered:** Use raw `@solana/web3.js` for tx building. Rejected — would add a dependency and diverge from the backend/scripts which all use Kit.

## Risks / Trade-offs

- **[Phantom serialization format]** — Phantom expects `Transaction` or `VersionedTransaction` from `@solana/web3.js`. With `@solana/kit` v6, we need to bridge formats. If Phantom changes their expected format, the bridge breaks. Mitigation: the wire format (v0 message) is standardized; we create a minimal wrapper object.
- **[Token-2022 ATA derivation]** — Pool tokens and USDC use Token-2022, so ATAs use `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` as the token program in the PDA seeds. Getting this wrong means wrong ATA addresses. Mitigation: reuse the same ATA derivation as backend.
- **[Devnet rate limits]** — Multiple RPC calls per page load (pool data + contributor + balance). Mitigation: add reasonable polling intervals (30s), don't fetch on every render.
