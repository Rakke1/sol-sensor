use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_2022::Token2022,
    token_interface::{Mint, TokenAccount},
};

use crate::{
    errors::SolSensorError,
    state::{GlobalState, HardwareEntry, SensorPool, MAX_POOL_SUPPLY},
};

/// Accounts required to register a new hardware sensor.
#[derive(Accounts)]
#[instruction(model_id: u8)]
pub struct RegisterSensor<'info> {
    /// Wallet registering (and owning) the sensor.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The sensor device's Ed25519 public key.  Used as a PDA seed.
    pub sensor_pubkey: UncheckedAccount<'info>,

    /// Global protocol state (increments `total_sensors`).
    #[account(
        mut,
        seeds = [GlobalState::SEEDS],
        bump = global_state.bump,
    )]
    pub global_state: Account<'info, GlobalState>,

    /// Pool state (increments `active_sensors` and `total_supply`).
    #[account(
        mut,
        seeds = [SensorPool::SEEDS],
        bump = sensor_pool.bump,
    )]
    pub sensor_pool: Account<'info, SensorPool>,

    /// On-chain record for the sensor.
    #[account(
        init,
        payer = owner,
        space = HardwareEntry::LEN,
        seeds = [HardwareEntry::SEEDS_PREFIX, sensor_pubkey.key().as_ref()],
        bump,
    )]
    pub hardware_entry: Account<'info, HardwareEntry>,

    /// Pool Token-2022 mint.
    #[account(mut, address = sensor_pool.mint)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// Owner's pool token ATA (receives minted tokens).
    #[account(mut)]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,

    /// USDC mint (for registration fee transfer).
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    /// Owner's USDC token account (source of registration fee).
    #[account(mut)]
    pub owner_usdc_account: InterfaceAccount<'info, TokenAccount>,

    /// Pool vault USDC token account (destination of registration fee).
    #[account(mut, address = sensor_pool.vault)]
    pub pool_vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Register a hardware sensor, mint pool tokens to the owner, and collect the
/// USDC registration fee.
pub fn handler(ctx: Context<RegisterSensor>, model_id: u8) -> Result<()> {
    let (fee, tokens) =
        HardwareEntry::model_info(model_id).ok_or(SolSensorError::UnknownModel)?;

    let sensor_pool = &ctx.accounts.sensor_pool;
    require!(
        sensor_pool
            .total_supply
            .checked_add(tokens)
            .ok_or(SolSensorError::ArithmeticOverflow)?
            <= sensor_pool.max_supply.min(MAX_POOL_SUPPLY),
        SolSensorError::SupplyCapExceeded
    );

    // Record the hardware entry.
    let hardware_entry = &mut ctx.accounts.hardware_entry;
    hardware_entry.owner = ctx.accounts.owner.key();
    hardware_entry.sensor_pubkey = ctx.accounts.sensor_pubkey.key();
    hardware_entry.model_id = model_id;
    hardware_entry.is_active = true;
    hardware_entry.registered_at = Clock::get()?.unix_timestamp;
    hardware_entry.registration_fee = fee;
    hardware_entry.bump = ctx.bumps.hardware_entry;

    // Update pool counters.
    let sensor_pool = &mut ctx.accounts.sensor_pool;
    sensor_pool.active_sensors = sensor_pool
        .active_sensors
        .checked_add(1)
        .ok_or(SolSensorError::ArithmeticOverflow)?;
    sensor_pool.total_supply = sensor_pool
        .total_supply
        .checked_add(tokens)
        .ok_or(SolSensorError::ArithmeticOverflow)?;

    let global_state = &mut ctx.accounts.global_state;
    global_state.total_sensors = global_state
        .total_sensors
        .checked_add(1)
        .ok_or(SolSensorError::ArithmeticOverflow)?;

    Ok(())
}
