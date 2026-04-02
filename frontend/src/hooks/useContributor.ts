'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ContributorState, SensorPool } from '@/types';
import { PRECISION_FACTOR } from '@/lib/constants';

/**
 * Fetches the ContributorState PDA for a given wallet address and computes
 * the pending claimable rewards using the same precision-scaled formula as
 * the on-chain Anchor program.
 *
 * Formula (mirrors Rust):
 *   pending = (balance × (pool.reward_per_token - contributor.reward_per_token_paid)) / PRECISION_FACTOR
 *   claimable = pending + contributor.rewards_owed
 */
export function useContributor(
  walletAddress: string | null,
  pool: SensorPool | null,
) {
  const [contributor, setContributor] = useState<ContributorState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setContributor(null);
      return;
    }

    async function fetchContributor() {
      try {
        setLoading(true);
        // MVP: mock ContributorState.
        // Replace with fetchEncodedAccount(rpc, contributorPda) + decodeContributorState.
        const mockContributor: ContributorState = {
          rewardPerTokenPaid: BigInt(78_900_000_000_000n),
          rewardsOwed: BigInt(3_200_000), // 3.20 USDC already owed (6 decimals)
          tokenBalance: BigInt(1_250) * BigInt(10 ** 6), // 1,250 SLSN with 6 decimals
        };
        setContributor(mockContributor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch contributor data');
      } finally {
        setLoading(false);
      }
    }

    fetchContributor();
  }, [walletAddress]);

  const claimable = useMemo(() => {
    if (!contributor || !pool) return BigInt(0);
    // Multiply before dividing to preserve precision — BigInt arithmetic is
    // arbitrary-precision so there is no risk of overflow.  This matches the
    // Rust on-chain formula exactly:
    //   pending = balance * (reward_per_token - paid) / PRECISION_FACTOR
    const pending =
      (contributor.tokenBalance *
        (pool.rewardPerToken - contributor.rewardPerTokenPaid)) /
      PRECISION_FACTOR;
    return pending + contributor.rewardsOwed;
  }, [contributor, pool]);

  return { contributor, claimable, loading, error };
}
