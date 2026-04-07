'use client';

import React, { useEffect } from 'react';

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  onConnect: () => Promise<void>;
  error: string | null;
}

function PhantomIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="128" height="128" rx="26" fill="#AB9FF2" />
      <path d="M110.584 64.914H99.142C99.142 41.066 79.856 21.78 56.008 21.78C32.578 21.78 13.558 40.426 13.018 63.714C12.468 87.49 33.796 108.22 57.574 108.22H61.852C83.368 108.22 110.584 88.168 110.584 64.914Z" fill="url(#phantom_grad)" />
      <path d="M77.67 60.734C77.67 64.262 75.222 66.136 72.252 66.136C69.282 66.136 66.834 64.262 66.834 60.734C66.834 57.206 69.282 55.332 72.252 55.332C75.222 55.332 77.67 57.206 77.67 60.734Z" fill="white" />
      <path d="M55.98 60.734C55.98 64.262 53.532 66.136 50.562 66.136C47.592 66.136 45.144 64.262 45.144 60.734C45.144 57.206 47.592 55.332 50.562 55.332C53.532 55.332 55.98 57.206 55.98 60.734Z" fill="white" />
      <defs>
        <linearGradient id="phantom_grad" x1="61.801" y1="21.78" x2="61.801" y2="108.22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#534BB1" />
          <stop offset="1" stopColor="#551BF9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function SolflareIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="#1a1a2e" />
      <path d="M12.0633 12.7149L13.3077 11.5164L15.6278 12.2733C17.1464 12.7781 17.9057 13.7033 17.9057 15.007C17.9057 15.9954 17.526 16.6472 16.7668 17.4884L16.5348 17.7407L16.6191 17.1519C16.9565 15.007 16.3239 14.0818 14.2357 13.4088L12.0633 12.7149ZM8.94167 5.37618L15.2693 7.47898L13.8982 8.78272L10.6079 7.68926C9.46901 7.31075 9.08934 6.70093 8.94167 5.41823V5.37618ZM8.562 16.0584L9.99627 14.6915L12.6961 15.5748C14.1092 16.0374 14.5942 16.6472 14.4467 18.1823L8.562 16.0584ZM6.74814 9.96025C6.74814 9.56079 6.95905 9.18227 7.31761 8.8668C7.69727 9.41357 8.35111 9.89719 9.38459 10.2337L11.6204 10.9696L10.3759 12.1683L8.18237 11.4532C7.16997 11.1168 6.74814 10.6121 6.74814 9.96025ZM13.371 21C18.0111 17.9299 20.5 15.8481 20.5 13.2827C20.5 11.5794 19.4876 10.6331 17.2519 9.89719L15.5645 9.3294L20.1837 4.91356L19.2556 3.92524L17.8846 5.12383L11.4095 3C9.40567 3.65187 6.87469 5.56542 6.87469 7.47897C6.87469 7.68925 6.89578 7.89953 6.95906 8.13086C5.2928 9.07708 4.61787 9.96025 4.61787 11.0537C4.61787 12.0841 5.16625 13.1145 6.91687 13.6823L8.30893 14.1449L3.5 18.75L4.42804 19.7383L5.92556 18.3715L13.371 21Z" fill="#FFEF46" />
    </svg>
  );
}

const WALLETS = [
  {
    name: 'Phantom',
    icon: <PhantomIcon />,
    detectKey: 'isPhantom',
    installUrl: 'https://phantom.app/',
  },
  {
    name: 'Solflare',
    icon: <SolflareIcon />,
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
                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                  {wallet.icon}
                </div>
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
