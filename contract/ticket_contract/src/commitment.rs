/// Commitment Scheme Implementation
/// Implements commit-reveal pattern for additional fairness verification
/// Ensures that lottery random numbers cannot be manipulated after participation

use soroban_sdk::{contracttype, Address, Bytes, Env, Vec};

/// Hash commitment for commit-reveal scheme
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Commitment {
    /// Hash of (randomness_seed || nonce)
    pub hash: Bytes,
    /// Timestamp when commitment was made
    pub committed_at: u64,
    /// Revealed randomness (empty until reveal phase)
    pub revealed: bool,
    /// Committer's address
    pub committer: Address,
}

/// Reveal data matching a commitment
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Reveal {
    /// The original randomness seed
    pub seed: Bytes,
    /// Nonce used in commitment
    pub nonce: u32,
    /// Timestamp of reveal
    pub revealed_at: u64,
}

/// Commitment scheme for ensuring fairness and preventing manipulation
pub struct CommitmentScheme;

impl CommitmentScheme {
    /// Create a commitment for randomness generation
    pub fn commit(e: &Env, seed: Bytes, nonce: u32, committer: Address) -> (Bytes, Commitment) {
        // Combine seed and nonce for commitment
        let mut combined = Vec::new(e);
        combined
            .extend_from_array(&seed.to_array::<32>().unwrap_or([0u8; 32]))
            .unwrap();
        combined.extend_from_array(&nonce.to_le_bytes()).unwrap();

        // Hash the combination to create commitment
        let commitment_hash = soroban_sdk::crypto::sha256(&combined);

        let commitment = Commitment {
            hash: commitment_hash.clone(),
            committed_at: e.ledger().timestamp(),
            revealed: false,
            committer,
        };

        (commitment_hash, commitment)
    }

    /// Verify a reveal matches the commitment
    pub fn verify_reveal(
        e: &Env,
        commitment_hash: &Bytes,
        reveal: &Reveal,
    ) -> bool {
        // Reconstruct the commitment hash from reveal data
        let mut combined = Vec::new(e);
        combined
            .extend_from_array(&reveal.seed.to_array::<32>().unwrap_or([0u8; 32]))
            .unwrap();
        combined
            .extend_from_array(&reveal.nonce.to_le_bytes())
            .unwrap();

        let reconstructed_hash = soroban_sdk::crypto::sha256(&combined);
        reconstructed_hash == *commitment_hash
    }

    /// Mark commitment as revealed
    pub fn mark_revealed(e: &Env, commitment: &mut Commitment) {
        commitment.revealed = true;
    }

    /// Check if reveal is within acceptable time window (prevents premature reveals)
    pub fn is_reveal_timely(reveal: &Reveal, minimum_reveal_time: u64, maximum_reveal_time: u64) -> bool {
        reveal.revealed_at >= minimum_reveal_time && reveal.revealed_at <= maximum_reveal_time
    }

    /// Batch verify multiple reveals
    pub fn batch_verify_reveals(
        e: &Env,
        commitments: &Vec<Bytes>,
        reveals: &Vec<Reveal>,
    ) -> bool {
        if commitments.len() != reveals.len() {
            return false;
        }

        for i in 0..commitments.len() {
            let reveal = &reveals.get(i).unwrap();
            if !Self::verify_reveal(e, &commitments.get(i).unwrap(), &reveal) {
                return false;
            }
        }

        true
    }

    /// Hash multiple seed commitments together for batch fairness
    pub fn batch_commitment_hash(e: &Env, seeds: &Vec<Bytes>) -> Bytes {
        let mut combined = Vec::new(e);

        for seed in seeds {
            combined
                .extend_from_array(&seed.to_array::<32>().unwrap_or([0u8; 32]))
                .unwrap();
        }

        soroban_sdk::crypto::sha256(&combined)
    }

    /// Generate recursive commitment chains for enhanced security
    pub fn commit_with_chain(
        e: &Env,
        seed: Bytes,
        nonce: u32,
        previous_hash: Option<Bytes>,
        committer: Address,
    ) -> Bytes {
        let mut combined = Vec::new(e);
        combined
            .extend_from_array(&seed.to_array::<32>().unwrap_or([0u8; 32]))
            .unwrap();
        combined.extend_from_array(&nonce.to_le_bytes()).unwrap();

        // If there's a previous hash, chain it
        if let Some(prev) = previous_hash {
            combined
                .extend_from_array(&prev.to_array::<32>().unwrap_or([0u8; 32]))
                .unwrap();
        }

        let mut committer_bytes = Vec::new(e);
        committer_bytes.push_back(0b0u8).unwrap(); // Placeholder for commitment chain depth
        
        soroban_sdk::crypto::sha256(&combined)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_commitment_reveal_cycle() {
        let e = Env::new();
        let committer = Address::random(&e);
        let seed = e.crypto().sha256(&Bytes::new(&e));
        
        // Commit
        let (commitment_hash, commitment) = CommitmentScheme::commit(&e, seed.clone(), 0, committer.clone());
        assert!(commitment_hash.len() == 32);
        assert!(!commitment.revealed);

        // Create reveal
        let reveal = Reveal {
            seed: seed.clone(),
            nonce: 0,
            revealed_at: e.ledger().timestamp(),
        };

        // Verify reveal matches commitment
        assert!(CommitmentScheme::verify_reveal(&e, &commitment_hash, &reveal));
    }
}
