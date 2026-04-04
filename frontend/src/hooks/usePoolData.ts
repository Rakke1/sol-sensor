'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchEncodedAccount, address } from '@solana/kit';
import { rpc } from '@/lib/rpc';
import { deriveSensorPool } from '@/lib/pda';
import { decodeSensorPool } from '@/lib/decoders';
import type { SensorPool } from '@/types';

const POLL_INTERVAL_MS = 30_000;

export function usePoolData() {
  const [pool, setPool] = useState<SensorPool | null>(null);
  const [poolMint, setPoolMint] = useState<string | null>(null);
  const [poolVault, setPoolVault] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPool = useCallback(async () => {
    try {
      const poolPda = await deriveSensorPool();
      const account = await fetchEncodedAccount(rpc, poolPda);

      if (!account.exists) {
        setPool(null);
        setError('SensorPool account not found on-chain');
        setLoading(false);

        return;
      }

      const decoded = decodeSensorPool(account.data as Uint8Array);
      setPool(decoded);
      setPoolMint(decoded.mint);
      setPoolVault(decoded.vault);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pool data');
      setPool(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPool();
    const id = setInterval(fetchPool, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [fetchPool]);

  return { pool, poolMint, poolVault, loading, error, refetch: fetchPool };
}
