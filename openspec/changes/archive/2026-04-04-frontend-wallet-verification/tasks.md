## 1. Fix disconnect

- [x] 1.1 In `WalletProvider` (`providers.tsx`), update `disconnect` callback to call `window.solana.disconnect()` wrapped in try/catch before clearing React state (`setWalletAddress(null)`)
- [x] 1.2 Add `setSolBalance(null)` to the disconnect callback (after adding solBalance state in step 2)

## 2. Add SOL balance fetch

- [x] 2.1 Add `solBalance: number | null` to `WalletContextValue` interface and provider state
- [x] 2.2 Create a `fetchSolBalance(address: string)` helper that calls `getBalance` via JSON-RPC fetch to `SOLANA_RPC_URL` from `constants.ts`, returns lamports converted to SOL (divide by 1e9)
- [x] 2.3 Call `fetchSolBalance` after successful `window.solana.connect()`, store result in state. On failure, set balance to null and log error — do not break the connect flow
- [x] 2.4 Expose `solBalance` through `WalletContext.Provider` value

## 3. Display SOL balance in header

- [x] 3.1 In `page.tsx` header section, read `solBalance` from `useWallet()` and display next to the truncated address (e.g. `4xK2…9f3A · 1.25 SOL`). Show `— SOL` when balance is null
- [x] 3.2 Format balance to 2 decimal places using `toFixed(2)`

## 4. Error handling for connect

- [x] 4.1 Replace `alert('No Solana wallet found...')` with an inline UI message (e.g. a toast or banner below the header) that directs users to install Phantom
- [x] 4.2 Handle user-rejected connect silently — catch the error, log to console, leave UI in disconnected state with no visible error

## 5. Network mismatch detection

- [x] 5.1 After successful connect, call `getGenesisHash` via JSON-RPC to `SOLANA_RPC_URL`. Compare against known devnet hash (`EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`). Store mismatch boolean in provider state
- [x] 5.2 If mismatch detected, display a warning banner (e.g. yellow bar) in the header area: "Connected to wrong network — expected devnet"
- [x] 5.3 If genesis hash fetch fails, log to console and skip warning (best-effort)

## 6. Verify end-to-end

- [x] 6.1 Test connect with Phantom on devnet — verify address + SOL balance appear
- [x] 6.2 Test disconnect — verify wallet is properly released and UI reverts
- [x] 6.3 Test with no wallet extension — verify helpful message appears (not alert)
- [x] 6.4 Test cancel/reject in wallet popup — verify no error shown, UI stays disconnected
