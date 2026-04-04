import {
  getProgramDerivedAddress,
  getAddressEncoder,
  type Address,
  type ProgramDerivedAddress,
} from '@solana/kit';

const PROGRAM_ID = 'ETu1YLCnZyeeWBYYLSFXLNncJa4AgaHaZQ8JSUxTEosJ' as Address;

const encoder = getAddressEncoder();

export async function deriveGlobalState(): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [Buffer.from('global')],
  });
}

export async function deriveSensorPool(): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [Buffer.from('pool')],
  });
}

export async function deriveExtraAccountMetaList(mint: Address): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [Buffer.from('extra-account-metas'), encoder.encode(mint)],
  });
}

export async function deriveHardwareEntry(sensorPubkey: Address): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [Buffer.from('hw'), encoder.encode(sensorPubkey)],
  });
}

export async function deriveContributorState(holder: Address): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [Buffer.from('contrib'), encoder.encode(holder)],
  });
}

export { PROGRAM_ID };
