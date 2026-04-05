import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createSolanaRpc, address, type Address } from '@solana/kit';

dotenv.config();

export const PORT = parseInt(process.env.PORT ?? '3001', 10);
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
export const PROGRAM_ID_STR = process.env.PROGRAM_ID ?? '';
export const PROGRAM_ID: Address = address(
  PROGRAM_ID_STR || '11111111111111111111111111111111',
);
export const USDC_MINT_ADDRESS: Address = address(
  process.env.USDC_MINT_ADDRESS || '11111111111111111111111111111111',
);
export const POOL_MINT_ADDRESS: Address = address(
  process.env.POOL_MINT_ADDRESS || '11111111111111111111111111111111',
);
export const HARDWARE_OWNER_ADDRESS: string =
  process.env.HARDWARE_OWNER_ADDRESS ?? '';
export const COSIGNER_KEYPAIR_PATH =
  process.env.COSIGNER_KEYPAIR_PATH ?? './keys/cosigner.json';
export const SENSOR_KEYPAIR_PATH =
  process.env.SENSOR_KEYPAIR_PATH ?? './keys/sensor.json';

/** Solana RPC client (Kit) */
export const rpc = createSolanaRpc(SOLANA_RPC_URL);

/**
 * Load raw keypair bytes from an environment variable (JSON string) or a JSON file.
 * Priority: Env Var > File.
 * Returns null if the source does not exist or cannot be parsed.
 */
export function loadKeypairBytes(
  envVar: string,
  filePath: string,
): Uint8Array | null {
  // 1. Try environment variable
  const envVal = process.env[envVar];
  if (envVal) {
    try {
      const raw = JSON.parse(envVal) as number[];
      return new Uint8Array(raw);
    } catch (err) {
      console.warn(`[Config] Failed to parse ${envVar} from environment:`, err);
    }
  }

  // 2. Try file system
  const resolved = path.resolve(filePath);
  try {
    const raw = JSON.parse(fs.readFileSync(resolved, 'utf-8')) as number[];
    return new Uint8Array(raw);
  } catch {
    return null;
  }
}
