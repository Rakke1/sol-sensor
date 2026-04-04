const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function encodeBase58(bytes: Uint8Array): string {
  let leadingZeros = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0) {
      break;
    }
    leadingZeros++;
  }

  const digits: number[] = [0];
  for (let i = leadingZeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  return (
    ALPHABET[0].repeat(leadingZeros) +
    digits
      .reverse()
      .map((d) => ALPHABET[d])
      .join('')
  );
}

export function decodeBase58(str: string): Uint8Array {
  const BASE = BigInt(58);
  let value = BigInt(0);
  for (const char of str) {
    const digit = ALPHABET.indexOf(char);
    if (digit === -1) {
      throw new Error(`Invalid base58 character: ${char}`);
    }
    value = value * BASE + BigInt(digit);
  }

  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value % 256n));
    value >>= 8n;
  }

  let leadingOnes = 0;
  for (const char of str) {
    if (char !== '1') {
      break;
    }
    leadingOnes++;
  }

  const result = new Uint8Array(leadingOnes + bytes.length);
  result.set(new Uint8Array(bytes), leadingOnes);

  return result;
}
