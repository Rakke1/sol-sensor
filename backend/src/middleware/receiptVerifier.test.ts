import { receiptVerifier } from './receiptVerifier';
import * as receiptService from '../services/receiptService';
import * as sensorSimulator from '../services/sensorSimulator';

describe('receiptVerifier middleware', () => {
  let req: any, res: any, next: any;
  beforeEach(() => {
    req = { headers: { 'x-query-receipt': 'pda', 'x-query-nonce': Buffer.alloc(32).toString('base64url') } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn(), locals: {} };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('returns 400 if x-query-nonce is missing', async () => {
    req.headers['x-query-nonce'] = undefined;
    await receiptVerifier(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/nonce/i) }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 if x-query-nonce is invalid', async () => {
    req.headers['x-query-nonce'] = 'badbase64';
    await receiptVerifier(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/base64url/i) }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 if receipt is invalid', async () => {
    jest.spyOn(sensorSimulator, 'getSensorPubkey').mockReturnValue('sensorid');
    jest.spyOn(receiptService, 'validateReceipt').mockResolvedValue({ valid: false, error: 'bad receipt' });
    await receiptVerifier(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'bad receipt' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('sets locals and calls next if valid', async () => {
    jest.spyOn(sensorSimulator, 'getSensorPubkey').mockReturnValue('sensorid');
    const validReceipt = {
      sensorId: 'sensorid',
      payer: 'payer',
      amount: 1n,
      poolShare: 1n,
      totalSupplyAtPayment: 1n,
      consumed: false,
      createdAt: 1n,
      expirySlot: 1n,
      bump: 1,
    };
    jest.spyOn(receiptService, 'validateReceipt').mockResolvedValue({ valid: true, receipt: validReceipt });
    await receiptVerifier(req, res, next);
    expect(res.locals.receipt).toEqual(validReceipt);
    expect(res.locals.receiptPda).toBe('pda');
    expect(res.locals.nonce).toBeInstanceOf(Uint8Array);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 on internal error', async () => {
    jest.spyOn(sensorSimulator, 'getSensorPubkey').mockReturnValue('sensorid');
    jest.spyOn(receiptService, 'validateReceipt').mockRejectedValue(new Error('fail'));
    await receiptVerifier(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    expect(next).not.toHaveBeenCalled();
  });
});
