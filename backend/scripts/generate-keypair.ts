/**
 * Keypair generator script.
 *
 * Usage:
 *   npx ts-node scripts/generate-keypair.ts cosigner
 *   npx ts-node scripts/generate-keypair.ts sensor
 *
 * Generates an Ed25519 keypair and writes the 64-byte secret key as a JSON
 * array to ./keys/<name>.json (matching the Solana CLI keypair format).
 */
import * as nacl from 'tweetnacl';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const name = process.argv[2];
if (!name) {
  console.error('Usage: npx ts-node scripts/generate-keypair.ts <name>');
  process.exit(1);
}

const keysDir = path.resolve(__dirname, '..', 'keys');
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

const outPath = path.join(keysDir, `${name}.json`);
if (fs.existsSync(outPath)) {
  console.error(`Keypair already exists at ${outPath}. Delete it first to regenerate.`);
  process.exit(1);
}

const seed = crypto.randomBytes(32);
const keypair = nacl.sign.keyPair.fromSeed(seed);
const secretKeyArray = Array.from(keypair.secretKey);

fs.writeFileSync(outPath, JSON.stringify(secretKeyArray), { mode: 0o600 });

const pubkeyHex = Buffer.from(keypair.publicKey).toString('hex');
console.log(`Generated keypair for "${name}"`);
console.log(`  File:   ${outPath}`);
console.log(`  Pubkey: ${pubkeyHex} (hex)`);
