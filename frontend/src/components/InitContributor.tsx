'use client';

import React, { useState } from 'react';
import type { Address } from '@solana/kit';
import { buildInitContributorIx } from '@/lib/program';
import { signAndSendTransaction } from '@/lib/tx';
import { deriveSensorPool, deriveContributorState } from '@/lib/pda';

interface InitContributorProps {
  walletAddress: string | null;
  onSuccess?: () => void;
}

export default function InitContributor({
  walletAddress,
  onSuccess,
}: InitContributorProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!walletAddress) {
    return (
      <button
        disabled
        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-500 cursor-not-allowed"
      >
        Init Contributor Account
      </button>
    );
  }

  if (done) {
    return (
      <span className="text-sm text-green-400">✓ Contributor account initialised</span>
    );
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
