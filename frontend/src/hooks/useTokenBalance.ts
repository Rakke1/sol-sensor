'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchEncodedAccount, type Address } from '@solana/kit';
import { rpc } from '@/lib/rpc';
import { deriveAta } from '@/lib/pda';
import { POOL_MINT_ADDRESS } from '@/lib/constants';

export function useTokenBalance(walletAddress: string | null) {
  const [balance, setBalance] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress || !POOL_MINT_ADDRESS) {
      setBalance(0n);

      return;
    }

    setLoading(true);
    try {
      const ata = await deriveAta(
        POOL_MINT_ADDRESS as Address,
        walletAddress as Address,
      );
      const account = await fetchEncodedAccount(rpc, ata);

      if (!account.exists) {
        setBalance(0n);
        setError(null);
        setLoading(false);

        return;
      }

      const data = account.data as Uint8Array;
      if (data.length >= 72) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        setBalance(view.getBigUint64(64, true));
      } else {
        setBalance(0n);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
      setBalance(0n);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, error, refetch: fetchBalance };
}
