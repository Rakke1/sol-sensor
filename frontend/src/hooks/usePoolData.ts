'use client';

import { useState, useEffect } from 'react';
import type { SensorPool } from '@/types';

/**
 * Fetches and decodes the SensorPool PDA from Solana.
 *
 * In the full implementation, this uses @solana/kit's `fetchEncodedAccount`
 * plus a Codama-generated `decodeSensorPool` codec to read live on-chain data.
 * For the MVP, returns mock data to unblock UI development.
 */
export function usePoolData() {
  const [pool, setPool] = useState<SensorPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPool() {
      try {
        setLoading(true);
        // MVP: mock data mirroring the on-chain SensorPool account structure.
        // Replace with `fetchEncodedAccount(rpc, poolPda)` + `decodeSensorPool`.
        const mockPool: SensorPool = {
          totalSupply: BigInt(8_000_000) * BigInt(10 ** 6), // 8M SLSN with 6 decimals
          maxSupply: BigInt(10_000_000) * BigInt(10 ** 6),  // 10M SLSN with 6 decimals
          rewardPerToken: BigInt(95_250_000_000_000n),
          activeSensors: 24,
          totalQueries: BigInt(15_230),
          totalDistributed: BigInt(761_500_000), // 761.50 USDC (6 decimals)
        };
        setPool(mockPool);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch pool data');
      } finally {
        setLoading(false);
      }
    }

    fetchPool();
  }, []);

  return { pool, loading, error };
}
