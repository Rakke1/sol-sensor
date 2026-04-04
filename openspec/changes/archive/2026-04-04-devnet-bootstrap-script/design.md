## Context

The SolSensor program is deployed to devnet at `ETu1YLCnZyeeWBYYLSFXLNncJa4AgaHaZQ8JSUxTEosJ` but has zero on-chain state. The backend and frontend both expect initialized accounts (GlobalState, SensorPool, a USDC mint, pool token mint, hardware entries) to function. Currently, setting up a development or demo environment requires manual Solana CLI commands with exact PDA seeds, account ordering, and CPI knowledge — fragile and undocumented.

The existing codebase has a keypair generator at `backend/scripts/generate-keypair.ts` (tweetnacl-based, writes Solana CLI-format JSON), but no transaction-building scripts.

## Goals / Non-Goals

**Goals:**
- Single-command provisioning: `npx tsx scripts/bootstrap-devnet.ts` sets up the entire devnet environment from scratch
- Idempotent where possible — detect existing state and skip already-completed steps
- Output a summary of all addresses and keypair paths ready to paste into `.env` files
- Reuse the Solana CLI keypair format (`[u8; 64]` JSON array) for compatibility with `solana` CLI and Anchor

**Non-Goals:**
- Mainnet deployment support (devnet only, script will refuse non-devnet clusters)
- Automated `.env` file writing (outputs to stdout; user copies values)
- IDL-based client generation (Codama / Anchor IDL client) — we hand-build the 3 needed instructions to avoid a build dependency
- Managing the program upgrade authority or program deployment itself

## Decisions

### 1. Standalone `scripts/` directory with own `package.json`

**Decision:** Create a top-level `scripts/` directory with its own `package.json` and `tsconfig.json`, separate from both `backend/` and `frontend/`.

**Rationale:** The bootstrap script needs `@solana/kit` and SPL helpers but doesn't belong to the backend (Express) or frontend (Next.js). A standalone package avoids polluting either workspace and keeps the dependency surface minimal.

**Alternative considered:** Put it in `backend/scripts/` alongside `generate-keypair.ts`. Rejected because the bootstrap script is a project-level tool, not a backend concern, and would add heavy Solana client deps to the backend.

### 2. Use `@solana/kit` (web3.js 2.x) for transaction building

**Decision:** Use `@solana/kit` with `@solana-program/system`, `@solana-program/token-2022`, and `@solana-program/associated-token` for all on-chain interactions.

**Rationale:** The frontend already uses `@solana/kit`. Staying on the same stack means PDA derivation logic, instruction building patterns, and serialization are consistent. The bootstrap script doubles as a reference implementation for the frontend's chain integration task.

**Alternative considered:** Anchor TS client via IDL. Rejected because the IDL isn't checked into the repo and requiring a local `anchor build` before bootstrap adds friction.

### 3. Hand-coded Anchor instruction builders (discriminator + borsh args)

**Decision:** Build `initialize_pool`, `register_sensor` instructions manually using Anchor's discriminator convention (first 8 bytes of SHA-256 of `"global:<instruction_name>"`) and manual borsh serialization.

**Rationale:** Only 2-3 instructions needed. The discriminators and arg layouts are stable. This avoids an IDL dependency entirely.

### 4. Create a fresh SPL token mint as mock USDC

**Decision:** The script creates a new SPL token mint (6 decimals, Token program — not Token-2022) to act as mock USDC on devnet, controlled by the payer wallet.

**Rationale:** There's no official Circle devnet USDC mint that's reliably fauceted. A self-minted token gives full control — the script can mint arbitrary test amounts to any wallet. 6 decimals matches real USDC.

**Alternative considered:** Use Circle's devnet USDC. Rejected because acquiring test USDC requires external faucets with rate limits.

### 5. Mint keypair generated fresh per bootstrap run

**Decision:** Generate a new Keypair for the pool Token-2022 mint on each run (the `mint` account in `initialize_pool` is not a PDA — it's a new account created by the client).

**Rationale:** Anchor's `init` for the mint expects a fresh keypair signer. The script stores the mint address in the output summary so it can be referenced later.

### 6. Idempotency via account existence checks

**Decision:** Before each step, fetch the target account. If it already exists with expected data, skip that step and log "already initialized."

**Rationale:** Devnet state persists across runs. Re-running after a partial failure (e.g., airdrop succeeded but `initialize_pool` timed out) should pick up where it left off without failing on `AccountAlreadyExists`.

## Risks / Trade-offs

- **[Devnet rate limits]** → Airdrop may fail. Mitigation: catch airdrop errors gracefully, print instructions to use the web faucet, continue with remaining steps if wallet already has SOL.
- **[Account ordering sensitivity]** → Anchor instructions require exact account ordering. Mitigation: derive all PDAs from known seeds, use the `initialize_pool` and `register_sensor` account structs from the Rust code as the source of truth, add comments with Anchor account names.
- **[No IDL validation]** → Hand-coded discriminators could drift if instruction names change. Mitigation: discriminators are derived from stable Anchor naming conventions; the program is deployed and won't change instruction names during the hackathon.
- **[Keypair management]** → Script stores keypairs on disk in `scripts/keys/`. Mitigation: `.gitignore` the keys directory, print warnings about not committing secrets.
