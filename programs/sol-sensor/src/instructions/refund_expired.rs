use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TransferChecked};

use crate::{
    errors::SolSensorError,
    state::{HardwareEntry, QueryReceipt, SensorPool, SPLIT_POOL_BPS},
};

/// Accounts required to refund an expired QueryReceipt.
///
/// Design decision: Only the 80 % pool share is refunded from the vault.
/// The 20 % hardware owner share is **not reversed** — the hardware owner
/// retains it regardless of whether the data was served. This avoids the
/// operational complexity of pulling funds back from the hardware owner's
/// wallet (which may be empty or controlled by a different key).
#[derive(Accounts)]
#[instruction(nonce: [u8; 32])]
pub struct RefundExpiredReceipt<'info> {
    /// The original query payer requesting the refund.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Pool state — source of reversed pool-share funds.
    /// PDA signs the vault transfer.
    #[account(mut, seeds = [SensorPool::SEEDS], bump = sensor_pool.bump)]
    pub sensor_pool: Account<'info, SensorPool>,

    /// The hardware entry associated with the original query (for sensor_id
    /// verification against the receipt).
    #[account(
        seeds = [HardwareEntry::SEEDS_PREFIX, hardware_entry.sensor_pubkey.as_ref()],
        bump = hardware_entry.bump,
        constraint = hardware_entry.sensor_pubkey == query_receipt.sensor_id
            @ SolSensorError::SensorIdMismatch,
    )]
    pub hardware_entry: Account<'info, HardwareEntry>,

    /// The expired receipt to close.  Seeds: ["receipt", nonce].
    #[account(
        mut,
        seeds = [QueryReceipt::SEEDS_PREFIX, &nonce],
        bump = query_receipt.bump,
        constraint = query_receipt.payer == payer.key(),
        constraint = !query_receipt.consumed @ SolSensorError::ReceiptAlreadyConsumed,
        close = payer,
    )]
    pub query_receipt: Account<'info, QueryReceipt>,

    /// Payer's USDC token account (refund destination — receives 80 %).
    #[account(mut)]
    pub payer_usdc: InterfaceAccount<'info, TokenAccount>,

    /// Pool vault USDC token account (reversal source — 80 % leg).
    /// Signed by the `sensor_pool` PDA.
    #[account(mut, address = sensor_pool.vault)]
    pub pool_vault: InterfaceAccount<'info, TokenAccount>,

    /// USDC mint — needed for `transfer_checked`.
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Program<'info, Token2022>,
    pub clock: Sysvar<'info, Clock>,
    pub system_program: Program<'info, System>,
}

/// Refund an expired, unconsumed QueryReceipt to the original payer.
///
/// Refunds the **80 % pool share** from the vault back to the payer.
/// The 20 % hardware owner share is retained by the hardware owner.
/// The PDA is then closed (rent refunded to the payer).
pub fn handler(ctx: Context<RefundExpiredReceipt>, _nonce: [u8; 32]) -> Result<()> {
    let clock = &ctx.accounts.clock;

    require!(
        ctx.accounts.query_receipt.is_expired(clock.slot),
        SolSensorError::ReceiptNotExpired
    );

    let amount = ctx.accounts.query_receipt.amount;

    // Calculate the 80 % pool share to refund.
    let pool_share = amount
        .checked_mul(SPLIT_POOL_BPS as u64)
        .and_then(|v| v.checked_div(10_000))
        .ok_or(SolSensorError::ArithmeticOverflow)?;

    // Transfer pool share back to payer, signed by sensor_pool PDA.
    let seeds: &[&[u8]] = &[SensorPool::SEEDS, &[ctx.accounts.sensor_pool.bump]];
    let signer_seeds = &[seeds];

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.pool_vault.to_account_info(),
        mint: ctx.accounts.usdc_mint.to_account_info(),
        to: ctx.accounts.payer_usdc.to_account_info(),
        authority: ctx.accounts.sensor_pool.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    let decimals = ctx.accounts.usdc_mint.decimals;
    token_interface::transfer_checked(cpi_ctx, pool_share, decimals)?;

    // Reverse the pool's total_distributed counter.
    let sensor_pool = &mut ctx.accounts.sensor_pool;
    sensor_pool.total_distributed = sensor_pool
        .total_distributed
        .saturating_sub(pool_share);

    msg!(
        "receipt_refunded: payer={}, pool_refund={}",
        ctx.accounts.payer.key(),
        pool_share
    );

    Ok(())
}
