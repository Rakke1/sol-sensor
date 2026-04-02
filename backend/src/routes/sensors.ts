import { Router } from 'express';
import { http402 } from '../middleware/http402';
import { receiptVerifier } from '../middleware/receiptVerifier';
import { simulateSensorReading } from '../services/sensorSimulator';

const router = Router();

/**
 * GET /api/v1/sensors/:sensorType
 *
 * Two-phase response:
 *  1. Without `x-query-receipt` header → HTTP 402 with payment challenge
 *  2. With valid `x-query-receipt` header → HTTP 200 with signed sensor data
 *
 * Supported sensor types: AQI (others fall back to AQI for the MVP simulator)
 */
router.get(
  '/:sensorType',
  http402,
  receiptVerifier,
  (req, res) => {
    const { sensorType } = req.params;
    try {
    const response = simulateSensorReading(sensorType);
      res.status(200).json(response);
    } catch (err) {
      console.error('[Sensors] Failed to generate sensor reading:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
