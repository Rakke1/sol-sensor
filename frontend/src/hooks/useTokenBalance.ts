'use client';

import { useState, useEffect } from 'react';

/**
 * Fetches the Token-2022 balance for the connected wallet.
 *
 * In the full implementation, fetches the associated token account for the
 * SolSensor Token-2022 mint via Kit's `fetchEncodedAccount` and decodes the
 * `amount` field using the Token-2022 account codec.
 *
 * @param walletAddress - base58 wallet address, or null if not connected
 * @returns balance in raw token units (with 6 decimals), loading state, and error
 */
export function useTokenBalance(walletAddress: string | null) {
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setBalance(BigInt(0));
      return;
    }

    async function fetchBalance() {
      try {
        setLoading(true);
        // MVP: mock token balance (1,250 SLSN with 6 decimals).
        // Replace with fetchEncodedAccount(rpc, tokenAccount) + decodeToken2022Account.
        setBalance(BigInt(1_250) * BigInt(10 ** 6));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch token balance');
      } finally {
        setLoading(false);
      }
    }

    fetchBalance();
  }, [walletAddress]);

  return { balance, loading, error };
}
