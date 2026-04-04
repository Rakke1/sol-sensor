import type { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import {
  PROGRAM_ID_STR,
  USDC_MINT_ADDRESS,
  HARDWARE_OWNER_ADDRESS,
} from '../config';
import { getSensorPubkey } from '../services/sensorSimulator';
import { deriveGlobalState, deriveSensorPool, deriveHardwareEntry } from '../services/pda';
import { getAssociatedTokenAddress } from '../utils/ata';
import type { PaymentChallenge } from '../types';
import type { Address } from '@solana/kit';

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
export async function http402(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const receipt = req.headers['x-query-receipt'];
  if (receipt) {
    next();

    return;
  }

  const suggestedNonce = crypto.randomBytes(32).toString('base64url');

  const sensorPubkey = getSensorPubkey();
  const [globalState, sensorPool, hardwareEntry] = await Promise.all([
    deriveGlobalState(),
    deriveSensorPool(),
    deriveHardwareEntry(sensorPubkey as Address),
  ]);

  const poolVault = await getAssociatedTokenAddress(
    USDC_MINT_ADDRESS,
    sensorPool,
  );

  const hardwareOwnerUsdc = HARDWARE_OWNER_ADDRESS
    ? await getAssociatedTokenAddress(
        USDC_MINT_ADDRESS,
        HARDWARE_OWNER_ADDRESS as Address,
      )
    : '';

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
        globalState,
        sensorPool,
        poolVault,
        hardwareEntry,
        hardwareOwner: HARDWARE_OWNER_ADDRESS || '11111111111111111111111111111111',
        hardwareOwnerUsdc,
        usdcMint: USDC_MINT_ADDRESS,
      },
    },
  };

  res.status(402).json(challenge);
}
