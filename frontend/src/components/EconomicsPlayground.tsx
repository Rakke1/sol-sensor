'use client';

import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { HARDWARE_OWNER_SPLIT, QUERY_PRICE_MICRO_USDC } from '@/lib/constants';

interface Params {
  dailyQueries: number;
  priceUsdc: number;
  hardwareCost: number;
  sensorsInPool: number;
}

function computeMetrics(params: Params) {
  const { dailyQueries, priceUsdc, hardwareCost } = params;

  const dailyNetworkRevenue = dailyQueries * priceUsdc;
  const dailyOwnerRevenue = dailyNetworkRevenue * HARDWARE_OWNER_SPLIT;
  const paybackDays =
    dailyOwnerRevenue > 0 ? Math.ceil(hardwareCost / dailyOwnerRevenue) : Infinity;

  const chartData = Array.from({ length: 13 }, (_, i) => {
    const day = i * 15; // 0, 15, 30, … 180
    return {
      day,
      network: +(dailyNetworkRevenue * day).toFixed(2),
      owner: +(dailyOwnerRevenue * day).toFixed(2),
    };
  });

  return { dailyNetworkRevenue, dailyOwnerRevenue, paybackDays, chartData };
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="font-medium text-white">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#14F195]"
      />
    </div>
  );
}

export default function EconomicsPlayground() {
  const [params, setParams] = useState<Params>({
    dailyQueries: 500,
    priceUsdc: QUERY_PRICE_MICRO_USDC / 1_000_000,
    hardwareCost: 300,
    sensorsInPool: 24,
  });

  const { dailyNetworkRevenue, dailyOwnerRevenue, paybackDays, chartData } =
    useMemo(() => computeMetrics(params), [params]);

  function set<K extends keyof Params>(key: K, value: Params[K]) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Unit Economics Simulator</h2>
        <p className="text-slate-400 text-sm mt-1">
          Adjust parameters to explore SolSensor&apos;s economic model
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-5">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Adjust Parameters
          </h3>
          <Slider
            label="Daily Queries"
            min={50}
            max={5000}
            step={50}
            value={params.dailyQueries}
            format={(v) => v.toLocaleString()}
            onChange={(v) => set('dailyQueries', v)}
          />
          <Slider
            label="Price / Query"
            min={0.01}
            max={0.5}
            step={0.01}
            value={params.priceUsdc}
            format={(v) => `$${v.toFixed(2)}`}
            onChange={(v) => set('priceUsdc', v)}
          />
          <Slider
            label="Hardware Cost"
            min={100}
            max={1000}
            step={50}
            value={params.hardwareCost}
            format={(v) => `$${v}`}
            onChange={(v) => set('hardwareCost', v)}
          />
          <Slider
            label="Sensors in Pool"
            min={1}
            max={100}
            step={1}
            value={params.sensorsInPool}
            format={(v) => v.toString()}
            onChange={(v) => set('sensorsInPool', v)}
          />
        </div>

        {/* Results */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Results
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <ResultCard
              label="Network Rev / day"
              value={`$${dailyNetworkRevenue.toFixed(2)}`}
            />
            <ResultCard
              label={`HW Owner Rev / day (${HARDWARE_OWNER_SPLIT * 100}%)`}
              value={`$${dailyOwnerRevenue.toFixed(2)}`}
            />
            <ResultCard
              label="Payback"
              value={
                isFinite(paybackDays) ? `${paybackDays} days` : '∞'
              }
              highlight={isFinite(paybackDays) && paybackDays < 365}
            />
          </div>

          {/* Web2 comparison */}
          <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-xs text-slate-400">
            <span className="font-medium text-slate-300">vs. Web2 SaaS:</span>{' '}
            Equivalent data at $350–$1,000/month vs. pay-per-query at $
            {params.priceUsdc.toFixed(2)}/query — no lock-in, cryptographically
            verifiable.
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Revenue Over Time (180 days)
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="day"
              stroke="#94a3b8"
              tick={{ fontSize: 11 }}
              label={{ value: 'Days', position: 'insideBottom', offset: -2, fill: '#94a3b8', fontSize: 11 }}
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
              }}
              formatter={(v) => [`$${Number(v).toFixed(2)}`, undefined]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="network"
              name="Network Revenue"
              stroke="#14F195"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="owner"
              name={`HW Owner (${HARDWARE_OWNER_SPLIT * 100}%)`}
              stroke="#9945FF"
              strokeWidth={2}
              dot={false}
            />
            {isFinite(paybackDays) && paybackDays <= 180 && (
              <ReferenceLine
                x={paybackDays}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{ value: '↑ Payback', fill: '#f59e0b', fontSize: 11 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-3 text-center ${
        highlight ? 'border border-green-500/30 bg-green-500/10' : 'bg-white/5'
      }`}
    >
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400 mt-1 leading-tight">{label}</p>
    </div>
  );
}
