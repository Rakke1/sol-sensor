import type { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { PROGRAM_ID_STR } from '../config';
import { getSensorPubkey } from '../services/sensorSimulator';
import type { PaymentChallenge } from '../types';

/** Derive deterministic PDA-like addresses for the payment challenge. */
function derivePoolAddress(): string {
  return 'SensorPool1111111111111111111111111111111111';
}

function deriveVaultAddress(): string {
  return 'PoolVault111111111111111111111111111111111111';
}

/**
 * HTTP 402 Payment Required middleware.
 *
 * If the request does NOT include the `x-query-receipt` header, this
 * middleware short-circuits the request and returns a 402 response with
 * the full payment challenge so the client knows how to pay on-chain.
 *
 * If the header IS present, the request is passed to the next middleware
 * (on-chain receipt verification).
 */
export function http402(req: Request, res: Response, next: NextFunction): void {
  const receipt = req.headers['x-query-receipt'];
  if (receipt) {
    next();
    return;
  }

  const suggestedNonce = crypto.randomBytes(32).toString('base64url');

  const challenge: PaymentChallenge = {
    status: 402,
    message: 'Payment Required',
    payment: {
      programId: PROGRAM_ID_STR || '11111111111111111111111111111111',
      instruction: 'pay_for_query',
      price: {
        amount: 50_000,
        currency: 'USDC',
        decimals: 6,
      },
      suggestedNonce,
      accounts: {
        sensorPool: derivePoolAddress(),
        poolVault: deriveVaultAddress(),
        hardwareEntry: getSensorPubkey(),
        hardwareOwner: '11111111111111111111111111111111',
      },
    },
  };

  res.status(402).json(challenge);
}
