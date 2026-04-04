function addThousandsSeparator(s: string): string {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatUsdc(microUsdc: bigint): string {
  const negative = microUsdc < 0n;
  const abs = negative ? -microUsdc : microUsdc;
  const whole = abs / 1_000_000n;
  const frac = abs % 1_000_000n;
  const fracStr = frac.toString().padStart(6, '0').slice(0, 2);
  const prefix = negative ? '-' : '';

  return `${prefix}${addThousandsSeparator(whole.toString())}.${fracStr}`;
}

export function formatTokens(rawTokens: bigint): string {
  const negative = rawTokens < 0n;
  const abs = negative ? -rawTokens : rawTokens;
  const whole = abs / 1_000_000n;
  const frac = abs % 1_000_000n;

  const wholeStr = addThousandsSeparator(whole.toString());
  const prefix = negative ? '-' : '';

  if (frac === 0n) {
    return `${prefix}${wholeStr}`;
  }

  const fracStr = frac.toString().padStart(6, '0').slice(0, 2).replace(/0+$/, '');

  return `${prefix}${wholeStr}.${fracStr}`;
}

export function formatSupplyPct(
  totalSupply: bigint,
  maxSupply: bigint,
): string {
  if (maxSupply === 0n) {
    return '0.0';
  }

  if (totalSupply >= maxSupply) {
    return '100.0';
  }

  const scaled = (totalSupply * 1000n) / maxSupply;
  const whole = scaled / 10n;
  const frac = scaled % 10n;

  return `${whole}.${frac}`;
}
