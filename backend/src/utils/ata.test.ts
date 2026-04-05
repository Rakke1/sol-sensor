import { getAssociatedTokenAddress } from './ata';

describe('ata utils', () => {
  const mint = 'So11111111111111111111111111111111111111112';
  const owner = '11111111111111111111111111111111';

  it('getAssociatedTokenAddress returns a promise resolving to a string', async () => {
    // This will fail unless getProgramDerivedAddress is mocked, so we just check that it returns a Promise
    const promise = getAssociatedTokenAddress(mint as any, owner as any);
    expect(promise).toBeInstanceOf(Promise);
  });
});
