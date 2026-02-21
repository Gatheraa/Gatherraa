<!-- VRF LOTTERY TICKET ALLOCATION SYSTEM -->
<!-- Comprehensive Documentation for Fair Ticket Distribution -->

# VRF Lottery Ticket Allocation System

## Overview

The VRF (Verifiable Random Function) Lottery Ticket Allocation System implements cryptographically secure, transparent, and verifiable random ticket allocation for high-demand events on the Stellar blockchain using Soroban smart contracts.

### Key Features

- **Cryptographic Randomness**: Uses Stellar's ledger hash as unpredictable entropy source
- **Verifiable Proofs**: All randomness can be independently verified
- **Multiple Strategies**: FCFS, Lottery, Whitelist, Hybrid, Time-Weighted allocation
- **Commit-Reveal Scheme**: Prevents manipulation and ensures enforced fairness
- **Anti-Sniping Protection**: Rate limiting and time-lock mechanisms
- **Transparency**: All lottery results are publicly verifiable
- **Batch Processing**: Support for high-volume allocations

## Architecture

### Module Structure

```
ticket_contract/
├── src/
│   ├── lib.rs              # Main contract implementation
│   ├── storage_types.rs    # Storage structures and enums
│   ├── vrf.rs              # Core VRF engine
│   ├── commitment.rs       # Commit-reveal scheme
│   ├── allocation.rs       # Allocation strategies
│   ├── entropy.rs          # Entropy management
│   ├── oracle.rs           # Oracle integration (existing)
│   └── test.rs             # Comprehensive test suite
```

### Key Components

#### 1. **VRF Engine** (`vrf.rs`)

Core cryptographic randomness generation using Soroban's SHA256 primitives.

**Functions:**
- `generate_vrf_randomness()`: Generates deterministic but unpredictable randomness
- `generate_batch_randomness()`: Creates multiple independent random values
- `verify_vrf_proof()`: Validates randomness proofs
- `compute_selection_index()`: Converts randomness to allocation index
- `is_in_anti_sniping_window()`: Checks time-lock validity
- `can_finalize_randomness()`: Verifies finalization readiness

**Technical Details:**
```rust
// Implementation uses:
// 1. Stellar's ledger hash (unpredictable)
// 2. SHA256 hashing for determinism
// 3. Ledger sequence for temporal uniqueness
// 4. Nonce for batch differentiation

Input: (participant_seed || ledger_hash || sequence || nonce)
Output: SHA256(combined_input) → 32-byte random value
Proof: VRFProof { output, proof_bytes, ledger_sequence, input_hash }
```

#### 2. **Commitment Scheme** (`commitment.rs`)

Implements commit-reveal pattern for additional security.

**Process:**
1. **Commit Phase**: Hash(seed || nonce) → commitment_hash
2. **Reveal Phase**: Participant submits (seed, nonce)
3. **Verification**: Recompute hash and compare

**Benefits:**
- Prevents observation of randomness before participation
- Ensures participant cannot change their entry after seeing others
- Enables batch verification
- Supports commitment chains for enhanced security

#### 3. **Allocation Engine** (`allocation.rs`)

Implements multiple fair allocation strategies.

**Supported Strategies:**

| Strategy | Mechanism | Best For |
|----------|-----------|----------|
| **FCFS** | First-Come-First-Served | Fair baseline, simple |
| **Lottery** | Pure random selection | Maximum fairness |
| **Whitelist** | Priority allocation | VIP access |
| **Hybrid** | Whitelist + Lottery | Balanced approach |
| **TimeWeighted** | Earlier entries prioritized | Reward early registration |

**Anti-Sniping Features:**
- `max_entries_per_address`: Limit entries per participant
- `minimum_lock_period`: Minimum ledgers before finalization
- `rate_limit_window`: Time window for counting entries
- `randomization_delay_ledgers`: Prevent observable patterns

#### 4. **Entropy Management** (`entropy.rs`)

Manages entropy sources for robust randomness.

**Entropy Sources:**
- **LedgerHash**: Primary source (unpredictable, cannot be known in advance)
- **LedgerHashWithTimestamp**: Combined with current timestamp
- **MultiSource**: Combines ledger hash, timestamp, sequence, counter

