#[cfg(test)]
mod tests {
    /// Smoke test — verifies the program compiles and basic constants are correct.
    #[test]
    fn constants_are_sane() {
        use sol_sensor::state::{
            sensor_pool::{MAX_POOL_SUPPLY, PRECISION_FACTOR, SPLIT_HARDWARE_BPS, SPLIT_POOL_BPS},
            query_receipt::RECEIPT_EXPIRY_SLOTS,
        };

        // Revenue split must add up to 100 %.
        assert_eq!(
            SPLIT_HARDWARE_BPS + SPLIT_POOL_BPS,
            10_000,
            "revenue split must sum to 10 000 bps"
        );

        // Supply cap must be positive.
        assert!(MAX_POOL_SUPPLY > 0);

        // Precision factor must be non-zero.
        assert!(PRECISION_FACTOR > 0);

        // Expiry window must be positive.
        assert!(RECEIPT_EXPIRY_SLOTS > 0);
    }

    /// Verify `HardwareEntry::model_info` returns the correct data for known models.
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

    /// Verify `HardwareEntry::model_info` returns `None` for unknown models.
    #[test]
    fn model_info_unknown_model() {
        use sol_sensor::state::HardwareEntry;

        assert!(HardwareEntry::model_info(0).is_none());
        assert!(HardwareEntry::model_info(99).is_none());
    }

    /// Verify `QueryReceipt::is_valid` and `is_expired` behave correctly.
    #[test]
    fn receipt_validity_checks() {
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

        assert!(receipt.is_valid(50));
        assert!(receipt.is_valid(100));
        assert!(!receipt.is_valid(101));
        assert!(!receipt.is_expired(100));
        assert!(receipt.is_expired(101));

        // A consumed receipt is neither valid nor expired (for refund purposes).
        let consumed = QueryReceipt {
            consumed: true,
            ..receipt
        };
        assert!(!consumed.is_valid(50));
        assert!(!consumed.is_expired(101));
    }
}
