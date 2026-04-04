import type { Transaction, VersionedTransaction } from '@solana/web3.js';

interface SolanaWalletProvider {
  connect: () => Promise<{ publicKey: { toString: () => string; toBytes: () => Uint8Array } }>;
  disconnect?: () => void;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  signAllTransactions?: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>;
  isPhantom?: boolean;
  isSolflare?: boolean;
}

declare global {
  interface Window {
    solana?: SolanaWalletProvider;
  }
}

export {};