**Entropy Properties:**
- 32 bytes (256 bits) from SHA256
- Unique per ledger
- Cannot be predicted
- Public and verifiable

## Smart Contract Integration

### Initialization

```rust
pub fn initialize_lottery(
    e: &Env,
    tier_symbol: Symbol,
    strategy_type: AllocationStrategyType,
    total_allocations: u32,
    finalization_ledger: u32,
    reveal_start_ledger: u32,
    reveal_end_ledger: u32,
) -> AllocationConfig
```

**Parameters:**
- `tier_symbol`: NFT tier identifier
- `strategy_type`: Allocation strategy (FCFS, Lottery, etc.)
- `total_allocations`: Number of tickets to allocate
- `finalization_ledger`: When randomness becomes final
- `reveal_start_ledger`: When commit-reveal begins
- `reveal_end_ledger`: Deadline for reveals

### Participation

```rust
pub fn register_lottery_entry(
    e: &Env,
    tier_symbol: Symbol,
    commitment_hash: Option<Bytes>,
) -> LotteryEntry
```

**Process:**
1. Participant calls `register_lottery_entry()`
2. Entry is timestamped and stored
3. Anti-sniping checks applied
4. Optional: Commitment hash provided for commit-reveal scheme

### Randomness Generation

```rust
pub fn generate_lottery_randomness(
    e: &Env,
    tier_symbol: Symbol,
    batch_size: u32,
) -> Vec<RandomnessOutput>
```

**Conditions:**
- Must be called after `finalization_ledger`
- Generates independent random values
- Each output includes verifiable proof
- Results stored for transparency

### Allocation Execution

```rust
pub fn execute_lottery_allocation(
    e: &Env,
    tier_symbol: Symbol,
    randomness_values: Vec<u128>,
) -> Vec<AllocationResult>
```

**Logic:**
1. Load registered entries
2. Apply selected strategy
3. Generate winners list
4. Store results on-chain
5. Return allocation results

### Verification & Transparency

```rust
pub fn verify_lottery_randomness(
    e: &Env,
    proof: &VRFProof,
    original_input: Bytes,
    expected_ledger: u32,
) -> bool

pub fn get_lottery_winners(
    e: &Env,
    tier_symbol: Symbol,
) -> Vec<AllocationResult>

pub fn get_allocation_fairness(
    e: &Env,
    tier_symbol: Symbol,
) -> u32  // Fairness score 0-100
```

## Security Analysis

### Threats & Mitigations

| Threat | Impact | Mitigation |
|--------|--------|-----------|
| **Sybil Attack** | Multiple entries per user | Rate limiting, account-based limits |
| **Randomness Prediction** | Predict winners before finalization | Ledger hash entropy, commit-reveal |
| **Randomness Manipulation** | Influence selection | Ledger hash is immutable, admin-less |
| **Premature Observation** | See randomness before participation | Finalization ledger lock |
| **Account Takeover** | Steal allocation | Soulbound tickets, no transfer |
| **Oracle Manipulation** | Influence pricing | Multiple oracle sources, fallback |

### Cryptographic Properties

**Unpredictability:**
- Stellar's ledger hash cannot be known in advance
- Even validators cannot predict next 10 blocks' hashes
- Requires 51% network consensus to manipulate

**Determinism:**
- Same input always produces same output
- SHA256 provides collision resistance
- Fully reproducible for verification

**Independence:**
- Different nonces produce different outputs
- Batch randomness is uncorrelated
- Suitable for lottery selection

## Testing

### Test Coverage

The comprehensive test suite in `test.rs` includes:

**VRF Engine Tests:**
- Randomness generation correctness
- Batch randomness independence
- Proof verification
- Selection index bounds checking
- Anti-sniping window validation

**Commitment Tests:**
- Commitment creation and storage
- Reveal verification
- Invalid input rejection
- Batch verification

**Entropy Tests:**
- Entropy source functionality
- Validation of entropy length
- State updates and freshness

**Allocation Strategy Tests:**
- FCFS correctness
- Lottery selection fairness
- Time-weighted prioritization
- Anti-sniping enforcement

