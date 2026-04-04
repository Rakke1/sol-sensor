import {
  getProgramDerivedAddress,
  getAddressEncoder,
  type Address,
} from '@solana/kit';
import { PROGRAM_ID } from '../config';

const encoder = getAddressEncoder();

let globalStateCache: Address | null = null;
let sensorPoolCache: Address | null = null;

export async function deriveGlobalState(): Promise<Address> {
  if (globalStateCache) {
    return globalStateCache;
  }
  const [pda] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [Buffer.from('global')],
  });
  globalStateCache = pda;

  return pda;
}

export async function deriveSensorPool(): Promise<Address> {
  if (sensorPoolCache) {
    return sensorPoolCache;
  }
  const [pda] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [Buffer.from('pool')],
  });
  sensorPoolCache = pda;

  return pda;
}

export async function deriveHardwareEntry(
  sensorPubkey: Address,
): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [Buffer.from('hw'), encoder.encode(sensorPubkey)],
  });

  return pda;
}

export async function deriveReceiptPda(nonce: Uint8Array): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [Buffer.from('receipt'), nonce],
  });

  return pda;
}
