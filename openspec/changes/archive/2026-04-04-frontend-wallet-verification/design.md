## Context

The frontend uses a custom `WalletProvider` (`providers.tsx`) wrapping `window.solana` (Phantom/Solflare injection). After connect, the wallet address is stored in React state and displayed truncated in the header. All chain data (token balance, pool stats, contributor state) is mocked. `disconnect` only clears React state without calling the wallet provider's disconnect method. `@solana/kit` is in `package.json` but not imported anywhere in `src/`.

## Goals / Non-Goals

**Goals:**
- Prove wallet ↔ chain link works by showing real SOL balance from RPC after connect
- Fix disconnect to properly release the wallet connection
- Handle common error cases gracefully (no wallet, user rejection, wrong network)

**Non-Goals:**
- Replace mock pool/contributor/token hooks with real chain data (that's `frontend-chain-integration`)
- Switch to `@solana/react` or Wallet Adapter (future migration)
- Support multiple wallets simultaneously
- Display token balances (SLSN, USDC) — only SOL for now

## Decisions

### 1. Use raw `window.solana` RPC for SOL balance — not `@solana/kit`

The current `WalletProvider` is built on `window.solana`. Pulling in `@solana/kit`'s `createSolanaRpc` + `getBalance` just for one call adds complexity to a provider that will be rewritten anyway. Instead, use a direct JSON-RPC fetch to `SOLANA_RPC_URL` (already in `constants.ts`).

Alternative considered: Import `@solana/kit` and use `createSolanaRpc(SOLANA_RPC_URL).getBalance(address(walletAddress))`. Rejected because the rest of the provider doesn't use Kit yet — mixing patterns creates confusion. Kit integration happens in task 7.

### 2. SOL balance in WalletProvider context — not a separate hook

Add `solBalance: number | null` to `WalletContextValue` and fetch it inside `WalletProvider` on connect. This keeps all wallet state colocated. Components access it via `useWallet()` — no new hook file needed.

Alternative considered: Separate `useSolBalance(address)` hook. Unnecessary indirection for a single `getBalance` call that's tightly coupled to connect lifecycle.

### 3. Network detection via RPC genesis hash comparison

Call `getGenesisHash()` on the RPC endpoint after connect. Compare against known hashes (devnet: `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`). Display mismatch warning if wallet is on a different network than the app expects.

Alternative considered: `window.solana.network` property. Not reliably exposed by all wallet providers.

## Risks / Trade-offs

- **[Stale balance]** → SOL balance is fetched once on connect; no polling. Acceptable for MVP — user can reconnect to refresh. Add polling or websocket subscription in task 7 if needed.
- **[RPC rate limit]** → Single `getBalance` call per connect is negligible. No risk.
- **[window.solana.disconnect() not universal]** → Some wallet providers may not implement `disconnect()`. Wrap in try/catch, always clear React state regardless.
