'use client';

import React, { useEffect } from 'react';

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  onConnect: () => Promise<void>;
  error: string | null;
}

const WALLETS = [
  {
    name: 'Phantom',
    icon: 'https://phantom.app/img/phantom-icon-purple.svg',
    detectKey: 'isPhantom',
    installUrl: 'https://phantom.app/',
  },
  {
    name: 'Solflare',
    icon: 'https://solflare.com/favicon.ico',
    detectKey: 'isSolflare',
    installUrl: 'https://solflare.com/',
  },
];

export default function WalletModal({ open, onClose, onConnect, error }: WalletModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleEsc);

    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const solana = typeof window !== 'undefined' ? window.solana : undefined;
  const hasWallet = !!solana;

  async function handleWalletClick() {
    await onConnect();
    if (hasWallet) {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-white/10 bg-[#0c0f1a] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="space-y-2">
          {WALLETS.map((wallet) => {
            const detected = solana && (solana as unknown as Record<string, unknown>)[wallet.detectKey];

            return (
              <button
                key={wallet.name}
                onClick={detected ? handleWalletClick : undefined}
                className={`w-full flex items-center gap-3 rounded-xl border p-4 transition-colors ${
                  detected
                    ? 'border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer'
                    : 'border-white/5 bg-white/[0.02] cursor-default'
                }`}
              >
                <img
                  src={wallet.icon}
                  alt={wallet.name}
                  className="w-8 h-8 rounded-lg"
                />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">{wallet.name}</p>
                  {detected ? (
                    <p className="text-xs text-[#14F195]">Detected</p>
                  ) : (
                    <p className="text-xs text-slate-500">Not installed</p>
                  )}
                </div>
                {detected ? (
                  <span className="text-xs text-slate-400">Connect &rarr;</span>
                ) : (
                  <a
                    href={wallet.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-[#14F195] hover:underline"
                  >
                    Install
                  </a>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        {!hasWallet && (
          <p className="mt-4 text-xs text-slate-500 text-center">
            Don&apos;t have a wallet?{' '}
            <a
              href="https://phantom.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#14F195] hover:underline"
            >
              Get Phantom
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
