//! LiteSVM flow tests — full happy-path + expiry refund + hook settlement.
//!
//! These tests use `litesvm` to run multi-instruction sequences in-process
//! (no validator needed) and verify end-to-end state transitions.
//!
//! **Status: deferred — `litesvm` ≥0.5 targets Solana 2.2.x which conflicts with
//! `anchor-lang 0.32.x` (Solana 2.1.x).  Re-enable once a 2.1.x-compatible
//! version ships, or when the workspace upgrades to Anchor 0.33.x / Solana 2.2.x.**
//!
//! To run:
//!   cargo test --test flow_tests -- --include-ignored


// ---------------------------------------------------------------------------
// Placeholder: LiteSVM flow tests
// ---------------------------------------------------------------------------
// Full LiteSVM tests require a built .so binary and Token-2022 program loaded.
// These stubs document the test intent and will be filled in once the anchor
// build is verified to succeed.
// ---------------------------------------------------------------------------

/// Verify: init → register → pay → consume → claim
#[test]
#[ignore = "requires built .so: run `NO_DNA=1 anchor build` first"]
fn test_full_query_lifecycle() {
    // TODO: implement after anchor build passes
    //
    // Steps:
    //   1. litesvm.add_program_from_file(program_id, "target/deploy/sol_sensor.so")
    //   2. litesvm.add_program(Token2022::id(), token_2022_bytes)
    //   3. admin calls initialize_pool(max_supply=10_000_000)
    //   4. hw_owner calls register_sensor(model_id=3) → gets 50 tokens
    //   5. hw_owner calls init_contributor()
    //   6. client calls pay_for_query(nonce, amount=50_000)
    //      → verify hw_owner receives 10_000 USDC-units
    //      → verify pool_vault receives 40_000 USDC-units
    //      → verify receipt PDA exists
    //   7. api_cosigner calls consume_receipt(nonce)
    //      → verify receipt PDA is closed
    //      → verify client's rent is refunded
    //   8. hw_owner calls claim_rewards()
    //      → verify hw_owner USDC increases by ~40_000 * 50 / 10_000_000 ... scaled
}

/// Verify: pay → warp clock past RECEIPT_EXPIRY_SLOTS → refund returns 80%
#[test]
#[ignore = "requires built .so: run `NO_DNA=1 anchor build` first"]
fn test_receipt_expiry_refund() {
    // TODO: implement after anchor build passes
    //
    // Steps:
    //   1. Setup pool + sensor as above
    //   2. client pays for query (nonce, 50_000)
    //   3. litesvm.warp_to_slot(current_slot + RECEIPT_EXPIRY_SLOTS + 1)
    //   4. client calls refund_expired_receipt(nonce)
    //      → verify pool_vault is debited 40_000 USDC-units
    //      → verify client receives 40_000 USDC-units (80% back)
    //      → verify receipt PDA is closed
    //      → verify hw_owner's 10_000 is untouched (they keep 20%)
}

/// Verify: token transfer triggers hook → both contributors have correct pending
#[test]
#[ignore = "requires built .so: run `NO_DNA=1 anchor build` first"]
fn test_transfer_hook_settles_rewards() {
    // TODO: implement after anchor build passes
    //
    // Steps:
    //   1. Setup pool + 2 sensors registered (holder_a: 50 tokens, holder_b: 0)
    //   2. Both call init_contributor()
    //   3. 3 × pay_for_query → pool_vault accumulates revenue
    //   4. Token transfer: holder_a sends 25 tokens to holder_b
    //      → transfer_hook fires automatically (Token-2022)
    //      → verify holder_a's ContributorState.rewards_owed > 0
    //         (settled at pre-transfer balance of 50)
    //      → verify holder_b's reward_per_token_paid == current rpt
    //         (indexed at current, no retroactive rewards)
    //   5. Both claim: verify holder_a > holder_b (fair distribution)
}

/// Verify: register sensors until supply cap → last registration fails
#[test]
#[ignore = "requires built .so: run `NO_DNA=1 anchor build` first"]
fn test_supply_cap_enforcement() {
    // TODO: implement after anchor build passes
    //
    // Steps:
    //   1. initialize_pool(max_supply = 100)  ← small cap for test speed
    //   2. Register mock sensors (50 tokens each) until cap hit
    //   3. Third registration should fail with SolSensorError::SupplyCapExceeded
}
