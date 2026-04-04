import { createKeyPairSignerFromBytes, type KeyPairSigner } from '@solana/kit';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const KEYS_DIR = path.resolve(import.meta.dirname, '..', 'keys');

function ensureKeysDir(): void {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }
}

function keyPath(name: string): string {
  return path.join(KEYS_DIR, `${name}.json`);
}

/**
 * Generate a 64-byte Solana CLI keypair from a random seed.
 * Format: [32 bytes seed | 32 bytes public key]
 */
async function generateCliKeypair(): Promise<Uint8Array> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify'],
  ) as { publicKey: crypto.webcrypto.CryptoKey; privateKey: crypto.webcrypto.CryptoKey };

  const pubBytes = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey));
  // PKCS8 Ed25519: the 32-byte seed starts at offset 16
  const seedBytes = pkcs8.slice(16, 48);

  const cliFormat = new Uint8Array(64);
  cliFormat.set(seedBytes, 0);
  cliFormat.set(pubBytes, 32);

  return cliFormat;
}

export async function loadOrGenerateKeypair(name: string): Promise<{ signer: KeyPairSigner; created: boolean }> {
  ensureKeysDir();
  const filePath = keyPath(name);

  if (fs.existsSync(filePath)) {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (Array.isArray(raw)) {
      const bytes = new Uint8Array(raw);
      const signer = await createKeyPairSignerFromBytes(bytes);

      return { signer, created: false };
    }
  }

  const cliBytes = await generateCliKeypair();
  fs.writeFileSync(filePath, JSON.stringify(Array.from(cliBytes)), { mode: 0o600 });

  const signer = await createKeyPairSignerFromBytes(cliBytes);

  return { signer, created: true };
}

export function saveMintAddress(name: string, mintAddress: string): void {
  ensureKeysDir();
  fs.writeFileSync(keyPath(name), JSON.stringify({ address: mintAddress }), { mode: 0o600 });
}

export function loadMintAddress(name: string): string | null {
  const filePath = keyPath(name);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (typeof data === 'object' && data !== null && 'address' in data) {
      return data.address as string;
    }
  } catch {
    // Not a mint address file
  }

  return null;
}
