'use client';

import React, { useState } from 'react';
import type { Address } from '@solana/kit';
import PoolStats from './PoolStats';
import InitContributor from './InitContributor';
import { usePoolData } from '@/hooks/usePoolData';
import { useContributor } from '@/hooks/useContributor';
import { buildClaimRewardsIx } from '@/lib/program';
import { signAndSendTransaction } from '@/lib/tx';
import { deriveSensorPool, deriveContributorState, deriveAta } from '@/lib/pda';
import { USDC_MINT_ADDRESS, POOL_MINT_ADDRESS } from '@/lib/constants';
import { formatUsdc, formatTokens, formatSupplyPct } from '@/lib/format';

interface ContributorDashboardProps {
  walletAddress: string | null;
  onConnect: () => void;
}

export default function ContributorDashboard({
  walletAddress,
  onConnect,
}: ContributorDashboardProps) {
  const { pool, poolMint, poolVault, loading: poolLoading } = usePoolData();
  const { contributor, claimable, loading: contribLoading, refetch: refetchContrib } = useContributor(
    walletAddress,
    pool,
  );
  const [claiming, setClaiming] = useState(false);
  const [claimTx, setClaimTx] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  async function handleClaim() {
    if (!walletAddress || !poolVault) {
      return;
    }

    try {
      setClaiming(true);
      setClaimError(null);
      setClaimTx(null);

      const sensorPool = await deriveSensorPool();
      const contributorState = await deriveContributorState(walletAddress as Address);
      const holderTokenAccount = await deriveAta(
        (poolMint ?? POOL_MINT_ADDRESS) as Address,
        walletAddress as Address,
      );
      const holderUsdc = await deriveAta(
        USDC_MINT_ADDRESS as Address,
        walletAddress as Address,
      );

      const ix = await buildClaimRewardsIx({
        holder: walletAddress as Address,
        sensorPool,
        contributorState,
        holderTokenAccount,
        usdcMint: USDC_MINT_ADDRESS as Address,
        holderUsdc,
        poolVault: poolVault as Address,
      });

      const sig = await signAndSendTransaction([ix], walletAddress);
      setClaimTx(sig);
      refetchContrib();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Claim failed';
      if (msg.includes('User rejected')) {
        setClaimError('Transaction rejected by user');
      } else {
        setClaimError(msg);
      }
    } finally {
      setClaiming(false);
    }
  }

  const supplyPct =
    pool ? formatSupplyPct(pool.totalSupply, pool.maxSupply) : '0.0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Network Contributor Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">
            Manage your SLSN position and claim rewards
          </p>
        </div>
      </div>

      {/* Your Position */}
      {walletAddress && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Your Position
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard
              label="Token Balance"
              value={
                contribLoading
                  ? '…'
                  : contributor
                  ? `${formatTokens(contributor.tokenBalance)} SLSN`
                  : '—'
              }
              highlight
            />
            <StatCard
              label="Claimable Rewards"
              value={
                contribLoading ? '…' : `${formatUsdc(claimable)} USDC`
              }
              highlight
            />
            <StatCard
              label="Pool Utilisation"
              value={poolLoading ? '…' : `${supplyPct}%`}
              sub="of max supply"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleClaim}
              disabled={claiming || claimable === 0n}
              className="rounded-lg bg-[#14F195] px-5 py-2 text-sm font-semibold text-black hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {claiming ? 'Claiming…' : 'Claim Rewards'}
            </button>
            <InitContributor walletAddress={walletAddress} />
          </div>
          {claimError && (
            <p className="text-xs text-red-400 mt-2">{claimError}</p>
          )}
          {claimTx && (
            <p className="text-xs text-green-400 mt-2">
              Rewards claimed!{' '}
              <a
                href={`https://solscan.io/tx/${claimTx}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View tx ↗
              </a>
            </p>
          )}
        </div>
      )}

      {/* Pool Stats */}
      <PoolStats pool={pool} loading={poolLoading} />

      {!walletAddress && (
        <div className="rounded-xl border border-dashed border-white/20 p-8 text-center">
          <p className="text-slate-400">
            Connect your wallet to view your contributor position and claim rewards.
          </p>
          <button
            onClick={onConnect}
            className="mt-4 rounded-lg bg-[#14F195] px-5 py-2 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
          >
            Connect Wallet
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-4 text-center ${
        highlight ? 'bg-white/10' : 'bg-white/5'
      }`}
    >
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
