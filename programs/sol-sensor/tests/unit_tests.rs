//! Unit tests for ContributorState::pending_rewards() — the core reward math.

#[cfg(test)]
mod tests {
    use sol_sensor::state::{ContributorState, SensorPool};
    use sol_sensor::state::sensor_pool::PRECISION_FACTOR;

    fn mk_contributor(reward_per_token_paid: u128, rewards_owed: u64) -> ContributorState {
        ContributorState {
            holder: Default::default(),
            reward_per_token_paid,
            rewards_owed,
            bump: 255,
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // pending_rewards() correctness
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn pending_zero_when_rpt_unchanged() {
        let contributor = mk_contributor(1_000, 0);
        let pending = contributor
            .pending_rewards(100, 1_000)
            .expect("should not fail");
        assert_eq!(pending, 0, "no new rewards when rpt hasn't moved");
    }

    #[test]
    fn pending_proportional_to_balance() {
        // reward_per_token increased by PRECISION_FACTOR per token
        // so holder with 100 tokens should receive 100 USDC-units
        let rpt_start: u128 = 0;
        let rpt_current: u128 = PRECISION_FACTOR; // 1 USDC-unit per token (scaled)
        let contributor = mk_contributor(rpt_start, 0);

        let pending_100 = contributor.pending_rewards(100, rpt_current).unwrap();
        assert_eq!(pending_100, 100);

        let pending_1000 = contributor.pending_rewards(1_000, rpt_current).unwrap();
        assert_eq!(pending_1000, 1_000);
    }

    #[test]
    fn precision_prevents_truncation_on_micro_payment() {
        // 40,000 USDC-units distributed across 1,000,000 tokens
        // Without precision scaling: 40_000 / 1_000_000 = 0 (truncated)
        // With PRECISION_FACTOR:     40_000 * 10^12 / 1_000_000 = 40_000_000_000
        let total_supply: u64 = 1_000_000;
        let pool_share: u64 = 40_000;
        let increment = (pool_share as u128)
            .checked_mul(PRECISION_FACTOR)
            .unwrap()
            .checked_div(total_supply as u128)
            .unwrap();

        let contributor = mk_contributor(0, 0);
        // Holder with 1 token should receive 40_000 / 1_000_000 ≈ 0.04 USDC-units
        // which rounds to 0 — but the accumulator preserves this for future queries.
        let pending = contributor.pending_rewards(1, increment).unwrap();
        // 1 token * 40_000_000_000 / 10^12 = 0 (expected, correct truncation at tiny scale)
        assert_eq!(pending, 0);

        // Holder with 25 tokens: 25 * 40_000_000_000 / 10^12 = 1 USDC-unit
        let pending_25 = contributor.pending_rewards(25, increment).unwrap();
        assert_eq!(pending_25, 1);

        // Holder with 1_000 tokens: 1000 * 40_000_000_000 / 10^12 = 40 USDC-units
        let pending_1000 = contributor.pending_rewards(1_000, increment).unwrap();
        assert_eq!(pending_1000, 40);
    }

    #[test]
    fn pending_zero_balance_earns_nothing() {
        let contributor = mk_contributor(0, 0);
        let pending = contributor.pending_rewards(0, PRECISION_FACTOR * 1000).unwrap();
        assert_eq!(pending, 0);
    }

    #[test]
    fn rewards_owed_accumulates_from_multiple_syncs() {
        // Simulates two successive syncs (as transfer_hook does)
        let mut contributor = mk_contributor(0, 0);
        let rpt_after_query_1: u128 = PRECISION_FACTOR * 10; // 10 USDC-units per token

        // Sync 1: balance=100 tokens, earns 1000 USDC-units
        let pending1 = contributor.pending_rewards(100, rpt_after_query_1).unwrap();
        assert_eq!(pending1, 1_000);
        contributor.rewards_owed += pending1;
        contributor.reward_per_token_paid = rpt_after_query_1;

        // Sync 2: same balance, same rpt → no new rewards
        let pending2 = contributor.pending_rewards(100, rpt_after_query_1).unwrap();
        assert_eq!(pending2, 0);

        // Sync 3: rpt moves up by another 5 → 500 more
        let rpt_after_query_2 = rpt_after_query_1 + PRECISION_FACTOR * 5;
        let pending3 = contributor.pending_rewards(100, rpt_after_query_2).unwrap();
        assert_eq!(pending3, 500);
        contributor.rewards_owed += pending3;
        contributor.reward_per_token_paid = rpt_after_query_2;

        assert_eq!(contributor.rewards_owed, 1_500);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // QueryReceipt validity helpers
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn receipt_state_machine() {
        use sol_sensor::state::QueryReceipt;

        let receipt = QueryReceipt {
            sensor_id: Default::default(),
            payer: Default::default(),
            amount: 50_000,
            consumed: false,
            created_at: 0,
            expiry_slot: 100,
            bump: 255,
        };

        // Before expiry: valid, not expired.
        assert!(receipt.is_valid(0));
        assert!(receipt.is_valid(100));
        assert!(!receipt.is_expired(100));

        // After expiry: not valid, expired.
        assert!(!receipt.is_valid(101));
        assert!(receipt.is_expired(101));

        // Consumed: neither valid nor refundable.
        let consumed = QueryReceipt { consumed: true, ..receipt };
        assert!(!consumed.is_valid(50));
        assert!(!consumed.is_expired(200));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HardwareEntry model lookup
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn model_info_known_models() {
        use sol_sensor::state::HardwareEntry;

        let (fee, tokens) = HardwareEntry::model_info(1).expect("model 1 should exist");
        assert_eq!(fee, 150_000_000);
        assert_eq!(tokens, 1_500);

        let (fee, tokens) = HardwareEntry::model_info(2).expect("model 2 should exist");
        assert_eq!(fee, 80_000_000);
        assert_eq!(tokens, 800);

        let (fee, tokens) = HardwareEntry::model_info(3).expect("model 3 should exist");
        assert_eq!(fee, 5_000_000);
        assert_eq!(tokens, 50);
    }

    #[test]
    fn model_info_unknown_returns_none() {
        use sol_sensor::state::HardwareEntry;
        assert!(HardwareEntry::model_info(0).is_none());
        assert!(HardwareEntry::model_info(99).is_none());
        assert!(HardwareEntry::model_info(255).is_none());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants sanity
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn constants_are_sane() {
        use sol_sensor::state::sensor_pool::{
            MAX_POOL_SUPPLY, PRECISION_FACTOR, SPLIT_HARDWARE_BPS, SPLIT_POOL_BPS,
        };
        use sol_sensor::state::query_receipt::RECEIPT_EXPIRY_SLOTS;

        // Revenue split must add up to 100 %.
        assert_eq!(SPLIT_HARDWARE_BPS + SPLIT_POOL_BPS, 10_000);
        assert!(MAX_POOL_SUPPLY > 0);
        assert!(PRECISION_FACTOR > 0);
        assert!(RECEIPT_EXPIRY_SLOTS > 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Supply cap enforcement simulation
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn supply_cap_math() {
        use sol_sensor::state::sensor_pool::MAX_POOL_SUPPLY;
        use sol_sensor::state::HardwareEntry;

        // Mock a pool near the cap.
        let current_supply: u64 = MAX_POOL_SUPPLY - 10;
        let (_, tokens_model_1) = HardwareEntry::model_info(1).unwrap(); // 1500 tokens

        // Adding model_1 sensor would exceed the cap.
        assert!(
            current_supply
                .checked_add(tokens_model_1)
                .map(|sum| sum > MAX_POOL_SUPPLY)
                .unwrap_or(true),
            "should detect supply cap violation"
        );

        // Adding mock sensor (50 tokens) would also exceed.
        let (_, tokens_mock) = HardwareEntry::model_info(3).unwrap(); // 50 tokens
        assert!(
            current_supply
                .checked_add(tokens_mock)
                .map(|sum| sum > MAX_POOL_SUPPLY)
                .unwrap_or(true),
            "even 50 tokens exceeds cap when near limit"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Revenue split math
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn revenue_split_is_exact_for_clean_amounts() {
        use sol_sensor::state::sensor_pool::{SPLIT_HARDWARE_BPS, SPLIT_POOL_BPS};

        let amount: u64 = 50_000; // 0.05 USDC
        let hw_share = amount * SPLIT_HARDWARE_BPS as u64 / 10_000;
        let pool_share = amount * SPLIT_POOL_BPS as u64 / 10_000;

        assert_eq!(hw_share, 10_000);  // 20% of 50,000
        assert_eq!(pool_share, 40_000); // 80% of 50,000
        assert_eq!(hw_share + pool_share, amount, "split must be lossless for clean amounts");
    }

    #[test]
    fn revenue_split_handles_rounding() {
        use sol_sensor::state::sensor_pool::{SPLIT_HARDWARE_BPS, SPLIT_POOL_BPS};

        // 3 USDC-units does not divide cleanly into 20/80
        let amount: u64 = 3;
        let hw_share = amount * SPLIT_HARDWARE_BPS as u64 / 10_000;
        let pool_share = amount * SPLIT_POOL_BPS as u64 / 10_000;

        // Integer division truncates — 3 * 2000 / 10000 = 0, 3 * 8000 / 10000 = 2
        assert_eq!(hw_share, 0);
        assert_eq!(pool_share, 2);
        // Total is 2, not 3 — 1 USDC-unit is lost to rounding (expected, acceptable at this scale)
        assert!(hw_share + pool_share <= amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Account sizing
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn account_sizes_are_correct() {
        use sol_sensor::state::{
            ContributorState, GlobalState, HardwareEntry, QueryReceipt, SensorPool,
        };

        // Discriminator (8) + fields
        assert_eq!(GlobalState::LEN, 8 + 32 + 32 + 4 + 8 + 1);       // 85
        assert_eq!(SensorPool::LEN, 8 + 32 + 32 + 16 + 8 + 4 + 8 + 8 + 1); // 117
        assert_eq!(HardwareEntry::LEN, 8 + 32 + 32 + 1 + 1 + 8 + 8 + 1);   // 91
        assert_eq!(ContributorState::LEN, 8 + 32 + 16 + 8 + 1);              // 65
        assert_eq!(QueryReceipt::LEN, 8 + 32 + 32 + 8 + 1 + 8 + 8 + 1);     // 98
    }
}
