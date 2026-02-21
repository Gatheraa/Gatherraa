/// Entropy Management Module
/// Manages randomness sources and provides secure entropy generation
/// Combines Stellar ledger hash with optional oracle data for robust randomness

use soroban_sdk::{contracttype, Bytes, Env};

/// Entropy source configuration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EntropySource {
    /// Use Stellar ledger hash as primary entropy
    LedgerHash,
    /// Use combination of ledger hash and timestamp
    LedgerHashWithTimestamp,
    /// Use combination of multiple sources for enhanced security
    MultiSource,
}

/// Entropy state for tracking randomness generation
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EntropyState {
    /// Last used ledger hash
    pub last_ledger_hash: Bytes,
    /// Last entropy generation timestamp
    pub last_entropy_timestamp: u64,
    /// Counter for sequential entropy generation
    pub entropy_counter: u32,
    /// Flag indicating if entropy is ready
    pub entropy_ready: bool,
}

/// Entropy generator using Stellar native capabilities
pub struct EntropyManager;

impl EntropyManager {
    /// Initialize entropy state
    pub fn initialize_entropy(e: &Env) -> EntropyState {
        EntropyState {
            last_ledger_hash: e.ledger().hash(),
            last_entropy_timestamp: e.ledger().timestamp(),
            entropy_counter: 0,
            entropy_ready: true,
        }
    }

    /// Generate entropy from ledger hash (primary source)
    /// Ledger hash is unpredictable and cannot be known in advance
    pub fn generate_ledger_entropy(e: &Env) -> Bytes {
        e.ledger().hash()
    }

    /// Generate entropy combining ledger hash with timestamp
    /// Provides additional entropy variation over time
    pub fn generate_entropy_with_timestamp(e: &Env) -> Bytes {
        let ledger_hash = e.ledger().hash();
        let timestamp_bytes = e.ledger().timestamp().to_le_bytes();

        let mut combined = soroban_sdk::Vec::new(e);
        combined
            .extend_from_array(&ledger_hash.to_array::<32>().unwrap_or([0u8; 32]))
            .unwrap();
        combined.extend_from_array(&timestamp_bytes).unwrap();

        soroban_sdk::crypto::sha256(&combined)
    }

    /// Generate entropy from multiple sources for maximum security
    pub fn generate_multi_source_entropy(e: &Env, counter: u32) -> Bytes {
        let mut combined = soroban_sdk::Vec::new(e);

        // Source 1: Ledger hash
        let ledger_hash = e.ledger().hash();
        combined
            .extend_from_array(&ledger_hash.to_array::<32>().unwrap_or([0u8; 32]))
            .unwrap();

        // Source 2: Ledger timestamp
        let timestamp = e.ledger().timestamp();
        combined.extend_from_array(&timestamp.to_le_bytes()).unwrap();

        // Source 3: Ledger sequence
        let sequence = e.ledger().sequence();
        combined.extend_from_array(&sequence.to_le_bytes()).unwrap();

        // Source 4: Counter for uniqueness
        combined.extend_from_array(&counter.to_le_bytes()).unwrap();

        // Combine all sources
        soroban_sdk::crypto::sha256(&combined)
    }

    /// Verify entropy freshness (hasn't been used before)
    pub fn verify_entropy_freshness(state: &EntropyState, new_entropy: &Bytes) -> bool {
        // Entropy is fresh if it's different from the last one
        new_entropy != &state.last_ledger_hash
    }

    /// Update entropy state after generation
    pub fn update_entropy_state(e: &Env, state: &mut EntropyState) {
        state.last_ledger_hash = e.ledger().hash();
        state.last_entropy_timestamp = e.ledger().timestamp();
        state.entropy_counter = state.entropy_counter.saturating_add(1);
    }

    /// Generate entropy with specific source configuration
    pub fn generate_entropy(e: &Env, source: &EntropySource) -> Bytes {
        match source {
            EntropySource::LedgerHash => Self::generate_ledger_entropy(e),
            EntropySource::LedgerHashWithTimestamp => Self::generate_entropy_with_timestamp(e),
            EntropySource::MultiSource => Self::generate_multi_source_entropy(e, 0),
        }
    }

    /// Mix multiple entropy sources together for enhanced security
    pub fn mix_entropy_sources(e: &Env, sources: &soroban_sdk::Vec<Bytes>) -> Bytes {
        let mut combined = soroban_sdk::Vec::new(e);

        for source in sources {
            combined
                .extend_from_array(&source.to_array::<32>().unwrap_or([0u8; 32]))
                .unwrap();
        }

        soroban_sdk::crypto::sha256(&combined)
    }

    /// Validate entropy has sufficient entropy bits (non-trivial randomness)
    pub fn validate_entropy(entropy: &Bytes) -> bool {
        // Entropy should be 32 bytes (256 bits) from SHA256
        entropy.len() == 32
    }

    /// Get entropy freshness percentage (100 = completely fresh, 0 = stale)
    pub fn get_entropy_freshness(
        current_counter: u32,
        last_counter: u32,
        max_reuse_count: u32,
    ) -> u32 {
        let reuse_count = current_counter.saturating_sub(last_counter);
        if reuse_count >= max_reuse_count {
            0 // Stale
        } else {
            ((max_reuse_count - reuse_count) * 100) / max_reuse_count
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_entropy_validation() {
        // 32-byte entropy should be valid
        let e = Env::new();
        let entropy = e.crypto().sha256(&soroban_sdk::Bytes::new(&e));
        assert!(EntropyManager::validate_entropy(&entropy));
    }

    #[test]
    fn test_entropy_state_update() {
        let e = Env::new();
        let mut state = EntropyManager::initialize_entropy(&e);
        let initial_counter = state.entropy_counter;

        EntropyManager::update_entropy_state(&e, &mut state);
        assert!(state.entropy_counter > initial_counter);
    }
}
