import * as receiptService from './receiptService';
import * as solana from './solana';


describe('receiptService', () => {
  const fakePda = 'FakePda11111111111111111111111111111111111111111';
  const fakeSensorId = 'Sensor1111111111111111111111111111111111111111';
  const fakeReceipt = {
    sensorId: fakeSensorId,
    payer: 'Payer11111111111111111111111111111111111111111',
    amount: 100n,
    poolShare: 10n,
    totalSupplyAtPayment: 1000n,
    consumed: false,
    createdAt: 123456789n,
    expirySlot: 1000n,
    bump: 1,
  };

  let mockRpc: any;
  beforeEach(() => {
    jest.spyOn(solana, 'fetchReceipt').mockReset();
    jest.spyOn(solana, 'decodeQueryReceipt').mockReset();
    mockRpc = {
      getSlot: jest.fn().mockReturnValue({ send: async () => 100n })
    };
  });

  it('returns invalid if fetchReceipt throws', async () => {
    (solana.fetchReceipt as jest.Mock).mockRejectedValue(new Error('not found'));
    const result = await receiptService.validateReceipt(fakePda, undefined, mockRpc);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not found|account/i);
  });

  it('returns invalid if decodeQueryReceipt throws', async () => {
    (solana.fetchReceipt as jest.Mock).mockResolvedValue(new Uint8Array([1,2,3]));
    (solana.decodeQueryReceipt as jest.Mock).mockImplementation(() => { throw new Error('decode fail'); });
    const result = await receiptService.validateReceipt(fakePda, undefined, mockRpc);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/decode/i);
  });

  it('returns invalid if receipt is consumed', async () => {
    (solana.fetchReceipt as jest.Mock).mockResolvedValue(new Uint8Array([1,2,3]));
    (solana.decodeQueryReceipt as jest.Mock).mockReturnValue({ ...fakeReceipt, consumed: true });
    const result = await receiptService.validateReceipt(fakePda, undefined, mockRpc);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/consumed/i);
  });

  it('returns invalid if receipt is expired', async () => {
    (solana.fetchReceipt as jest.Mock).mockResolvedValue(new Uint8Array([1,2,3]));
    (solana.decodeQueryReceipt as jest.Mock).mockReturnValue({ ...fakeReceipt, expirySlot: 10n });
    mockRpc.getSlot.mockReturnValue({ send: () => Promise.resolve(100n) });
    const result = await receiptService.validateReceipt(fakePda, undefined, mockRpc);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  it('skips expiry check if getSlot throws', async () => {
    (solana.fetchReceipt as jest.Mock).mockResolvedValue(new Uint8Array([1,2,3]));
    (solana.decodeQueryReceipt as jest.Mock).mockReturnValue(fakeReceipt);
    mockRpc.getSlot.mockReturnValue({ send: () => { throw new Error('fail'); } });
    const result = await receiptService.validateReceipt(fakePda, undefined, mockRpc);
    expect(result.valid).toBe(true);
    expect(result.receipt).toBeDefined();
  });

  it('returns invalid if sensorId does not match', async () => {
    (solana.fetchReceipt as jest.Mock).mockResolvedValue(new Uint8Array([1,2,3]));
    (solana.decodeQueryReceipt as jest.Mock).mockReturnValue(fakeReceipt);
    mockRpc.getSlot.mockReturnValue({ send: () => Promise.resolve(1n) });
    const result = await receiptService.validateReceipt(fakePda, 'OtherSensor', mockRpc);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/sensor/i);
  });

  it('returns valid if all checks pass', async () => {
    (solana.fetchReceipt as jest.Mock).mockResolvedValue(new Uint8Array([1,2,3]));
    (solana.decodeQueryReceipt as jest.Mock).mockReturnValue(fakeReceipt);
    mockRpc.getSlot.mockReturnValue({ send: () => Promise.resolve(1n) });
    const result = await receiptService.validateReceipt(fakePda, fakeSensorId, mockRpc);
    expect(result.valid).toBe(true);
    expect(result.receipt).toBe(fakeReceipt);
  });
});
