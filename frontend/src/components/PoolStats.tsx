'use client';

import React from 'react';
import type { SensorPool } from '@/types';

interface PoolStatsProps {
  pool: SensorPool | null;
  loading: boolean;
}

function formatUsdc(microUsdc: bigint): string {
  return (Number(microUsdc) / 1_000_000).toFixed(2);
}

function formatTokens(rawTokens: bigint): string {
  return (Number(rawTokens) / 1_000_000).toLocaleString();
}

export default function PoolStats({ pool, loading }: PoolStatsProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-white/10 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!pool) return null;

  const supplyPct =
    pool.maxSupply > 0n
      ? Number((pool.totalSupply * 100n) / pool.maxSupply)
      : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Pool Stats
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Stat
          label="Active Sensors"
          value={pool.activeSensors.toString()}
        />
        <Stat
          label="Total Queries"
          value={pool.totalQueries.toLocaleString()}
        />
        <Stat
          label="Total Distributed"
          value={`$${formatUsdc(pool.totalDistributed)} USDC`}
        />
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>
            {formatTokens(pool.totalSupply)} / {formatTokens(pool.maxSupply)} SLSN
          </span>
          <span>{supplyPct}% of max supply</span>
        </div>
        <div className="h-2 rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-solana-green transition-all"
            style={{ width: `${supplyPct}%`, backgroundColor: '#14F195' }}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}
