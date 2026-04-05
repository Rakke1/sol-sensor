'use client';

import React, { useState } from 'react';
import type { Address } from '@solana/kit';
import { buildInitContributorIx } from '@/lib/program';
import { signAndSendTransaction } from '@/lib/tx';
import { deriveSensorPool, deriveContributorState } from '@/lib/pda';

interface InitContributorProps {
  walletAddress: string | null;
  alreadyInitialised?: boolean;
  onSuccess?: () => void;
}

export default function InitContributor({
  walletAddress,
  alreadyInitialised,
  onSuccess,
}: InitContributorProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!walletAddress || alreadyInitialised || done) {
    return null;
  }

  async function handleInit() {
    if (!walletAddress) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const sensorPool = await deriveSensorPool();
      const contributorState = await deriveContributorState(walletAddress as Address);

      const ix = await buildInitContributorIx({
        holder: walletAddress as Address,
        sensorPool,
        contributorState,
      });

      await signAndSendTransaction([ix], walletAddress);
      setDone(true);
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      if (msg.includes('User rejected')) {
        setError('Transaction rejected by user');
      } else if (msg.includes('0x0') || msg.includes('already in use')) {
        setError('Account already initialised');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleInit}
        disabled={loading}
        className="rounded-lg border border-purple-500/50 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-300 hover:bg-purple-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Initialising…' : 'Init Contributor Account'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
