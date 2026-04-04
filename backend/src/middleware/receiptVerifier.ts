import type { Request, Response, NextFunction } from 'express';
import { validateReceipt } from '../services/receiptService';
import { getSensorPubkey } from '../services/sensorSimulator';

/**
 * On-chain receipt verifier middleware.
 *
 * Expects both `x-query-receipt` (receipt PDA address) and `x-query-nonce`
 * (base64url-encoded 32-byte nonce used in pay_for_query) headers.
 *
 * Validates the receipt on-chain, checks sensor_id matches the requested
 * sensor, and stores receipt + nonce in res.locals for the route handler.
 */
export async function receiptVerifier(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const receiptPda = req.headers['x-query-receipt'] as string;
  const nonceB64 = req.headers['x-query-nonce'] as string | undefined;

  if (!nonceB64) {
    res.status(400).json({ error: 'Missing x-query-nonce header' });

    return;
  }

  let nonceBytes: Uint8Array;
  try {
    nonceBytes = new Uint8Array(Buffer.from(nonceB64, 'base64url'));
    if (nonceBytes.length !== 32) {
      throw new Error('nonce must be 32 bytes');
    }
  } catch {
    res.status(400).json({ error: 'Invalid x-query-nonce: expected base64url-encoded 32 bytes' });

    return;
  }

  const expectedSensorId = getSensorPubkey();

  const result = await validateReceipt(receiptPda, expectedSensorId).catch(
    (err: unknown) => ({
      valid: false as const,
      error: `Internal error during receipt validation: ${String(err)}`,
      receipt: undefined,
    }),
  );

  if (!result.valid) {
    res.status(403).json({ error: result.error ?? 'Invalid receipt' });

    return;
  }

  res.locals['receipt'] = result.receipt;
  res.locals['receiptPda'] = receiptPda;
  res.locals['nonce'] = nonceBytes;
  next();
}
