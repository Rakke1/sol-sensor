'use client';

import React, { useState } from 'react';
import PoolStats from './PoolStats';
import InitContributor from './InitContributor';
import { usePoolData } from '@/hooks/usePoolData';
import { useContributor } from '@/hooks/useContributor';

interface ContributorDashboardProps {
  walletAddress: string | null;
  onConnect: () => void;
}

function formatUsdc(microUsdc: bigint): string {
  return (Number(microUsdc) / 1_000_000).toFixed(2);
}

function formatTokens(rawTokens: bigint): string {
  return (Number(rawTokens) / 1_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

export default function ContributorDashboard({
  walletAddress,
  onConnect,
}: ContributorDashboardProps) {
  const { pool, loading: poolLoading } = usePoolData();
  const { contributor, claimable, loading: contribLoading } = useContributor(
    walletAddress,
    pool,
  );
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  async function handleClaim() {
    if (!walletAddress) return;
    try {
      setClaiming(true);
      setClaimError(null);
      // MVP: stub — replace with Kit pipe + getClaimRewardsInstruction +
      // signAndSendTransactionMessageWithSigners.
      await new Promise((r) => setTimeout(r, 1800));
      alert('Rewards claimed! (demo stub)');
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Claim failed');
    } finally {
      setClaiming(false);
    }
  }

  const supplyPct =
    pool && pool.maxSupply > 0n
      ? Number((pool.totalSupply * 100n) / pool.maxSupply)
      : 0;

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
        {!walletAddress && (
          <button
            onClick={onConnect}
            className="rounded-lg bg-[#14F195] px-4 py-2 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
          >
            Connect Wallet
          </button>
        )}
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
        </div>
      )}

      {/* Reward History (mock) */}
      {walletAddress && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Reward History
          </h3>
          <ul className="space-y-2 text-sm">
            {[
              { amount: '3.20', when: '2 hours ago' },
              { amount: '5.10', when: '1 day ago' },
              { amount: '4.15', when: '3 days ago' },
            ].map((item, i) => (
              <li key={i} className="flex justify-between text-slate-300">
                <span>Claimed {item.amount} USDC</span>
                <span className="text-slate-500">{item.when}</span>
              </li>
            ))}
          </ul>
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
