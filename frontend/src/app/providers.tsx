'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface WalletContextValue {
  walletAddress: string | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue>({
  walletAddress: null,
  connected: false,
  connect: async () => {},
  disconnect: () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

/**
 * WalletProvider — lightweight wallet connectivity layer using the
 * Wallet Standard browser API (window.solana / Phantom, Solflare, Backpack, …).
 *
 * In the full implementation, this would use @solana/react or a similar
 * Kit-native provider that leverages autoDiscover() for zero-config Wallet
 * Standard support.  For the MVP, we wrap the legacy window.solana interface
 * so the UI is fully functional today while the Kit migration is in progress.
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const connect = useCallback(async () => {
    try {
      // Prefer Wallet Standard (window.solana) — works with Phantom, Solflare, etc.
      const { solana } = window;
      if (!solana) {
        alert('No Solana wallet found. Please install Phantom or Solflare.');
        return;
      }
      const response = await solana.connect();
      setWalletAddress(response.publicKey.toString());
    } catch (err) {
      console.error('Wallet connection failed:', err);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWalletAddress(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{ walletAddress, connected: walletAddress !== null, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}