**Integration Tests:**
- Full lottery cycle (entry → randomness → allocation)
- Commit-reveal-allocation pipeline
- Cross-module interactions

### Running Tests

```bash
# Run all tests
cd contract/ticket_contract
cargo test --lib test 2>&1

# Run specific test
cargo test test_vrf_randomness_generation -- --nocapture

# Run with output
cargo test -- --nocapture
```

### Test Ledger Simulation

Tests use Soroban SDK's test environment:
```rust
let e = Env::default();
e.mock_all_auths();  // Mock auth for simpler testing
```

## Resource Cost Analysis

### Storage Cost

| Operation | Bytes | Cost (stroops) |
|-----------|-------|---|
| VRFState | ~80 | ~40 |
| AllocationConfig | ~100 | ~50 |
| LotteryEntry | ~70 | ~35 |
| AllocationResult | ~60 | ~30 |
| VRFProof | ~100 | ~50 |
| Commitment | ~120 | ~60 |

**Example: 1000 entries + batch randomness**
- Entry storage: 1000 × 70 bytes = 70 KB
- Randomness proofs: 1000 × 100 bytes = 100 KB
- Allocation results: 1000 × 60 bytes = 60 KB
- **Total: ~230 KB ≈ 115,000 stroops**

### Computation Cost

| Operation | Invocations | Cost (stroops) |
|-----------|- |---|
| SHA256 hash | Per entry | ~100-200 |
| Allocation | Once | ~500-1000 |
| Verification | Varies | ~200-500 |

**Full Cycle (1000 entries):**
- Entry registration: 1000 × 100 = 100,000 stroops
- Randomness generation: 1000 × 150 = 150,000 stroops
- Allocation: 1 × 1000 = 1,000 stroops
- **Total: ~251,000 stroops**

### Network Cost

- **Finality**: ~400 ledgers (≈30 minutes) for security
- **Ledger fee**: Base fee × operations
- **Peak time adjustment**: Fee may increase during congestion

## Usage Examples

### Basic Lottery Allocation

```rust
// 1. Set up lottery for tier
contract.initialize_lottery(
    tier,
    AllocationStrategyType::Lottery,
    100,  // Allocate 100 tickets
    ledger_future + 200,  // Finalize in 200 ledgers
    ledger_future + 100,  // Reveals start
    ledger_future + 150,  // Reveals end
);

// 2. Users register
for user in participants {
    contract.register_lottery_entry(tier, None);
}

// 3. After finalization ledger reached
randomness = contract.generate_lottery_randomness(tier, 100);

// 4. Execute allocation
winners = contract.execute_lottery_allocation(tier, randomness);

// 5. Verify results
fairness = contract.get_allocation_fairness(tier);
```

### VIP + Lottery Hybrid

```rust
// 1. Initialize hybrid strategy
contract.initialize_lottery(
    tier,
    AllocationStrategyType::HybridWhitelistLottery,
    100,
    ...
);

// 2. Whitelist VIPs (handled separately)
// 3. Regular participants register
// 4. Allocation: VIPs get first 20, remaining 80 via lottery
```

### Time-Weighted Priority

```rust
// 1. Initialize time-weighted strategy
contract.initialize_lottery(
    tier,
    AllocationStrategyType::TimeWeighted,
    50,
    ...
);

// 2. Users register (timestamps recorded)
// 3. Earlier registrants get higher selection weight
// Results favor early participants
```

## Verification & Transparency

### Verifying a Winner

```rust
// 1. Get lottery results
winners = contract.get_lottery_winners(tier);

// 2. For each winner, verify via VRF proof
winner = winners[0];
proof = winner.proof;  // From RandomnessOutput

// 3. Verify proof validity
is_valid = contract.verify_lottery_randomness(
    proof,
    original_seed,
    expected_ledger
);

assert!(is_valid);  // Winner is legitimate
```

### Computing Fairness

```rust
// Get fairness score (0-100)
score = contract.get_allocation_fairness(tier);

// Score interpretation:
// 90-100: Excellent fairness (uniform distribution)
// 70-89: Good fairness (minor variations)
// 50-69: Moderate fairness (acceptable)
// <50: Poor fairness (rerun recommended)
```

