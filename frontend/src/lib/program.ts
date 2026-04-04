import { AccountRole, type Address } from '@solana/kit';
import { PROGRAM_ID } from './constants';

const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address;
const SYSTEM_PROGRAM = '11111111111111111111111111111111' as Address;
const CLOCK_SYSVAR = 'SysvarC1ock11111111111111111111111111111111' as Address;

const programAddress = PROGRAM_ID as Address;

type AccountMeta = {
  address: Address;
  role: (typeof AccountRole)[keyof typeof AccountRole];
};

export interface SolSensorInstruction {
  programAddress: Address;
  accounts: readonly AccountMeta[];
  data: Uint8Array;
}

const discriminatorCache = new Map<string, Uint8Array>();

async function anchorDiscriminator(name: string): Promise<Uint8Array> {
  const cached = discriminatorCache.get(name);
  if (cached) {
    return cached;
  }

  const encoded = new TextEncoder().encode(`global:${name}`);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  const disc = new Uint8Array(hash).slice(0, 8);
  discriminatorCache.set(name, disc);

  return disc;
}

function encodeU64LE(value: bigint): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigUint64(0, value, true);

  return new Uint8Array(buf);
}

function ws(addr: Address): AccountMeta {
  return { address: addr, role: AccountRole.WRITABLE_SIGNER };
}
function w(addr: Address): AccountMeta {
  return { address: addr, role: AccountRole.WRITABLE };
}
function r(addr: Address): AccountMeta {
  return { address: addr, role: AccountRole.READONLY };
}

export interface PayForQueryAccounts {
  payer: Address;
  globalState: Address;
  sensorPool: Address;
  hardwareEntry: Address;
  hardwareOwnerUsdc: Address;
  payerUsdc: Address;
  poolVault: Address;
  usdcMint: Address;
  queryReceipt: Address;
}

export async function buildPayForQueryIx(
  accounts: PayForQueryAccounts,
  nonce: Uint8Array,
  amount: bigint,
): Promise<SolSensorInstruction> {
  const disc = await anchorDiscriminator('pay_for_query');
  const data = new Uint8Array(8 + 32 + 8);
  data.set(disc, 0);
  data.set(nonce, 8);
  data.set(encodeU64LE(amount), 40);

  return {
    programAddress,
    accounts: [
      ws(accounts.payer),
      w(accounts.globalState),
      w(accounts.sensorPool),
      r(accounts.hardwareEntry),
      w(accounts.hardwareOwnerUsdc),
      w(accounts.payerUsdc),
      w(accounts.poolVault),
      r(accounts.usdcMint),
      w(accounts.queryReceipt),
      r(TOKEN_2022_PROGRAM),
      r(SYSTEM_PROGRAM),
      r(CLOCK_SYSVAR),
    ],
    data,
  };
}

export interface ClaimRewardsAccounts {
  holder: Address;
  sensorPool: Address;
  contributorState: Address;
  holderTokenAccount: Address;
  usdcMint: Address;
  holderUsdc: Address;
  poolVault: Address;
}

export async function buildClaimRewardsIx(
  accounts: ClaimRewardsAccounts,
): Promise<SolSensorInstruction> {
  const disc = await anchorDiscriminator('claim_rewards');

  return {
    programAddress,
    accounts: [
      ws(accounts.holder),
      w(accounts.sensorPool),
      w(accounts.contributorState),
      r(accounts.holderTokenAccount),
      r(accounts.usdcMint),
      w(accounts.holderUsdc),
      w(accounts.poolVault),
      r(TOKEN_2022_PROGRAM),
      r(SYSTEM_PROGRAM),
    ],
    data: disc,
  };
}

export interface InitContributorAccounts {
  holder: Address;
  sensorPool: Address;
  contributorState: Address;
}

export async function buildInitContributorIx(
  accounts: InitContributorAccounts,
): Promise<SolSensorInstruction> {
  const disc = await anchorDiscriminator('init_contributor');

  return {
    programAddress,
    accounts: [
      ws(accounts.holder),
      r(accounts.sensorPool),
      w(accounts.contributorState),
      r(SYSTEM_PROGRAM),
    ],
    data: disc,
  };
}
