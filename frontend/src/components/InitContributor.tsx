'use client';

import React, { useState } from 'react';

interface InitContributorProps {
  walletAddress: string | null;
  onSuccess?: () => void;
}

/**
 * Button that sends the `init_contributor` instruction on-chain.
 *
 * This must be called once by each wallet before it can receive SLSN tokens.
 * The instruction initialises the ContributorState PDA, which the Transfer
 * Hook reads to settle pending rewards on every token transfer.
 */
export default function InitContributor({
  walletAddress,
  onSuccess,
}: InitContributorProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleInit() {
    if (!walletAddress) return;
    try {
      setLoading(true);
      setError(null);
      // MVP: stub — replace with Kit pipe + getInitContributorInstruction +
      // signAndSendTransactionMessageWithSigners.
      await new Promise((r) => setTimeout(r, 1500));
      setDone(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
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
