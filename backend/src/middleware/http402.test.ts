import { http402 } from './http402';
import * as pda from '../services/pda';
import * as sensorSimulator from '../services/sensorSimulator';
import * as ata from '../utils/ata';
import { USDC_MINT_ADDRESS, HARDWARE_OWNER_ADDRESS } from '../config';

describe('http402 middleware', () => {
  let req: any, res: any, next: any;
  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('calls next if x-query-receipt header is present', async () => {
    req.headers['x-query-receipt'] = 'some';
    await http402(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 402 with payment challenge if header missing', async () => {
    jest.spyOn(sensorSimulator, 'getSensorPubkey').mockReturnValue('sensorpubkey');
    // @ts-expect-error
    jest.spyOn(pda, 'deriveGlobalState').mockResolvedValue('global');
    // @ts-expect-error
    jest.spyOn(pda, 'deriveSensorPool').mockResolvedValue('pool');
    // @ts-expect-error
    jest.spyOn(pda, 'deriveHardwareEntry').mockResolvedValue('hwentry');
    // @ts-expect-error
    jest.spyOn(ata, 'getAssociatedTokenAddress').mockResolvedValue('vault');
    const ownerUsdc = HARDWARE_OWNER_ADDRESS ? 'ownerusdc' : '';
    if (HARDWARE_OWNER_ADDRESS) {
      // @ts-expect-error
      jest.spyOn(ata, 'getAssociatedTokenAddress').mockResolvedValueOnce('vault').mockResolvedValueOnce('ownerusdc');
    }
    await http402(req, res, next);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 402,
      payment: expect.objectContaining({
        programId: expect.any(String),
        instruction: 'pay_for_query',
        price: expect.objectContaining({ amount: 50000 }),
        suggestedNonce: expect.any(String),
        accounts: expect.objectContaining({
          globalState: 'global',
          sensorPool: 'pool',
          poolVault: 'vault',
          hardwareEntry: 'hwentry',
          hardwareOwner: expect.any(String),
          hardwareOwnerUsdc: expect.any(String),
          usdcMint: USDC_MINT_ADDRESS,
        }),
      }),
    }));
  });
});
