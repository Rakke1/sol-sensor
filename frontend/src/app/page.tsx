'use client';

import React, { useState, useCallback } from 'react';
import ContributorDashboard from '@/components/ContributorDashboard';
import EconomicsPlayground from '@/components/EconomicsPlayground';
import ClientSimulator from '@/components/ClientSimulator';
import WalletModal from '@/components/WalletModal';
import { useWallet } from './providers';

type View = 'dashboard' | 'economics' | 'simulator';

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Contributor Dashboard', icon: '🌐' },
  { id: 'economics', label: 'Unit Economics', icon: '📊' },
  { id: 'simulator', label: 'Client Simulator', icon: '🤖' },
];

export default function Home() {
  const [view, setView] = useState<View>('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const { walletAddress, solBalance, connected, networkMismatch, walletError, connect, disconnect } = useWallet();

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top nav */}
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#14F195] text-xl">◎</span>
            <span className="font-bold text-white">SolSensor</span>
            <span className="hidden sm:inline text-xs text-slate-500 border border-white/10 rounded px-1.5 py-0.5">
              devnet
            </span>
          </div>

          {connected && walletAddress ? (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-xs text-slate-400 font-mono">
                {walletAddress.slice(0, 4)}…{walletAddress.slice(-4)}
                {' · '}
                <span className="text-[#14F195]">
                  {solBalance !== null ? `${solBalance.toFixed(2)} SOL` : '— SOL'}
                </span>
              </span>
              <button
                onClick={disconnect}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={openModal}
              className="rounded-lg bg-[#14F195] px-4 py-1.5 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {networkMismatch && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-center text-xs text-amber-300">
          Connected to wrong network — expected devnet
        </div>
      )}

      <div className="flex flex-1 mx-auto w-full max-w-6xl">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-white/10 py-6 px-3">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors text-left ${
                  view === item.id
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile tab bar */}
        <div className="md:hidden flex w-full border-b border-white/10 bg-black/20">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex-1 py-3 text-xs flex flex-col items-center gap-0.5 transition-colors ${
                view === item.id ? 'text-white' : 'text-slate-500'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="hidden xs:inline">{item.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-8 min-w-0">
          {view === 'dashboard' && (
            <ContributorDashboard
              walletAddress={walletAddress}
              onConnect={openModal}
            />
          )}
          {view === 'economics' && <EconomicsPlayground />}
          {view === 'simulator' && <ClientSimulator />}
        </main>
      </div>

      <WalletModal
        open={modalOpen}
        onClose={closeModal}
        onConnect={connect}
        error={walletError}
      />
    </div>
  );
}
