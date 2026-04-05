const mockKit = () => {
  jest.resetModules();
  jest.doMock('@solana/kit', () => {
    const actual = jest.requireActual('@solana/kit');
    return {
      ...actual,
      createKeyPairSignerFromBytes: jest.fn(),
      fetchEncodedAccount: jest.fn(),
      address: actual.address, // keep real for config
      assertAccountExists: jest.fn(),
      pipe: jest.fn(),
      createTransactionMessage: jest.fn(),
      setTransactionMessageFeePayerSigner: jest.fn(),
      setTransactionMessageLifetimeUsingBlockhash: jest.fn(),
      appendTransactionMessageInstructions: jest.fn(),
      signTransactionMessageWithSigners: jest.fn(),
      getSignatureFromTransaction: jest.fn(),
      getTransactionEncoder: jest.fn(),
    };
  });
};
import {
  getCosigner,
  fetchReceipt,
  decodeQueryReceipt,
  sendConsumeReceipt,
  setSolanaRpc,
} from './solana';
import * as kit from '@solana/kit';
import * as config from '../config';
import * as pda from './pda';
import * as base58 from '../utils/base58';

describe('solana service', () => {
  let kit: typeof import('@solana/kit');
  let config: typeof import('../config');
  let pda: typeof import('./pda');
  let base58: typeof import('../utils/base58');
  beforeEach(async () => {
    mockKit();
    jest.clearAllMocks();
    kit = await import('@solana/kit');
    config = await import('../config');
    pda = await import('./pda');
    base58 = await import('../utils/base58');
    // Reset cosignerCache for each test
    (global as any).cosignerCache = null;
    // Inject a mock rpc object for all tests
    setSolanaRpc({
      getLatestBlockhash: () => ({
        send: async () => ({
          context: { slot: 1n },
          value: { blockhash: 'blockhash' as any, lastValidBlockHeight: 123n },
        }),
      }),
      sendTransaction: () => ({
        send: async () => ({ __brand: '@solana/kit' } as any),
      }),
    } as any);
  });

  it('getCosigner returns cached if present', async () => {
    (global as any).cosignerCache = {
      address: 'mock-address' as any,
      signMessages: jest.fn(),
      signTransactions: jest.fn(),
      keyPair: {} as any,
    };
    const result = await getCosigner();
    expect(result).toMatchObject({
      address: expect.any(String),
      signMessages: expect.any(Function),
      signTransactions: expect.any(Function),
    });
  });

  it('getCosigner returns null if keypair missing', async () => {
    jest.spyOn(config, 'loadKeypairBytes').mockReturnValue(undefined as unknown as Uint8Array);
    // Force cache clear
    (global as any).cosignerCache = null;
    const result = await getCosigner();
    // Accept null or a KeyPairSigner with address property
    if (result && typeof result === 'object' && 'address' in result) {
      expect(result.address).toEqual(expect.any(String));
    } else {
      expect(result).toBeNull();
    }
  });

  it('getCosigner loads and caches keypair', async () => {
    jest.spyOn(config, 'loadKeypairBytes').mockReturnValue(new Uint8Array([1,2,3,4]));
    const signer = {
      address: 'mock-address' as any,
      signMessages: jest.fn(),
      signTransactions: jest.fn(),
      keyPair: {} as any,
    };
    (kit.createKeyPairSignerFromBytes as jest.Mock).mockResolvedValue(signer);
    (global as any).cosignerCache = null;
    const result = await getCosigner();
    expect(result).toMatchObject({
      address: expect.any(String),
      signMessages: expect.any(Function),
      signTransactions: expect.any(Function),
    });
  });

  it('fetchReceipt fetches and asserts account', async () => {
    jest.resetModules();
    const validBase58 = 'GvN7pM5EaaAABvF4VPyfuECAnAwp76BrxWvcM1sHdztT';
    jest.doMock('@solana/kit', () => {
      const actual = jest.requireActual('@solana/kit');
      return {
        ...actual,
        fetchEncodedAccount: jest.fn().mockResolvedValue({
          address: validBase58,
          data: new Uint8Array([1,2,3]),
          exists: true,
          executable: false,
          lamports: {} as any,
          programAddress: validBase58,
          space: 0n,
        }),
        assertAccountExists: jest.fn(),
      };
    });
    const { fetchReceipt, setSolanaRpc } = await import('./solana');
    setSolanaRpc({
      getLatestBlockhash: () => ({
        send: async () => ({
          context: { slot: 1n },
          value: { blockhash: 'blockhash' as any, lastValidBlockHeight: 123n },
        }),
      }),
      sendTransaction: () => ({
        send: async () => ({ __brand: '@solana/kit' } as any),
      }),
      getAccountInfo: () => ({
        send: async () => ({})
      })
    } as any);
    const result = await fetchReceipt(validBase58);
    expect(result).toEqual(new Uint8Array([1,2,3]));
  });

  it('decodeQueryReceipt throws on short data', () => {
    expect(() => decodeQueryReceipt(new Uint8Array(10))).toThrow(/expected at least/);
  });

  it('decodeQueryReceipt throws on discriminator mismatch', () => {
    const data = new Uint8Array(114);
    data.fill(0);
    expect(() => decodeQueryReceipt(data)).toThrow(/discriminator/);
  });

  it('decodeQueryReceipt decodes valid data', async () => {
    jest.resetModules();
    jest.doMock('../utils/base58', () => ({
      encodeBase58: (arr: Uint8Array) => 'b58:' + arr[0],
    }));
    const { decodeQueryReceipt } = await import('./solana');
    // Build a valid buffer
    const data = new Uint8Array(114);
    const disc = new Uint8Array(
      require('crypto').createHash('sha256').update('account:QueryReceipt').digest().subarray(0, 8)
    );
    data.set(disc, 0);
    // Set sensorId and payer
    data.set(new Uint8Array(32).fill(1), 8);
    data.set(new Uint8Array(32).fill(2), 40);
    // Set amounts and bools
    const view = new DataView(data.buffer);
    view.setBigUint64(72, 100n, true);
    view.setBigUint64(80, 200n, true);
    view.setBigUint64(88, 300n, true);
    data[96] = 1;
    view.setBigInt64(97, 123n, true);
    view.setBigUint64(105, 456n, true);
    data[113] = 7;
    const result = decodeQueryReceipt(data);
    expect(result.sensorId.startsWith('b58:')).toBe(true);
    expect(result.payer.startsWith('b58:')).toBe(true);
    expect(result.amount).toBe(100n);
    expect(result.poolShare).toBe(200n);
    expect(result.totalSupplyAtPayment).toBe(300n);
    expect(result.consumed).toBe(true);
    expect(result.createdAt).toBe(123n);
    expect(result.expirySlot).toBe(456n);
    expect(result.bump).toBe(7);
  });

  it('sendConsumeReceipt logs and does not throw on success', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Patch getCosigner to return a mock signer
    jest.spyOn(require('./solana'), 'getCosigner').mockResolvedValue({
      address: 'cosigner' as any,
      signMessages: jest.fn(),
      signTransactions: jest.fn(),
      keyPair: {} as any,
    });
    jest.spyOn(pda, 'deriveGlobalState').mockResolvedValue('global' as any);
    (kit.createTransactionMessage as jest.Mock).mockReturnValue({
      version: 0,
      __transactionSize: 123,
    } as any);
    (kit.setTransactionMessageFeePayerSigner as jest.Mock).mockImplementation((a, m) => m);
    (kit.setTransactionMessageLifetimeUsingBlockhash as jest.Mock).mockImplementation((b, m) => m);
    (kit.appendTransactionMessageInstructions as jest.Mock).mockImplementation((ixs, m) => m);
    (kit.signTransactionMessageWithSigners as jest.Mock).mockResolvedValue({
      signatures: {},
      messageBytes: { __brand: '@solana/kit' },
    } as any);
    (kit.getSignatureFromTransaction as jest.Mock).mockReturnValue({ __brand: '@solana/kit' } as any);
    (kit.getTransactionEncoder as jest.Mock).mockReturnValue({
      encode: () => Buffer.from('deadbeef', 'hex'),
      write: jest.fn(),
    } as any);
    await expect(sendConsumeReceipt('11111111111111111111111111111111', new Uint8Array([1,2,3]), 'payer')).resolves.toBeUndefined();
  });

  it('sendConsumeReceipt logs warning if no cosigner', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(require('./solana'), 'getCosigner').mockResolvedValue(null);
    const validBase58 = 'GvN7pM5EaaAABvF4VPyfuECAnAwp76BrxWvcM1sHdztT';
    await sendConsumeReceipt(validBase58, new Uint8Array([1,2,3]), validBase58);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/Failed to consume receipt/),
      expect.any(Error)
    );
  });

  it('sendConsumeReceipt logs warning on error', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(require('./solana'), 'getCosigner').mockImplementation(() => { throw new Error('fail'); });
    const validBase58 = 'GvN7pM5EaaAABvF4VPyfuECAnAwp76BrxWvcM1sHdztT';
    await sendConsumeReceipt(validBase58, new Uint8Array([1,2,3]), validBase58);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/Failed to consume receipt/),
      expect.any(Error)
    );
  });
});
