#![allow(unexpected_cfgs)]
#![allow(ambiguous_glob_reexports)]

use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

pub use instructions::*;

declare_id!("ETu1YLCnZyeeWBYYLSFXLNncJa4AgaHaZQ8JSUxTEosJ");

#[program]
pub mod sol_sensor {
    use super::*;

    /// One-time initialization of the global state, sensor pool, Token-2022 mint,
    /// pool vault, and ExtraAccountMetaList for the Transfer Hook extension.
    pub fn initialize_pool(ctx: Context<InitializePool>, max_supply: u64) -> Result<()> {
        instructions::initialize_pool::handler(ctx, max_supply)
    }

    /// Register a new hardware sensor, mint pool tokens to the owner, and collect
    /// the registration fee in USDC.
    pub fn register_sensor(
        ctx: Context<RegisterSensor>,
        model_id: u8,
    ) -> Result<()> {
        instructions::register_sensor::handler(ctx, model_id)
    }

    /// Initialise a ContributorState PDA for a pool token holder so they can
    /// accumulate and claim revenue-share rewards.
    pub fn init_contributor(ctx: Context<InitContributor>) -> Result<()> {
        instructions::init_contributor::handler(ctx)
    }

    /// Pay for a sensor data query. Creates a QueryReceipt PDA, splits the fee
    /// 20 % to the hardware owner and 80 % to the pool vault, and updates the
    /// reward accumulator.
    pub fn pay_for_query(
        ctx: Context<PayForQuery>,
        nonce: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        instructions::pay_for_query::handler(ctx, nonce, amount)
    }

    /// Called by the API co-signer after serving the sensor data.  Marks the
    /// QueryReceipt as consumed and closes the PDA, refunding rent to the payer.
    pub fn consume_receipt(ctx: Context<ConsumeReceipt>, nonce: [u8; 32]) -> Result<()> {
        instructions::consume_receipt::handler(ctx, nonce)
    }

    /// Refund an expired, unconsumed QueryReceipt to the original payer.
    /// Reverses the 80 % pool-vault share and closes the PDA.
    pub fn refund_expired_receipt(ctx: Context<RefundExpiredReceipt>, nonce: [u8; 32]) -> Result<()> {
        instructions::refund_expired::handler(ctx, nonce)
    }

    /// Claim accumulated USDC rewards proportional to the caller's pool token
    /// balance, using precision-scaled reward-per-token accounting.
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        instructions::claim_rewards::handler(ctx)
    }

    /// Token-2022 Transfer Hook — automatically invoked by the runtime on every
    /// pool token transfer to sync reward indices for both parties.
    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        instructions::transfer_hook::handler(ctx, amount)
    }

    /// Manual fallback for `transfer_hook` — used when the automatic hook
    /// cannot be triggered (e.g. off-chain settlement).
    pub fn sync_rewards(ctx: Context<SyncRewards>) -> Result<()> {
        instructions::sync_rewards::handler(ctx)
    }
}
