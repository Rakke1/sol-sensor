export const PROGRAM_ID =
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? 'ETu1YLCnZyeeWBYYLSFXLNncJa4AgaHaZQ8JSUxTEosJ';

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const SOLANA_NETWORK =
  process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet';

export const USDC_MINT_ADDRESS =
  process.env.NEXT_PUBLIC_USDC_MINT_ADDRESS ?? '';

export const POOL_MINT_ADDRESS =
  process.env.NEXT_PUBLIC_POOL_MINT_ADDRESS ?? '';

/** Precision factor used in on-chain reward accumulator (10^12) */
export const PRECISION_FACTOR = BigInt(1_000_000_000_000);

/** USDC micro-payment price per query (0.05 USDC = 50_000 micro-USDC) */
export const QUERY_PRICE_MICRO_USDC = 50_000;

/** Hardware owner revenue split (20%) */
export const HARDWARE_OWNER_SPLIT = 0.2;

/** Pool revenue split (80%) */
export const POOL_SPLIT = 0.8;

/** Sensor types supported by the API */
export const SENSOR_TYPES = ['AQI', 'TEMPERATURE', 'HUMIDITY'] as const;
export type SensorType = (typeof SENSOR_TYPES)[number];
