import { encodeBase58 } from './base58';

describe('base58 utils', () => {
  it('encodes a Uint8Array to a base58 string', () => {
    const arr = new Uint8Array([1, 2, 3, 4, 5]);
    const encoded = encodeBase58(arr);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
  });

  it('encodes an empty Uint8Array to "1"', () => {
    const arr = new Uint8Array([]);
    const encoded = encodeBase58(arr);
    expect(encoded).toBe('1');
  });
});
