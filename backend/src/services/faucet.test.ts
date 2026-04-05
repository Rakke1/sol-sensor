


import { jest, describe, beforeAll, beforeEach, it, expect } from '@jest/globals';
import type { SpyInstance } from 'jest-mock';
jest.mock('@solana/kit', () => {
  const actual = jest.requireActual('@solana/kit') as Record<string, any>;
  return {
    ...actual,
    fetchEncodedAccount: jest.fn(),
    getTransactionEncoder: jest.fn(),
    pipe: jest.fn(),
    createTransactionMessage: jest.fn(),
    setTransactionMessageFeePayerSigner: jest.fn(),
    setTransactionMessageLifetimeUsingBlockhash: jest.fn(),
    appendTransactionMessageInstructions: jest.fn(),
    signTransactionMessageWithSigners: jest.fn(),
    getSignatureFromTransaction: jest.fn(),
  };
});
import { address } from '@solana/kit';
import { mintUsdcToWallet, getUsdcBalance } from './faucet';
import * as solana from './solana';
import * as kit from '@solana/kit';

describe('faucet service', () => {
  const validAddress = 'BELDKKK9wrazFCu97sR3mV5bzoTAscDzDPH6EKpz9aNv';
  const validAta = address('ATA11111111111111111111111111111111111111111');
  const validMint = address('So11111111111111111111111111111111111111112');

  let getAssociatedTokenAddressMock: SpyInstance<any>;
  let getCosignerMock: SpyInstance<any>;
  let getUsdcBalanceMock: SpyInstance<any>;
  // kit.* mocks are provided by jest.mock factory
  let rpcMock: SpyInstance;

  beforeAll(() => {
    jest.spyOn(DataView.prototype, 'getBigUint64').mockImplementation(() => 10000000 as any);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    getAssociatedTokenAddressMock = jest.spyOn(require('../utils/ata'), 'getAssociatedTokenAddress');
    getCosignerMock = jest.spyOn(solana, 'getCosigner');
    getUsdcBalanceMock = jest.spyOn(require('./faucet'), 'getUsdcBalance');

    // If you need to mock config.rpc, do it differently or remove this line if not needed
  });


  beforeEach(() => {
    jest.clearAllMocks();
  });



  beforeEach(() => {
    jest.clearAllMocks();
  });



  it('should not fund if balance >= threshold', async () => {
    jest.resetModules();
    jest.doMock('@solana/kit', () => {
      const actual = jest.requireActual('@solana/kit') as any;
      const fakeMsg = { version: 0, instructions: [], __transactionSize: 123 };
      return {
        address: actual.address,
        getAddressEncoder: actual.getAddressEncoder,
        createSolanaRpc: actual.createSolanaRpc,
        createKeyPairSignerFromBytes: actual.createKeyPairSignerFromBytes,
        getProgramDerivedAddress: actual.getProgramDerivedAddress,
        AccountRole: actual.AccountRole,
        getTransactionEncoder: jest.fn().mockReturnValue({ encode: () => Buffer.from('deadbeef', 'hex') }),
        pipe: jest.fn((x) => x),
        createTransactionMessage: jest.fn().mockReturnValue(fakeMsg),
        setTransactionMessageFeePayerSigner: jest.fn().mockReturnValue(fakeMsg),
        setTransactionMessageLifetimeUsingBlockhash: jest.fn().mockReturnValue(fakeMsg),
        appendTransactionMessageInstructions: jest.fn().mockReturnValue(fakeMsg),
        // @ts-expect-error
        signTransactionMessageWithSigners: jest.fn().mockResolvedValue({
          signatures: {},
          messageBytes: new Uint8Array([1,2,3]),
        }),
        getSignatureFromTransaction: jest.fn().mockReturnValue('sig'),
      };
    });
    jest.doMock('./solana', () => ({
      // @ts-expect-error
      getCosigner: jest.fn().mockResolvedValue({ address: validMint, sign: jest.fn() }),
    }));
    jest.doMock('../utils/ata', () => ({
      // @ts-expect-error
      getAssociatedTokenAddress: jest.fn().mockResolvedValue(validAta),
    }));
    jest.doMock('@solana/kit', () => {
      const actual = jest.requireActual('@solana/kit') as any;
      // Create a buffer with 72 bytes, set offset 64 to 10_000_000n
      const buf = Buffer.alloc(72);
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      view.setBigUint64(64, 10_000_000n, true);
      return {
        ...actual,
        // @ts-expect-error
        fetchEncodedAccount: jest.fn().mockResolvedValue({ exists: true, data: buf }),
      };
    });
    const { mintUsdcToWallet } = require('./faucet');
    const mockRpc = {
      getLatestBlockhash: jest.fn().mockReturnValue({ send: async () => ({ value: 'blockhash' }) }),
      sendTransaction: jest.fn().mockReturnValue({ send: async () => 'sig' }),
    };
    const result = await mintUsdcToWallet(validAddress, mockRpc);
    expect(result.funded).toBe(false);
    expect(result.message).toMatch(/already/);
  });

  it('should throw if cosigner missing', async () => {
    jest.resetModules();
    jest.doMock('@solana/kit', () => {
      const actual = jest.requireActual('@solana/kit') as any;
      const fakeMsg = { version: 0, instructions: [], __transactionSize: 123 };
      return {
        address: actual.address,
        getAddressEncoder: actual.getAddressEncoder,
        createSolanaRpc: actual.createSolanaRpc,
        createKeyPairSignerFromBytes: actual.createKeyPairSignerFromBytes,
        getProgramDerivedAddress: actual.getProgramDerivedAddress,
        AccountRole: actual.AccountRole,
        getTransactionEncoder: jest.fn().mockReturnValue({ encode: () => Buffer.from('deadbeef', 'hex') }),
        pipe: jest.fn((x) => x),
        createTransactionMessage: jest.fn().mockReturnValue(fakeMsg),
        setTransactionMessageFeePayerSigner: jest.fn().mockReturnValue(fakeMsg),
        setTransactionMessageLifetimeUsingBlockhash: jest.fn().mockReturnValue(fakeMsg),
        appendTransactionMessageInstructions: jest.fn().mockReturnValue(fakeMsg),
        // @ts-expect-error
        signTransactionMessageWithSigners: jest.fn().mockResolvedValue({
          signatures: {},
          messageBytes: new Uint8Array([1,2,3]),
        }),
        getSignatureFromTransaction: jest.fn().mockReturnValue('sig'),
      };
    });
    jest.doMock('./solana', () => ({
      // @ts-expect-error
      getCosigner: jest.fn().mockResolvedValue(null),
    }));
    jest.doMock('../utils/ata', () => ({
      // @ts-expect-error
      getAssociatedTokenAddress: jest.fn().mockResolvedValue(validAta),
    }));
    jest.doMock('./faucet', () => jest.requireActual('./faucet'));
    const { mintUsdcToWallet } = require('./faucet');
    await expect(mintUsdcToWallet(validAddress)).rejects.toThrow(/cosigner keypair not loaded/i);
  });

  it('should handle transaction error', async () => {
    jest.resetModules();
    jest.doMock('@solana/kit', () => {
      const actual = jest.requireActual('@solana/kit') as any;
      const fakeMsg = { version: 0, instructions: [], __transactionSize: 123 };
      return {
        address: actual.address,
        getAddressEncoder: actual.getAddressEncoder,
        createSolanaRpc: actual.createSolanaRpc,
        createKeyPairSignerFromBytes: actual.createKeyPairSignerFromBytes,
        getProgramDerivedAddress: actual.getProgramDerivedAddress,
        AccountRole: actual.AccountRole,
        getTransactionEncoder: jest.fn().mockReturnValue({ encode: () => Buffer.from('deadbeef', 'hex') }),
        pipe: jest.fn((x) => x),
        createTransactionMessage: jest.fn().mockReturnValue(fakeMsg),
        setTransactionMessageFeePayerSigner: jest.fn().mockReturnValue(fakeMsg),
        setTransactionMessageLifetimeUsingBlockhash: jest.fn().mockReturnValue(fakeMsg),
        appendTransactionMessageInstructions: jest.fn().mockReturnValue(fakeMsg),
        // @ts-expect-error
        signTransactionMessageWithSigners: jest.fn().mockResolvedValue({
          signatures: {},
          messageBytes: new Uint8Array([1,2,3]),
        }),
        getSignatureFromTransaction: jest.fn().mockReturnValue('sig'),
      };
    });
    jest.doMock('./solana', () => ({
      // @ts-expect-error
      getCosigner: jest.fn().mockResolvedValue({ address: validMint, sign: jest.fn() }),
    }));
    jest.doMock('./faucet', () => Object.assign({}, jest.requireActual('./faucet'), {
      // @ts-expect-error
      getUsdcBalance: jest.fn().mockResolvedValue(0n),
    }));
    jest.doMock('../utils/ata', () => ({
      // @ts-expect-error
      getAssociatedTokenAddress: jest.fn().mockResolvedValue(validAta),
    }));
    const { mintUsdcToWallet } = require('./faucet');
    const mockRpc = {
      getLatestBlockhash: jest.fn().mockReturnValue({ send: async () => ({ value: 'blockhash' }) }),
      sendTransaction: jest.fn().mockReturnValue({ send: async () => { throw new Error('tx error'); } }),
    };
    await expect(mintUsdcToWallet(validAddress, mockRpc)).rejects.toThrow(/tx error/i);
  });

  it('should get balance as 0 on error', async () => {
    // Reset all mocks to avoid interference
    jest.clearAllMocks();
    // Mock getAssociatedTokenAddress to throw
    const ata = require('../utils/ata');
    jest.spyOn(ata, 'getAssociatedTokenAddress').mockRejectedValue(new Error('fail'));
    // Re-import getUsdcBalance to ensure clean state
    const { getUsdcBalance } = require('./faucet');
    const bal = await getUsdcBalance(address(validAddress));
    expect(Number(bal)).toBe(0);
  });
});
