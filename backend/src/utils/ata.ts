import {
  getProgramDerivedAddress,
  getAddressEncoder,
  type Address,
} from '@solana/kit';

const ASSOCIATED_TOKEN_PROGRAM =
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;
const TOKEN_2022_PROGRAM =
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address;

const encoder = getAddressEncoder();

/**
 * Derive the Associated Token Account address for a given mint and owner.
 * Seeds: [owner, TOKEN_2022_PROGRAM, mint] under ASSOCIATED_TOKEN_PROGRAM.
 */
export async function getAssociatedTokenAddress(
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
