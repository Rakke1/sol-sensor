'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import type { DemoState, PaymentChallenge, SensorResponse } from '@/types';
import { DEMO_SENSORS } from '@/types';
import type { Address } from '@solana/kit';
import { API_URL, QUERY_PRICE_MICRO_USDC } from '@/lib/constants';
import { verifySensorSignature } from '@/lib/verify';
import { deriveReceiptPda, deriveAta } from '@/lib/pda';
import { buildPayForQueryIx } from '@/lib/program';
import { signAndSendTransaction } from '@/lib/tx';
import { useWallet } from '@/app/providers';

// Dynamically import SensorMap to avoid SSR issues with Leaflet
const SensorMap = dynamic(() => import('./SensorMap'), { ssr: false });

const INITIAL_STATE: DemoState = {
  step: 'idle',
  challenge: null,
  txSignature: null,
  receiptPda: null,
  response: null,
  signatureValid: null,
  error: null,
};

function StepRow({
  number,
  title,
  done,
  active,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  active: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-5 transition-colors ${
        done
          ? 'border-green-500/40 bg-green-500/5'
          : active
          ? 'border-white/20 bg-white/5'
          : 'border-white/5 bg-white/[0.02]'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            done
              ? 'bg-green-500 text-black'
              : active
              ? 'bg-white/20 text-white'
              : 'bg-white/5 text-slate-500'
          }`}
        >
          {done ? '✓' : number}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">{title}</h4>
            {done && (
              <span className="text-xs text-green-400 font-medium">Complete</span>
            )}
          </div>
          {children && (
            <div className="mt-2 text-xs text-slate-400 space-y-1">{children}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClientSimulator() {
  const [demo, setDemo] = useState<DemoState>(INITIAL_STATE);
  const [selectedSensorId, setSelectedSensorId] = useState('almaty-1');
  const { walletAddress, connected } = useWallet();

  const selectedSensor = DEMO_SENSORS.find((s) => s.id === selectedSensorId) || DEMO_SENSORS[0];

  function patch(partial: Partial<DemoState>) {
    setDemo((d) => ({ ...d, ...partial }));
  }

  async function runDemo() {
    if (!connected || !walletAddress) {
      setDemo({
        ...INITIAL_STATE,
        step: 'error',
        error: 'Please connect your wallet first.',
      });

      return;
    }

    setDemo({ ...INITIAL_STATE, step: 'requesting' });

    try {
      // Step 1: Request data → receive HTTP 402
      const res1 = await fetch(`${API_URL}/api/v1/sensors/AQI?sensor=${selectedSensorId}`);
      let challenge: PaymentChallenge | null = null;

      if (res1.status === 402) {
        challenge = (await res1.json()) as PaymentChallenge;
      } else if (res1.ok) {
        const data = (await res1.json()) as SensorResponse;
        patch({
          step: 'done',
          response: data,
          signatureValid: await verifySensorSignature(data),
        });

        return;
      } else {
        throw new Error(`Unexpected status ${res1.status} from API`);
      }

      patch({ step: 'paying', challenge });

      // Step 2: Build and send pay_for_query on-chain
      const nonceB64 = challenge.payment.suggestedNonce;
      const nonceBytes = new Uint8Array(
        atob(nonceB64.replace(/-/g, '+').replace(/_/g, '/'))
          .split('')
          .map((c) => c.charCodeAt(0)),
      );

      const receiptPda = await deriveReceiptPda(nonceBytes);
      const accounts = challenge.payment.accounts;

      const payerUsdc = await deriveAta(
        accounts.usdcMint as Address,
        walletAddress as Address,
      );

      const ix = await buildPayForQueryIx(
        {
          payer: walletAddress as Address,
          globalState: accounts.globalState as Address,
          sensorPool: accounts.sensorPool as Address,
          hardwareEntry: accounts.hardwareEntry as Address,
          hardwareOwnerUsdc: accounts.hardwareOwnerUsdc as Address,
          payerUsdc,
          poolVault: accounts.poolVault as Address,
          usdcMint: accounts.usdcMint as Address,
          queryReceipt: receiptPda,
        },
        nonceBytes,
        BigInt(QUERY_PRICE_MICRO_USDC),
      );

      const txSignature = await signAndSendTransaction([ix], walletAddress);

      patch({
        step: 'fetching',
        txSignature,
        receiptPda,
      });

      // Step 3: Fetch signed sensor data with receipt + nonce headers
      const res2 = await fetch(`${API_URL}/api/v1/sensors/AQI?sensor=${selectedSensorId}`, {
        headers: {
          'x-query-receipt': receiptPda,
          'x-query-nonce': nonceB64,
        },
      });

      if (!res2.ok) {
        const body = await res2.json().catch(() => ({}));
        throw new Error(
          `API error ${res2.status}: ${JSON.stringify(body)}`,
        );
      }

      const sensorResponse = (await res2.json()) as SensorResponse;
      patch({ step: 'verifying', response: sensorResponse });

      // Step 4: Verify Ed25519 signature client-side
      const isValid = await verifySensorSignature(sensorResponse);
      patch({ step: 'done', signatureValid: isValid });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('User rejected')) {
        patch({ step: 'error', error: 'Transaction rejected by user' });
      } else {
        patch({ step: 'error', error: message });
      }
    }
  }

  const { step, challenge, txSignature, receiptPda, response, signatureValid, error } =
    demo;

  const isDone = step === 'done';
  const isError = step === 'error';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Enterprise Client Simulator</h2>
          <p className="text-slate-400 text-sm mt-1">
            End-to-end HTTP 402 payment flow from{' '}
            <span className="text-[#14F195] font-semibold">{selectedSensor.name}</span> — real on-chain transactions
          </p>
        </div>
        <button
          onClick={runDemo}
          disabled={(!connected) || (step !== 'idle' && !isDone && !isError)}
          className="shrink-0 rounded-lg bg-[#14F195] px-5 py-2 text-sm font-semibold text-black hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {step === 'idle' || isDone || isError ? '▶ Run Full Demo' : 'Running…'}
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Select a Sensor Station</h3>
        <SensorMap
          sensors={DEMO_SENSORS}
          selectedId={selectedSensorId}
          onSelect={setSelectedSensorId}
          disabled={step !== 'idle' && !isDone && !isError}
        />
      </div>

      <div className="space-y-3">
        <StepRow
          number={1}
          title="Request Data"
          done={step !== 'idle' && step !== 'requesting'}
          active={step === 'requesting'}
        >
          <p>→ GET /api/v1/sensors/AQI</p>
          {challenge && (
            <p>
              ← HTTP 402: Payment Required (
              {challenge.payment.price.amount / 10 ** challenge.payment.price.decimals}{' '}
              {challenge.payment.price.currency})
            </p>
          )}
        </StepRow>

        <StepRow
          number={2}
          title="Pay On-Chain"
          done={step === 'fetching' || step === 'verifying' || isDone}
          active={step === 'paying'}
        >
          <p>→ pay_for_query(nonce, amount) — signed by wallet</p>
          {txSignature && (
            <>
              <p>← Receipt PDA: {receiptPda}</p>
              <p>
                ← Tx:{' '}
                <a
                  href={`https://solscan.io/tx/${txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#14F195] underline"
                >
                  {txSignature.slice(0, 20)}… ↗
                </a>
              </p>
            </>
          )}
        </StepRow>

        <StepRow
          number={3}
          title="Fetch Signed Data"
          done={step === 'verifying' || isDone}
          active={step === 'fetching'}
        >
          <p>→ GET /api/v1/sensors/AQI + receipt + nonce headers</p>
          {response && (
            <p>
              ← AQI: {response.data.aqi} | Temp: {response.data.temperature}°C |
              Humidity: {response.data.humidity}%
            </p>
          )}
        </StepRow>

        <StepRow
          number={4}
          title="Verify Signature"
          done={isDone}
          active={step === 'verifying'}
        >
          {signatureValid !== null && (
            <>
              <p>
                → Ed25519 signature{' '}
                {signatureValid ? (
                  <span className="text-green-400">verified ✓</span>
                ) : (
                  <span className="text-red-400">invalid ✗</span>
                )}{' '}
                against sensor pubkey
              </p>
              {response && (
                <p>→ Sensor: {response.proof.sensorPubkey.slice(0, 12)}…</p>
              )}
            </>
          )}
        </StepRow>
      </div>

      {response && (
        <details className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <summary className="cursor-pointer select-none px-5 py-3 text-sm text-slate-400 hover:text-white transition-colors">
            Raw Response JSON
          </summary>
          <pre className="p-5 text-xs text-slate-300 overflow-auto max-h-80">
            {JSON.stringify(response, null, 2)}
          </pre>
        </details>
      )}

      {isError && error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
