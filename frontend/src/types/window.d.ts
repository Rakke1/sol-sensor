/**
 * Type declarations for injected Solana wallet providers.
 *
 * Covers the legacy `window.solana` interface exposed by Phantom, Solflare,
 * and other Wallet Standard-compatible extensions.  In the full Kit
 * implementation, `autoDiscover()` handles discovery automatically without
 * requiring manual window augmentation.
 */

interface SolanaWalletProvider {
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect?: () => void;
  isPhantom?: boolean;
  isSolflare?: boolean;
}

declare global {
  interface Window {
    solana?: SolanaWalletProvider;
  }
}

export {};
