import type { Request, Response, NextFunction } from 'express';
import { validateReceipt } from '../services/receiptService';

/**
 * On-chain receipt verifier middleware.
 *
 * Assumes the `x-query-receipt` header is present (checked by http402
 * middleware before this one runs). Fetches and decodes the QueryReceipt
 * PDA from Solana devnet, then:
 *  - Returns 403 if the receipt is already consumed or expired
 *  - Returns 403 if `x-sensor-id` header doesn't match the receipt's sensor_id
 *  - Stores `res.locals.receipt` for downstream route handlers
 *  - Calls next() to continue to the sensor data route on success
 *
 * Note: Receipt consumption (consume_receipt instruction) happens AFTER the
 * sensor data is generated, inside the route handler, to ensure atomicity.
 */
export async function receiptVerifier(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const receiptPda = req.headers['x-query-receipt'] as string;

  const result = await validateReceipt(receiptPda).catch((err: unknown) => ({
    valid: false as const,
    error: `Internal error during receipt validation: ${String(err)}`,
    receipt: undefined,
  }));

  if (!result.valid) {
    res.status(403).json({ error: result.error ?? 'Invalid receipt' });
    return;
  }

  res.locals['receipt'] = result.receipt;
  next();
}
