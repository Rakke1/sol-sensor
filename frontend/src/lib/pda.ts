import {
  getProgramDerivedAddress,
  getAddressEncoder,
  type Address,
} from '@solana/kit';
import { PROGRAM_ID } from './constants';

const programAddress = PROGRAM_ID as Address;
const encoder = getAddressEncoder();

const TOKEN_2022_PROGRAM =
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address;
const ASSOCIATED_TOKEN_PROGRAM =
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;

export async function deriveGlobalState(): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [new TextEncoder().encode('global')],
  });

  return pda;
}

export async function deriveSensorPool(): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [new TextEncoder().encode('pool')],
  });

  return pda;
}

export async function deriveContributorState(
  wallet: Address,
): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [new TextEncoder().encode('contrib'), encoder.encode(wallet)],
  });

  return pda;
}

export async function deriveHardwareEntry(
  sensorPubkey: Address,
): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [new TextEncoder().encode('hw'), encoder.encode(sensorPubkey)],
  });

  return pda;
}

export async function deriveReceiptPda(nonce: Uint8Array): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [new TextEncoder().encode('receipt'), nonce],
  });

  return pda;
}

export async function deriveAta(
  mint: Address,
  owner: Address,
): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM,
    seeds: [
      encoder.encode(owner),
      encoder.encode(TOKEN_2022_PROGRAM),
      encoder.encode(mint),
    ],
  });

  return pda;
}
