use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TransferChecked};

use crate::{
    errors::SolSensorError,
    state::{
        GlobalState, HardwareEntry, QueryReceipt, SensorPool, RECEIPT_EXPIRY_SLOTS,
        SPLIT_HARDWARE_BPS, SPLIT_POOL_BPS,
    },
};

/// Accounts required to pay for a sensor data query.
#[derive(Accounts)]
#[instruction(nonce: [u8; 32])]
pub struct PayForQuery<'info> {
    /// The client (payer) for the query.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Global protocol state (increments `total_queries`).
    #[account(mut, seeds = [GlobalState::SEEDS], bump = global_state.bump)]
    pub global_state: Account<'info, GlobalState>,

    /// Pool state (updates `reward_per_token` accumulator).
    #[account(mut, seeds = [SensorPool::SEEDS], bump = sensor_pool.bump)]
    pub sensor_pool: Account<'info, SensorPool>,

    /// On-chain record of the sensor being queried — must be active.
    #[account(
        seeds = [HardwareEntry::SEEDS_PREFIX, hardware_entry.sensor_pubkey.as_ref()],
        bump = hardware_entry.bump,
        constraint = hardware_entry.is_active @ SolSensorError::SensorNotActive,
    )]
    pub hardware_entry: Account<'info, HardwareEntry>,

    /// Hardware owner's USDC token account (receives 20 % of the fee).
    #[account(mut)]
    pub hardware_owner_usdc: InterfaceAccount<'info, TokenAccount>,

    /// Payer's USDC token account (source of funds).
    #[account(mut)]
    pub payer_usdc: InterfaceAccount<'info, TokenAccount>,

    /// Pool vault USDC token account (receives 80 % of the fee).
    #[account(mut, address = sensor_pool.vault)]
    pub pool_vault: InterfaceAccount<'info, TokenAccount>,

    /// USDC mint — needed for `transfer_checked`.
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    /// Ephemeral payment receipt PDA (created here, closed on consumption).
    #[account(
        init,
        payer = payer,
        space = QueryReceipt::LEN,
        seeds = [QueryReceipt::SEEDS_PREFIX, &nonce],
        bump,
    )]
    pub query_receipt: Account<'info, QueryReceipt>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

/// Process a payment for a sensor data query.
///
/// Splits `amount` 20/80 between the hardware owner and the pool vault,
/// updates the reward-per-token accumulator, and mints a QueryReceipt PDA.
pub fn handler(ctx: Context<PayForQuery>, _nonce: [u8; 32], amount: u64) -> Result<()> {
    let clock = &ctx.accounts.clock;

    // Validate amount is non-zero (enforces minimum payment).
    require!(amount > 0, SolSensorError::InsufficientPayment);

    // Calculate the revenue split.
    let hardware_share = amount
        .checked_mul(SPLIT_HARDWARE_BPS as u64)
        .and_then(|v| v.checked_div(10_000))
        .ok_or(SolSensorError::ArithmeticOverflow)?;

    let pool_share = amount
        .checked_mul(SPLIT_POOL_BPS as u64)
        .and_then(|v| v.checked_div(10_000))
        .ok_or(SolSensorError::ArithmeticOverflow)?;

    let usdc_decimals = ctx.accounts.usdc_mint.decimals;

    // 1. Transfer 20 % to the hardware owner.
    let hw_transfer = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.payer_usdc.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            to: ctx.accounts.hardware_owner_usdc.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        },
    );
    token_interface::transfer_checked(hw_transfer, hardware_share, usdc_decimals)?;

    // 2. Transfer 80 % to the pool vault.
    let vault_transfer = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.payer_usdc.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            to: ctx.accounts.pool_vault.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        },
    );
    token_interface::transfer_checked(vault_transfer, pool_share, usdc_decimals)?;

    // 3. Update the reward-per-token accumulator with the pool's share.
    let sensor_pool = &mut ctx.accounts.sensor_pool;
    if sensor_pool.total_supply > 0 {
        use crate::state::sensor_pool::PRECISION_FACTOR;
        let increment = (pool_share as u128)
            .checked_mul(PRECISION_FACTOR)
            .and_then(|v| v.checked_div(sensor_pool.total_supply as u128))
            .ok_or(SolSensorError::ArithmeticOverflow)?;

        let old_rpt = sensor_pool.reward_per_token;
        sensor_pool.reward_per_token = sensor_pool
            .reward_per_token
            .checked_add(increment)
            .ok_or(SolSensorError::ArithmeticOverflow)?;

        msg!(
            "reward_per_token updated: {} -> {}",
            old_rpt,
            sensor_pool.reward_per_token
        );
    }

    sensor_pool.total_distributed = sensor_pool
        .total_distributed
        .checked_add(pool_share)
        .ok_or(SolSensorError::ArithmeticOverflow)?;

    // 4. Increment global query counter.
    let global_state = &mut ctx.accounts.global_state;
    global_state.total_queries = global_state
        .total_queries
        .checked_add(1)
        .ok_or(SolSensorError::ArithmeticOverflow)?;

    // 5. Write the receipt.
    let query_receipt = &mut ctx.accounts.query_receipt;
    query_receipt.sensor_id = ctx.accounts.hardware_entry.sensor_pubkey;
    query_receipt.payer = ctx.accounts.payer.key();
    query_receipt.amount = amount;
    query_receipt.consumed = false;
    query_receipt.created_at = clock.unix_timestamp;
    query_receipt.expiry_slot = clock
        .slot
        .checked_add(RECEIPT_EXPIRY_SLOTS)
        .ok_or(SolSensorError::ArithmeticOverflow)?;
    query_receipt.bump = ctx.bumps.query_receipt;

    msg!(
        "pay_for_query: sensor={}, amount={}, hw_share={}, pool_share={}",
        ctx.accounts.hardware_entry.sensor_pubkey,
        amount,
        hardware_share,
        pool_share
    );

    Ok(())
}
