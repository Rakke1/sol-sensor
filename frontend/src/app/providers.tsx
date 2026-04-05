'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useFaucetOnWalletConnect } from '@/hooks/useFaucetOnWalletConnect';
import { address as toAddress } from '@solana/kit';
import { SOLANA_NETWORK } from '@/lib/constants';
import { rpc } from '@/lib/rpc';

const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';

interface WalletContextValue {
  walletAddress: string | null;
  solBalance: number | null;
  connected: boolean;
  networkMismatch: boolean;
  walletError: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue>({
  walletAddress: null,
  solBalance: null,
  connected: false,
  networkMismatch: false,
  walletError: null,
  connect: async () => {},
  disconnect: () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

async function fetchSolBalance(addr: string): Promise<number> {
  const result = await rpc
    .getBalance(toAddress(addr))
    .send();

  return Number(result.value) / 1e9;
}

async function checkNetworkMismatch(): Promise<boolean> {
  try {
    const genesisHash = await rpc.getGenesisHash().send();
    if (!genesisHash) {
      return false;
    }
    if (SOLANA_NETWORK === 'devnet') {
      return genesisHash !== DEVNET_GENESIS_HASH;
    }

    return false;
  } catch (err) {
    console.warn('[WalletProvider] Genesis hash check failed:', err);

    return false;
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  useFaucetOnWalletConnect(walletAddress);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [networkMismatch, setNetworkMismatch] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setWalletError(null);

    const { solana } = window;
    if (!solana) {
      setWalletError('No Solana wallet found. Please install Phantom or Solflare.');

      return;
    }

    try {
      const response = await solana.connect();
      const address = response.publicKey.toString();
      setWalletAddress(address);

      fetchSolBalance(address)
        .then(setSolBalance)
        .catch((err) => {
          console.warn('[WalletProvider] Failed to fetch SOL balance:', err);
          setSolBalance(null);
        });

      checkNetworkMismatch()
        .then(setNetworkMismatch);
    } catch (err) {
      console.warn('[WalletProvider] User rejected or connection failed:', err);
    }
  }, []);

  const disconnect = useCallback(() => {
    try {
      window.solana?.disconnect?.();
    } catch (err) {
      console.warn('[WalletProvider] disconnect() failed:', err);
    }
    setWalletAddress(null);
    setSolBalance(null);
    setNetworkMismatch(false);
    setWalletError(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        solBalance,
        connected: walletAddress !== null,
        networkMismatch,
        walletError,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