## Deployment Instructions

### Prerequisites

```bash
# Install Soroban CLI
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
rustup update
rustup target add wasm32-unknown-unknown
cargo install soroban-cli

# Verify installation
soroban --version
```

### Build

```bash
cd contract/ticket_contract
cargo build --release --target wasm32-unknown-unknown
```

### Deploy to Futurenet

```bash
# 1. Set network
soroban config network add \
    --rpc-url https://rpc-futurenet.stellar.org:443 \
    --network-passphrase "Test SDF Future Network ; October 2024" \
    futurenet

# 2. Deploy contract
soroban contract deploy \
    --wasm target/wasm32-unknown-unknown/release/ticket_contract.wasm \
    --source my-account \
    --network futurenet

# 3. Initialize
soroban contract invoke \
    --id CONTRACT_ID \
    --source my-account \
    --network futurenet \
    -- initialize \
    --admin ADMIN_ADDRESS \
    --name "Event Tickets" \
    --symbol "TKT" \
    --uri "https://..."
```

### Testnet Considerations

**Futurenet Specifics:**
- Ledger close time: ~5 seconds
- Average fee: ~100 stroops
- Storage TTL: 520,000 ledgers (~30 days)
- Admin: Set to your key, not hardcoded

## Security Best Practices

### For Event Organizers

1. **Set appropriate finalization ledger**: Allow time for participation
2. **Monitor entries**: Check for sybil attacks
3. **Verify randomness**: Check proofs before publishing results
4. **Announce winners**: Publish with proof transparency
5. **Handle disputes**: Keep all data on-chain for audit

### For Soroban Validators

1. **No randomness prediction**: Ledger hash is consensus property
2. **Transparent execution**: All operations are auditable
3. **Anti-manipulation**: Cannot influence SHA256 output
4. **Verifiable code**: Open-source implementation

### For Participants

1. **Verify odds**: Check fairness score before entering
2. **Check finalization**: Understand when results lock
3. **Verify winner claims**: Use `verify_lottery_randomness()`
4. **Review terms**: Understand allocation strategy

## Frequently Asked Questions

### Q: Can organizers manipulate the lottery?

**A:** No. The randomness source (Stellar's ledger hash) is consensus-determined and immutable. Organizers cannot influence it.

### Q: What happens if someone enters multiple times?

**A:** Anti-sniping limits (max_entries_per_address) prevent this. Excess entries are rejected or ignored during allocation.

### Q: Can winners be changed after announcement?

**A:** No. Results are stored on-chain with cryptographic proofs. They can be publicly verified and are immutable.

### Q: How long before results are final?

**A:** After finalization_ledger + lock_period (typically 10-20 ledgers, ~1-2 minutes).

### Q: What's the fairness guarantee?

**A:** With pure lottery strategy, each entry has equal probability. Fairness score measures how close actual distribution is to theoretical expectation.

### Q: Can I run this on mainnet?

**A:** Yes, after thorough testing on Futurenet. Soroban is production-ready. Ensure adequate testing of your specific use case.

## Future Enhancements

1. **Weighted Lotteries**: Different weight curves
2. **Multi-tier Allocations**: Simultaneous tiers
3. **Dynamic Threshold**: Adapt to participation
4. **Escrow Integration**: Hold payments until allocation
5. **Oracle Randomness**: Additional entropy from oracle
6. **Recovery Mechanisms**: Handle edge cases

## References

- [Soroban Documentation](https://soroban.stellar.org/)
- [Stellar Ledger Architecture](https://developers.stellar.org/docs)
- [VRF Cryptography](https://en.wikipedia.org/wiki/Verifiable_random_function)
- [Commit-Reveal Schemes](https://en.wikipedia.org/wiki/Commit-reveal)

## Support & Issues

For issues or questions:
1. Check the test suite for examples
2. Review inline code comments
3. Verify anti-sniping configuration
4. Check storage availability
5. Validate entropy freshness

---

**Version**: 1.0.0  
**Last Updated**: February 2026  
**Status**: Production Ready for Futurenet Testing
