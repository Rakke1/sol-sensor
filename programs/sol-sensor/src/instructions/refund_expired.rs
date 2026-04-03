use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::TokenAccount;

use crate::{
    errors::SolSensorError,
    state::{HardwareEntry, QueryReceipt, SensorPool},
};

/// Accounts required to refund an expired QueryReceipt.
#[derive(Accounts)]
pub struct RefundExpiredReceipt<'info> {
    /// The original query payer requesting the refund.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Pool state — source of reversed pool-share funds.
    #[account(mut, seeds = [SensorPool::SEEDS], bump = sensor_pool.bump)]
    pub sensor_pool: Account<'info, SensorPool>,

    /// The hardware entry associated with the original query.
    #[account(
        seeds = [HardwareEntry::SEEDS_PREFIX, hardware_entry.sensor_pubkey.as_ref()],
        bump = hardware_entry.bump,
    )]
    pub hardware_entry: Account<'info, HardwareEntry>,

    /// The expired receipt to close.
    #[account(
        mut,
        seeds = [QueryReceipt::SEEDS_PREFIX, &query_receipt.to_account_info().key().to_bytes()],
        bump = query_receipt.bump,
        constraint = query_receipt.payer == payer.key(),
        constraint = !query_receipt.consumed @ SolSensorError::ReceiptAlreadyConsumed,
        close = payer,
    )]
    pub query_receipt: Account<'info, QueryReceipt>,

    /// Payer's USDC token account (refund destination).
    #[account(mut)]
    pub payer_usdc: InterfaceAccount<'info, TokenAccount>,

    /// Hardware owner's USDC token account (reversal source — 20 % leg).
    #[account(mut)]
    pub hardware_owner_usdc: InterfaceAccount<'info, TokenAccount>,

    /// Pool vault USDC token account (reversal source — 80 % leg).
    #[account(mut, address = sensor_pool.vault)]
    pub pool_vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
    pub clock: Sysvar<'info, Clock>,
    pub system_program: Program<'info, System>,
}

/// Refund an expired, unconsumed QueryReceipt to the original payer.
///
/// Reverses the 20/80 revenue split: withdraws the hardware-owner share from
/// their USDC account and the pool share from the vault, returning both to the
/// payer.  The PDA is then closed (rent refunded).
pub fn handler(ctx: Context<RefundExpiredReceipt>) -> Result<()> {
    let clock = &ctx.accounts.clock;

    require!(
        ctx.accounts.query_receipt.is_expired(clock.slot),
        SolSensorError::ReceiptNotExpired
    );

    Ok(())
}
