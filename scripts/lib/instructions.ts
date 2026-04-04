import {
  AccountRole,
  type Address,
  type Instruction,
  type AccountMeta,
  type AccountSignerMeta,
  type TransactionSigner,
} from '@solana/kit';
import * as crypto from 'node:crypto';
import { PROGRAM_ID } from './pda.js';

const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address;
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;
const SYSTEM_PROGRAM = '11111111111111111111111111111111' as Address;
const RENT_SYSVAR = 'SysvarRent111111111111111111111111111111111' as Address;

function anchorDiscriminator(name: string): Uint8Array {
  const hash = crypto.createHash('sha256').update(`global:${name}`).digest();

  return new Uint8Array(hash.subarray(0, 8));
}

function encodeU64LE(value: bigint): Uint8Array {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);

  return new Uint8Array(buf);
}

function encodeU8(value: number): Uint8Array {
  return new Uint8Array([value]);
}

type AnyAccountMeta = AccountMeta | AccountSignerMeta;

function w(addr: Address): AccountMeta {
  return { address: addr, role: AccountRole.WRITABLE };
}
function wSigner(signer: TransactionSigner): AccountSignerMeta {
  return { address: signer.address, role: AccountRole.WRITABLE_SIGNER, signer };
}
function r(addr: Address): AccountMeta {
  return { address: addr, role: AccountRole.READONLY };
}

export interface InitializePoolAccounts {
  admin: TransactionSigner;
  globalState: Address;
  sensorPool: Address;
  mint: TransactionSigner;
  poolVault: Address;
  usdcMint: Address;
  extraAccountMetaList: Address;
}

/**
 * Build the `initialize_pool` instruction.
 *
 * Account order matches the Anchor `InitializePool` struct:
 * admin, global_state, sensor_pool, mint, pool_vault, usdc_mint,
 * extra_account_meta_list, system_program, token_program, associated_token_program, rent
 */
export function buildInitializePoolIx(
  accounts: InitializePoolAccounts,
  maxSupply: bigint,
): Instruction<string, readonly AnyAccountMeta[]> {
  const disc = anchorDiscriminator('initialize_pool');
  const data = new Uint8Array([...disc, ...encodeU64LE(maxSupply)]);

  return {
    programAddress: PROGRAM_ID,
    accounts: [
      wSigner(accounts.admin),
      w(accounts.globalState),
      w(accounts.sensorPool),
      wSigner(accounts.mint),
      w(accounts.poolVault),
      r(accounts.usdcMint),
      w(accounts.extraAccountMetaList),
      r(SYSTEM_PROGRAM),
      r(TOKEN_2022_PROGRAM),
      r(ASSOCIATED_TOKEN_PROGRAM),
      r(RENT_SYSVAR),
    ],
    data,
  };
}

export interface RegisterSensorAccounts {
  owner: TransactionSigner;
  sensorPubkey: Address;
  globalState: Address;
  sensorPool: Address;
  hardwareEntry: Address;
  mint: Address;
  ownerTokenAccount: Address;
  usdcMint: Address;
  ownerUsdcAccount: Address;
  poolVault: Address;
}

/**
 * Build the `register_sensor` instruction.
 *
 * Account order matches the Anchor `RegisterSensor` struct:
 * owner, sensor_pubkey, global_state, sensor_pool, hardware_entry, mint,
 * owner_token_account, usdc_mint, owner_usdc_account, pool_vault,
 * token_program, associated_token_program, system_program
 */
export function buildRegisterSensorIx(
  accounts: RegisterSensorAccounts,
  modelId: number,
): Instruction<string, readonly AnyAccountMeta[]> {
  const disc = anchorDiscriminator('register_sensor');
  const data = new Uint8Array([...disc, ...encodeU8(modelId)]);

  return {
    programAddress: PROGRAM_ID,
    accounts: [
      wSigner(accounts.owner),
      r(accounts.sensorPubkey),
      w(accounts.globalState),
      w(accounts.sensorPool),
      w(accounts.hardwareEntry),
      w(accounts.mint),
      w(accounts.ownerTokenAccount),
      r(accounts.usdcMint),
      w(accounts.ownerUsdcAccount),
      w(accounts.poolVault),
      r(TOKEN_2022_PROGRAM),
      r(ASSOCIATED_TOKEN_PROGRAM),
      r(SYSTEM_PROGRAM),
    ],
    data,
  };
}

export { TOKEN_2022_PROGRAM, ASSOCIATED_TOKEN_PROGRAM, SYSTEM_PROGRAM };
