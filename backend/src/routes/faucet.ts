/**
 * POST /api/v1/faucet - Auto-mint 100 USDC if wallet balance < 10 USDC.
 */

import { Router, type Request, type Response } from 'express';
import { mintUsdcToWallet } from '../services/faucet';

const router = Router();

/**
 * POST /
 * Body: { wallet: string } (base58 wallet address)
 * Response: { funded: true, amount: 100, sig: string } | { funded: false, message: string }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.body;

    if (!wallet || typeof wallet !== 'string' || wallet.trim() === '') {
      res.status(400).json({ error: 'Missing or invalid wallet address' });
      return;
    }

    const result = await mintUsdcToWallet(wallet.trim());

    if (result.funded) {
      res.status(200).json({
        funded: true,
        amount: 100,
        sig: result.sig,
      });
    } else {
      res.status(200).json({
        funded: false,
        message: result.message,
      });
    }
  } catch (err) {
    console.error('[Faucet] Error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

export default router;
