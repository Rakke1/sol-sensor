import { Router } from 'express';
import { rpc, SOLANA_RPC_URL, PROGRAM_ID_STR } from '../config';
import type { HealthStatus } from '../types';

const router = Router();

/**
 * GET /api/v1/health
 *
 * Returns server status and on-chain program connectivity check.
 */
router.get('/', async (_req, res) => {
  let connected = false;
  let slot: number | undefined;

  try {
    const response = await rpc.getSlot({ commitment: 'confirmed' }).send();
    slot = Number(response);
    connected = true;
  } catch (err) {
    console.error('[Health] RPC connectivity check failed:', err);
  }

  const health: HealthStatus = {
    status: connected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    solana: {
      rpcUrl: SOLANA_RPC_URL,
      connected,
      ...(slot !== undefined ? { slot } : {}),
    },
    programId: PROGRAM_ID_STR || '(not configured)',
  };

  res.status(connected ? 200 : 503).json(health);
});

export default router;
