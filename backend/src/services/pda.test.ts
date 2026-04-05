import * as pda from './pda';
import { PROGRAM_ID } from '../config';
import { getProgramDerivedAddress } from '@solana/kit';

jest.mock('@solana/kit', () => {
  const actual = jest.requireActual('@solana/kit') as Record<string, any>;
  return {
    ...actual,
    getProgramDerivedAddress: jest.fn(),
    getAddressEncoder: actual.getAddressEncoder,
  };
});


import type { Address } from '@solana/kit';
const fakeAddress = '11111111111111111111111111111111' as unknown as Address; // 32 chars, valid base58

describe('pda service', () => {
  beforeEach(() => {
    (getProgramDerivedAddress as jest.Mock).mockReset();
  });

  it('deriveGlobalState caches and returns PDA', async () => {
    (getProgramDerivedAddress as jest.Mock).mockResolvedValueOnce([fakeAddress]);
    const pda1 = await pda.deriveGlobalState();
    expect(pda1).toBe(fakeAddress);
    // Should return cached value
    const pda2 = await pda.deriveGlobalState();
    expect(pda2).toBe(fakeAddress);
    expect(getProgramDerivedAddress).toHaveBeenCalledTimes(1);
  });

  it('deriveSensorPool caches and returns PDA', async () => {
    (getProgramDerivedAddress as jest.Mock).mockResolvedValueOnce([fakeAddress]);
    const pda1 = await pda.deriveSensorPool();
    expect(pda1).toBe(fakeAddress);
    // Should return cached value
    const pda2 = await pda.deriveSensorPool();
    expect(pda2).toBe(fakeAddress);
    expect(getProgramDerivedAddress).toHaveBeenCalledTimes(1);
  });

  it('deriveHardwareEntry returns PDA', async () => {
    (getProgramDerivedAddress as jest.Mock).mockResolvedValueOnce([fakeAddress]);
    const pdaVal = await pda.deriveHardwareEntry(fakeAddress);
    expect(pdaVal).toBe(fakeAddress);
    expect(getProgramDerivedAddress).toHaveBeenCalledWith({
      programAddress: PROGRAM_ID,
      seeds: [expect.any(Buffer), expect.any(Uint8Array)],
    });
  });

  it('deriveReceiptPda returns PDA', async () => {
    (getProgramDerivedAddress as jest.Mock).mockResolvedValueOnce([fakeAddress]);
    const nonce = new Uint8Array([1,2,3]);
    const pdaVal = await pda.deriveReceiptPda(nonce);
    expect(pdaVal).toBe(fakeAddress);
    expect(getProgramDerivedAddress).toHaveBeenCalledWith({
      programAddress: PROGRAM_ID,
      seeds: [expect.any(Buffer), nonce],
    });
  });
});
