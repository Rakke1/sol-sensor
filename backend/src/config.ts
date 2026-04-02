import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createSolanaRpc } from '@solana/kit';

dotenv.config();

export const PORT = parseInt(process.env.PORT ?? '3001', 10);
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
export const PROGRAM_ID_STR = process.env.PROGRAM_ID ?? '';
export const COSIGNER_KEYPAIR_PATH =
  process.env.COSIGNER_KEYPAIR_PATH ?? './keys/cosigner.json';
export const SENSOR_KEYPAIR_PATH =
  process.env.SENSOR_KEYPAIR_PATH ?? './keys/sensor.json';

/** Solana RPC client (Kit) */
export const rpc = createSolanaRpc(SOLANA_RPC_URL);

/**
 * Load raw keypair bytes from a JSON file (array of numbers).
 * Returns null if the file does not exist or cannot be parsed.
 */
export function loadKeypairBytes(filePath: string): Uint8Array | null {
  const resolved = path.resolve(filePath);
  try {
    const raw = JSON.parse(fs.readFileSync(resolved, 'utf-8')) as number[];
    return new Uint8Array(raw);
  } catch {
    return null;
  }
}
