import { fetchReceipt, decodeQueryReceipt, QueryReceiptData } from './solana';
import { rpc } from '../config';

export interface ReceiptValidationResult {
  valid: boolean;
  error?: string;
  receipt?: QueryReceiptData;
}

/**
 * Validate a QueryReceipt PDA:
 *  1. Fetch the account — 404 if not found
 *  2. Decode the Anchor struct fields
 *  3. Reject if already consumed
 *  4. Reject if expired (expiry_slot < current slot)
 *  5. Optionally verify sensor_id matches the requested sensor
 */
export async function validateReceipt(
  receiptPda: string,
  expectedSensorId?: string,
  injectedRpc?: typeof rpc
): Promise<ReceiptValidationResult> {
  let data: Uint8Array;
  try {
    data = await fetchReceipt(receiptPda);
  } catch {
    return { valid: false, error: 'Receipt account not found' };
  }

  let receipt: QueryReceiptData;
  try {
    receipt = decodeQueryReceipt(data);
  } catch {
    return { valid: false, error: 'Failed to decode receipt account data' };
  }

  if (receipt.consumed) {
    return { valid: false, error: 'Receipt already consumed' };
  }

  try {
    const rpcToUse = injectedRpc || rpc;
    const slotResponse = await rpcToUse.getSlot({ commitment: 'confirmed' }).send();
    const currentSlot = BigInt(slotResponse);
    if (receipt.expirySlot < currentSlot) {
      return {
        valid: false,
        error: `Receipt expired at slot ${receipt.expirySlot} (current: ${currentSlot})`,
      };
    }
  } catch {
    console.warn('[ReceiptService] Could not fetch current slot — skipping expiry check');
  }

  if (expectedSensorId && receipt.sensorId !== expectedSensorId) {
    return {
      valid: false,
      error: `Receipt is for sensor ${receipt.sensorId}, not ${expectedSensorId}`,
    };
  }

  return { valid: true, receipt };
}
