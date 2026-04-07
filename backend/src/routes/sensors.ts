import { Router } from 'express';
import { http402 } from '../middleware/http402';
import { receiptVerifier } from '../middleware/receiptVerifier';
import { simulateSensorReading } from '../services/sensorSimulator';
import { sendConsumeReceipt } from '../services/solana';
import type { QueryReceiptData } from '../services/solana';

const router = Router();

/**
 * GET /api/v1/sensors/:sensorType
 *
 * Two-phase response:
 *  1. Without `x-query-receipt` header → HTTP 402 with payment challenge
 *  2. With valid `x-query-receipt` header → HTTP 200 with signed sensor data
 *
 * After sending data, fires consume_receipt as background task.
 */
router.get(
  '/:sensorType',
  http402,
  receiptVerifier,
  (req, res) => {
    const { sensorType } = req.params;
    const { sensor: sensorId } = req.query;
    try {
      const response = simulateSensorReading(sensorType, sensorId as string | undefined);
      res.status(200).json(response);

      const receipt = res.locals['receipt'] as QueryReceiptData | undefined;
      const receiptPda = res.locals['receiptPda'] as string | undefined;
      const nonce = res.locals['nonce'] as Uint8Array | undefined;

      if (receipt && receiptPda && nonce) {
        sendConsumeReceipt(receiptPda, nonce, receipt.payer).catch(() => {});
      }
    } catch (err) {
      console.error('[Sensors] Failed to generate sensor reading:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
