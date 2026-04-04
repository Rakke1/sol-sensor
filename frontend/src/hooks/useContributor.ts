'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchEncodedAccount, type Address } from '@solana/kit';
import { rpc } from '@/lib/rpc';
import { deriveContributorState, deriveAta } from '@/lib/pda';
import { decodeContributorState } from '@/lib/decoders';
import { PRECISION_FACTOR, POOL_MINT_ADDRESS } from '@/lib/constants';
import type { ContributorState, SensorPool } from '@/types';

export function useContributor(
  walletAddress: string | null,
  pool: SensorPool | null,
) {
  const [contributor, setContributor] = useState<ContributorState | null>(null);
  const [claimable, setClaimable] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContributor = useCallback(async () => {
    if (!walletAddress || !pool) {
      setContributor(null);
      setClaimable(0n);

      return;
    }

    setLoading(true);
    try {
      const contribPda = await deriveContributorState(walletAddress as Address);
      const account = await fetchEncodedAccount(rpc, contribPda);

      if (!account.exists) {
        setContributor(null);
        setClaimable(0n);
        setError(null);
        setLoading(false);

        return;
      }

      const decoded = decodeContributorState(account.data as Uint8Array);

      let tokenBalance = 0n;
      if (POOL_MINT_ADDRESS) {
        try {
          const ata = await deriveAta(
            POOL_MINT_ADDRESS as Address,
            walletAddress as Address,
          );
          const ataAccount = await fetchEncodedAccount(rpc, ata);
          if (ataAccount.exists) {
            const ataData = ataAccount.data as Uint8Array;
            if (ataData.length >= 72) {
              const view = new DataView(
                ataData.buffer,
                ataData.byteOffset,
                ataData.byteLength,
              );
              tokenBalance = view.getBigUint64(64, true);
            }
          }
        } catch {
          // ATA may not exist
        }
      }

      const contribState: ContributorState = {
        rewardPerTokenPaid: decoded.rewardPerTokenPaid,
        rewardsOwed: decoded.rewardsOwed,
        tokenBalance,
      };
      setContributor(contribState);

      const delta = pool.rewardPerToken - decoded.rewardPerTokenPaid;
      const pending =
        delta > 0n ? (tokenBalance * delta) / PRECISION_FACTOR : 0n;
      setClaimable(pending + decoded.rewardsOwed);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch contributor',
      );
      setContributor(null);
      setClaimable(0n);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, pool]);

  useEffect(() => {
    fetchContributor();
  }, [fetchContributor]);

  return { contributor, claimable, loading, error, refetch: fetchContributor };
}
