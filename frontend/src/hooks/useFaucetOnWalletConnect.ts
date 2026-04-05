import { useEffect } from 'react';
import { API_URL } from '@/lib/constants';

export function useFaucetOnWalletConnect(walletAddress: string | null) {
  useEffect(() => {
    if (!walletAddress) return;
    // Call faucet endpoint when a new wallet connects
    fetch(`${API_URL}/api/v1/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then(() => {
      })
      .catch(() => {
      });
  }, [walletAddress]);
}
