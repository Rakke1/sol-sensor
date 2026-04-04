const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

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
    BASE58_ALPHABET[0].repeat(leadingZeros) +
    digits
      .reverse()
      .map((d) => BASE58_ALPHABET[d])
      .join('')
  );
}
