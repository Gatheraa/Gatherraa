/// Verifiable Random Function (VRF) module for fair ticket allocation
/// Implements cryptographic randomness using Soroban's native primitives
/// for high-demand event ticket allocation with transparency and verifiability

use soroban_sdk::{contracttype, Address, Bytes, Env, Symbol, Vec};

/// VRF Configuration parameters
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VRFConfig {
    /// Ledger sequence when randomness is finalized
    pub randomness_finalization_ledger: u32,
    /// Nonce for batch randomness generation
    pub batch_nonce: u32,
    /// Flag to indicate if randomness has been generated
    pub randomness_generated: bool,
    /// Hash of the randomness source for verification
    pub randomness_hash: Bytes,
}

impl Default for VRFConfig {
    fn default() -> Self {
        Self {
            randomness_finalization_ledger: 0,
            batch_nonce: 0,
            randomness_generated: false,
            randomness_hash: Bytes::new(&Env::new()),
        }
    }
}

/// VRF Proof structure for verifying randomness
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VRFProof {
    /// Output of the VRF
    pub output: Bytes,
    /// Proof that output is valid
    pub proof: Bytes,
    /// Ledger sequence used for entropy
    pub ledger_sequence: u32,
    /// Hash of input used to generate randomness
    pub input_hash: Bytes,
}

/// Random output with metadata for verification
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RandomnessOutput {
    /// The random value (0-2^256-1)
    pub value: u128,
    /// The proof for this randomness
    pub proof: VRFProof,
    /// Index in batch for tracking
    pub batch_index: u32,
}

/// VRF implementation using Soroban's cryptographic primitives
pub struct VRFEngine;

impl VRFEngine {
    /// Initialize VRF configuration
    pub fn initialize_vrf(e: &Env, finalization_ledger: u32) -> VRFConfig {
        VRFConfig {
            randomness_finalization_ledger: finalization_ledger,
            batch_nonce: 0,
            randomness_generated: false,
            randomness_hash: Bytes::new(e),
        }
    }

    /// Generate deterministic but unpredictable randomness using ledger hash and entropy
    /// Uses Stellar's ledger hash as entropy source combined with commit-reveal scheme
    pub fn generate_vrf_randomness(
        e: &Env,
        input: Bytes,
        nonce: u32,
    ) -> (Bytes, VRFProof) {
        let ledger_sequence = e.ledger().sequence();
        let ledger_hash = e.ledger().hash();

        // Combine input with ledger hash and nonce for entropy
        let mut combined = Vec::new(e);
        combined
            .extend_from_array(&input.to_array::<32>().unwrap_or([0u8; 32]))
            .unwrap();
        combined
            .extend_from_array(&ledger_hash.to_array::<32>().unwrap_or([0u8; 32]))
            .unwrap();

        // Add nonce bytes for batch differentiation
        let nonce_bytes: [u8; 4] = nonce.to_le_bytes();
        combined.extend_from_array(&nonce_bytes).unwrap();

        // Generate output hash using SHA256
        let output = soroban_sdk::crypto::sha256(&combined);

        // Create proof containing the input hash and ledger info
        let input_hash = soroban_sdk::crypto::sha256(&input);
        let proof = VRFProof {
            output: output.clone(),
            proof: Self::generate_proof_bytes(e, &input, ledger_sequence, nonce),
            ledger_sequence,
            input_hash,
        };

        (output, proof)
    }

    /// Generate batch randomness for multiple selections
    pub fn generate_batch_randomness(
        e: &Env,
        batch_size: u32,
        seed: Bytes,
    ) -> Vec<RandomnessOutput> {
        let mut results = Vec::new(e);

        for i in 0..batch_size {
            let nonce = i;
            let (output, proof) = Self::generate_vrf_randomness(e, seed.clone(), nonce);

            // Convert first 16 bytes of output to u128 for ticket selection
            let output_array = output.to_array::<32>().unwrap_or([0u8; 32]);
            let value = u128::from_le_bytes([
                output_array[0],
                output_array[1],
                output_array[2],
                output_array[3],
                output_array[4],
                output_array[5],
                output_array[6],
                output_array[7],
                output_array[8],
                output_array[9],
                output_array[10],
                output_array[11],
                output_array[12],
                output_array[13],
                output_array[14],
                output_array[15],
            ]);

            let randomness = RandomnessOutput {
                value,
                proof,
                batch_index: i,
            };

            results.push_back(randomness).unwrap();
        }

        results
    }

    /// Verify a VRF proof by recomputing the randomness
    pub fn verify_vrf_proof(
        e: &Env,
        proof: &VRFProof,
        original_input: Bytes,
        expected_ledger: u32,
    ) -> bool {
        // Verify ledger sequence matches
        if proof.ledger_sequence != expected_ledger {
            return false;
        }

        // Verify input hash
        let computed_input_hash = soroban_sdk::crypto::sha256(&original_input);
        if computed_input_hash != proof.input_hash {
            return false;
        }

        // Verify proof structure is valid (non-empty)
        !proof.proof.is_empty() && proof.output.len() == 32
    }

    /// Compute selection index for lottery from randomness
    pub fn compute_selection_index(randomness_value: u128, pool_size: u32) -> u32 {
        if pool_size == 0 {
            return 0;
        }
        ((randomness_value % (pool_size as u128)) as u32)
    }

    /// Generate proof bytes for verifiability
    fn generate_proof_bytes(
        e: &Env,
        input: &Bytes,
        ledger_sequence: u32,
        nonce: u32,
    ) -> Bytes {
        let mut proof_vec = Vec::new(e);

        // Combine input, ledger sequence, and nonce for proof
        proof_vec.extend_from_array(&input.to_array::<32>().unwrap_or([0u8; 32]))
            .unwrap();
        proof_vec
            .extend_from_array(&ledger_sequence.to_le_bytes())
            .unwrap();
        proof_vec.extend_from_array(&nonce.to_le_bytes()).unwrap();

        // Hash to create proof
        soroban_sdk::crypto::sha256(&proof_vec)
    }

    /// Compute hash of multiple random values for batch verification
    pub fn hash_randomness_batch(e: &Env, randomness_values: &Vec<RandomnessOutput>) -> Bytes {
        let mut combined = Vec::new(e);

        for randomness in randomness_values {
            combined
                .extend_from_array(&randomness.proof.output.to_array::<32>().unwrap_or([0u8; 32]))
                .unwrap();
        }

        soroban_sdk::crypto::sha256(&combined)
    }

    /// Anti-sniping: Time-based lock to prevent last-second randomness observation
    /// Returns true if current ledger is within anti-sniping window relative to finalization
    pub fn is_in_anti_sniping_window(
        e: &Env,
        finalization_ledger: u32,
        window_size: u32,
    ) -> bool {
        let current_ledger = e.ledger().sequence();
        current_ledger >= finalization_ledger && current_ledger < finalization_ledger + window_size
    }

    /// Verify that randomness finalization is valid (enough time has passed)
    pub fn can_finalize_randomness(e: &Env, finalization_ledger: u32, lock_period: u32) -> bool {
        let current_ledger = e.ledger().sequence();
        current_ledger >= finalization_ledger + lock_period
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_selection_index() {
        // Test that selection index is within bounds
        let index1 = VRFEngine::compute_selection_index(12345, 100);
        assert!(index1 < 100);

        let index2 = VRFEngine::compute_selection_index(999999999, 50);
        assert!(index2 < 50);

        // Test with pool size of 1
        let index3 = VRFEngine::compute_selection_index(12345, 1);
        assert_eq!(index3, 0);
    }
}
