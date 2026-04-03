//! Shared account-factory helpers for Mollusk and LiteSVM tests.
//!
//! These builders create pre-populated account state that matches what the
//! program would write on-chain, allowing tests to set up realistic starting
//! conditions without running a full instruction chain.

use solana_program::pubkey::Pubkey;
use sol_sensor::state::{
    ContributorState, GlobalState, HardwareEntry, QueryReceipt, SensorPool,
    RECEIPT_EXPIRY_SLOTS,
};

// ─────────────────────────────────────────────────────────────────────────────
// PDA derivation helpers
// ─────────────────────────────────────────────────────────────────────────────

pub fn global_state_pda(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[GlobalState::SEEDS], program_id)
}

pub fn sensor_pool_pda(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[SensorPool::SEEDS], program_id)
}

pub fn hardware_entry_pda(sensor_pubkey: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[HardwareEntry::SEEDS_PREFIX, sensor_pubkey.as_ref()],
        program_id,
    )
}

pub fn contributor_state_pda(holder: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[ContributorState::SEEDS_PREFIX, holder.as_ref()],
        program_id,
    )
}

pub fn receipt_pda(nonce: &[u8; 32], program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[QueryReceipt::SEEDS_PREFIX, nonce], program_id)
}

// ─────────────────────────────────────────────────────────────────────────────
// Account data builders
// ─────────────────────────────────────────────────────────────────────────────

/// Build a GlobalState with sensible defaults.
pub fn mk_global_state(admin: Pubkey, consume_authority: Pubkey, bump: u8) -> GlobalState {
    GlobalState {
        admin,
        consume_authority,
        total_sensors: 0,
        total_queries: 0,
        bump,
    }
}

/// Build a SensorPool with sensible defaults.
pub fn mk_sensor_pool(mint: Pubkey, vault: Pubkey, bump: u8) -> SensorPool {
    SensorPool {
        mint,
        vault,
        reward_per_token: 0,
        total_distributed: 0,
        active_sensors: 0,
        total_supply: 0,
        max_supply: 10_000_000,
        bump,
    }
}

/// Build a SensorPool with a non-zero reward accumulator (for reward tests).
pub fn mk_sensor_pool_with_rewards(
    mint: Pubkey,
    vault: Pubkey,
    reward_per_token: u128,
    total_supply: u64,
    bump: u8,
) -> SensorPool {
    SensorPool {
        mint,
        vault,
        reward_per_token,
        total_distributed: 0,
        active_sensors: 1,
        total_supply,
        max_supply: 10_000_000,
        bump,
    }
}

/// Build a HardwareEntry for the mock dev sensor (model_id = 3).
pub fn mk_hardware_entry(owner: Pubkey, sensor_pubkey: Pubkey, bump: u8) -> HardwareEntry {
    HardwareEntry {
        owner,
        sensor_pubkey,
        model_id: 3,
        is_active: true,
        registered_at: 0,
        registration_fee: 5_000_000,
        bump,
    }
}

/// Build a ContributorState starting from the given reward_per_token snapshot.
pub fn mk_contributor_state(
    holder: Pubkey,
    reward_per_token_paid: u128,
    rewards_owed: u64,
    bump: u8,
) -> ContributorState {
    ContributorState {
        holder,
        reward_per_token_paid,
        rewards_owed,
        bump,
    }
}

/// Build a QueryReceipt; `expiry_slot` defaults to current_slot + RECEIPT_EXPIRY_SLOTS.
pub fn mk_query_receipt(
    sensor_id: Pubkey,
    payer: Pubkey,
    amount: u64,
    created_slot: u64,
    bump: u8,
) -> QueryReceipt {
    QueryReceipt {
        sensor_id,
        payer,
        amount,
        consumed: false,
        created_at: 0,
        expiry_slot: created_slot + RECEIPT_EXPIRY_SLOTS,
        bump,
    }
}
