use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_2022::Token2022,
};

use crate::{
    errors::SolSensorError,
    state::{GlobalState, SensorPool, MAX_POOL_SUPPLY},
};

/// Accounts required to initialise the SolSensor protocol.
///
/// This is a one-time operation that must be called by the admin before any
/// other instruction can be used.  It creates:
///  - the `GlobalState` singleton PDA,
///  - the `SensorPool` singleton PDA,
///  - the Token-2022 pool mint (with Transfer Hook extension),
///  - the pool vault token account,
///  - the `ExtraAccountMetaList` PDA required by the Transfer Hook runtime.
#[derive(Accounts)]
pub struct InitializePool<'info> {
    /// The admin wallet that pays for all account creation.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Global protocol state PDA.
    #[account(
        init,
        payer = admin,
        space = GlobalState::LEN,
        seeds = [GlobalState::SEEDS],
        bump,
    )]
    pub global_state: Account<'info, GlobalState>,

    /// Pool configuration PDA.
    #[account(
        init,
        payer = admin,
        space = SensorPool::LEN,
        seeds = [SensorPool::SEEDS],
        bump,
    )]
    pub sensor_pool: Account<'info, SensorPool>,

    /// Token-2022 pool mint.  Created with a Transfer Hook extension pointing to
    /// this program.
    #[account(mut)]
    pub mint: Signer<'info>,

    /// Pool vault — the ATA of the `sensor_pool` PDA for the pool mint.
    #[account(mut)]
    pub pool_vault: UncheckedAccount<'info>,

    /// ExtraAccountMetaList PDA required by the Token-2022 Transfer Hook runtime.
    /// Seeds: `["extra-account-metas", mint.key()]` — matches the SPL standard.
    #[account(mut)]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Initialise the SolSensor protocol.
///
/// # Parameters
/// * `max_supply` — hard cap on pool token supply (must be > 0 and ≤ [`MAX_POOL_SUPPLY`]).
pub fn handler(ctx: Context<InitializePool>, max_supply: u64) -> Result<()> {
    // Validate supply cap before touching any state.
    require!(
        max_supply > 0 && max_supply <= MAX_POOL_SUPPLY,
        SolSensorError::SupplyCapExceeded
    );

    let global_state = &mut ctx.accounts.global_state;
    global_state.admin = ctx.accounts.admin.key();
    global_state.consume_authority = ctx.accounts.admin.key(); // updated post-deploy
    global_state.total_sensors = 0;
    global_state.total_queries = 0;
    global_state.bump = ctx.bumps.global_state;

    let sensor_pool = &mut ctx.accounts.sensor_pool;
    sensor_pool.mint = ctx.accounts.mint.key();
    sensor_pool.vault = ctx.accounts.pool_vault.key();
    sensor_pool.reward_per_token = 0;
    sensor_pool.total_distributed = 0;
    sensor_pool.active_sensors = 0;
    sensor_pool.total_supply = 0;
    sensor_pool.max_supply = max_supply;
    sensor_pool.bump = ctx.bumps.sensor_pool;

    msg!(
        "pool_initialised: admin={}, max_supply={}",
        ctx.accounts.admin.key(),
        max_supply
    );

    Ok(())
}

