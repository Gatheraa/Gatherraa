#![no_std]

#[cfg(test)]
mod test;

mod storage_types;
use storage_types::{DataKey, VRFRequest, VRFStatus, VRFProof, EntropyProvider, ProviderType,
                   RandomnessSeed, EntropySource, SourceType, RandomnessValidation, TestResult,
                   QualityMetrics, ProviderStats, VRFError};

use soroban_sdk::{
    contract, contractimpl, symbol_short, vec, map, Address, BytesN, Env, IntoVal, String, Symbol, Vec, Map, U256,
};

#[contract]
pub struct VRFContract;

#[contractimpl]
impl VRFContract {
    // Initialize the contract
    pub fn initialize(e: Env, admin: Address) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::Version, &1u32);
        
        // Initialize randomness seed
        Self::initialize_randomness_seed(&e);
        
        // Initialize quality metrics
        let metrics = QualityMetrics {
            total_requests: 0,
            successful_requests: 0,
            average_response_time: 0,
            randomness_quality_score: 0.0,
            provider_diversity: 0.0,
            last_updated: e.ledger().timestamp(),
        };
        e.storage().instance().set(&DataKey::QualityMetrics, &metrics);
    }

    // Register entropy provider
    pub fn register_provider(
        e: Env,
        provider_address: Address,
        provider_type: ProviderType,
        public_key: BytesN<32>,
        fee: i128,
    ) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let provider = EntropyProvider {
            address: provider_address.clone(),
            provider_type,
            public_key,
            reputation_score: 100, // Start with perfect reputation
            success_count: 0,
            failure_count: 0,
            last_used: 0,
            active: true,
            weight: 100,
            fee,
        };

        e.storage().persistent().set(&DataKey::EntropyProvider(provider_address.clone()), &provider);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("provider_registered"), provider_address.clone()),
            provider.provider_type,
        );
    }

    // Request VRF randomness
    pub fn request_vrf(
        e: Env,
        requester: Address,
        seed: BytesN<32>,
        additional_data: Vec<u8>,
        max_providers: u32,
    ) -> BytesN<32> {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        requester.require_auth();

        // Generate request ID
        let request_id = Self::generate_request_id(&e, &requester, &seed, &additional_data);

        // Collect entropy from multiple sources
        let entropy_sources = Self::collect_entropy_sources(&e);

        // Select providers based on weights and availability
        let selected_providers = Self::select_providers(&e, max_providers);

        if selected_providers.is_empty() {
            panic!("no active providers available");
        }

        let request = VRFRequest {
            request_id: request_id.clone(),
            requester: requester.clone(),
            seed: seed.clone(),
            additional_data: additional_data.clone(),
            created_at: e.ledger().timestamp(),
            fulfilled_at: None,
            status: VRFStatus::Pending,
            proof: None,
            randomness_output: None,
            providers_used: selected_providers.clone(),
        };

        e.storage().instance().set(&DataKey::VRFRequest(request_id.clone()), &request);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("vrf_requested"), request_id.clone()),
            (requester, selected_providers.len()),
        );

        request_id
    }

    // Fulfill VRF request with proof
    pub fn fulfill_vrf(
        e: Env,
        request_id: BytesN<32>,
        proof: VRFProof,
        randomness_output: BytesN<32>,
    ) -> bool {
        let mut request: VRFRequest = e.storage().instance().get(&DataKey::VRFRequest(request_id.clone()))
            .unwrap_or_else(|| panic!("request not found"));

        if request.status != VRFStatus::Pending {
            panic!("request not pending");
        }

        // Verify provider is authorized
        if !request.providers_used.contains(&proof.provider) {
            panic!("unauthorized provider");
        }

        // Verify VRF proof
        if !Self::verify_vrf_proof(&e, &request.seed, &proof, &randomness_output) {
            panic!("invalid VRF proof");
        }

        // Validate randomness quality
        if !Self::validate_randomness_quality(&e, &randomness_output) {
            panic!("randomness quality too low");
        }

        // Update request
        request.status = VRFStatus::Fulfilled;
        request.fulfilled_at = Some(e.ledger().timestamp());
        request.proof = Some(proof.clone());
        request.randomness_output = Some(randomness_output.clone());

        e.storage().instance().set(&DataKey::VRFRequest(request_id.clone()), &request);

        // Update provider stats
        Self::update_provider_stats(&e, &proof.provider, true);

        // Update quality metrics
        Self::update_quality_metrics(&e, true);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("vrf_fulfilled"), request_id.clone()),
            (proof.provider, randomness_output),
        );

        true
    }

    // Generate randomness without VRF (for less critical use cases)
    pub fn generate_randomness(e: Env, additional_entropy: Vec<u8>) -> BytesN<32> {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        // Collect multiple entropy sources
        let entropy_sources = Self::collect_entropy_sources(&e);

        // Combine with additional entropy
        let mut combined_entropy = Vec::new(&e);
        
        for source in entropy_sources.iter() {
            combined_entropy.push_back(source.value.to_val());
        }
        combined_entropy.push_back(additional_entropy.to_val(&e));
        combined_entropy.push_back(e.ledger().timestamp().to_val());
        combined_entropy.push_back(e.ledger().sequence().to_val());

        // Generate final randomness
        e.crypto().sha256(&combined_entropy.to_bytes())
    }

    // Validate randomness quality
    pub fn validate_randomness_quality(e: Env, randomness: &BytesN<32>) -> bool {
        let test_results = Self::run_randomness_tests(e, randomness);
        
        let passed = test_results.iter().all(|result| result.passed);
        
        if passed {
            let validation = RandomnessValidation {
                validation_id: Self::generate_validation_id(e, randomness),
                randomness: randomness.clone(),
                test_results,
                overall_score: Self::calculate_quality_score(&test_results),
                passed: true,
                timestamp: e.ledger().timestamp(),
                validator: e.current_contract_address(),
            };
            
            e.storage().instance().set(&DataKey::RandomnessValidation(validation.validation_id), &validation);
        }

        passed
    }

    // Get provider reputation
    pub fn get_provider_reputation(e: Env, provider: Address) -> u32 {
        let provider_info: EntropyProvider = e.storage().persistent().get(&DataKey::EntropyProvider(provider.clone()))
            .unwrap_or_else(|| panic!("provider not found"));
        
        provider_info.reputation_score
    }

    // Update provider reputation
    pub fn update_provider_reputation(e: Env, provider: Address, success: bool) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut provider_info: EntropyProvider = e.storage().persistent().get(&DataKey::EntropyProvider(provider.clone()))
            .unwrap_or_else(|| panic!("provider not found"));

        if success {
            provider_info.success_count += 1;
            provider_info.reputation_score = (provider_info.reputation_score + 1).min(100);
        } else {
            provider_info.failure_count += 1;
            provider_info.reputation_score = provider_info.reputation_score.saturating_sub(10);
        }

        e.storage().persistent().set(&DataKey::EntropyProvider(provider.clone()), &provider_info);
    }

    // Admin functions
    pub fn pause(e: Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Paused, &true);
    }

    pub fn unpause(e: Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Paused, &false);
    }

    // View functions
    pub fn get_vrf_request(e: Env, request_id: BytesN<32>) -> VRFRequest {
        e.storage().instance().get(&DataKey::VRFRequest(request_id))
            .unwrap_or_else(|| panic!("request not found"))
    }

    pub fn get_provider(e: Env, provider: Address) -> EntropyProvider {
        e.storage().persistent().get(&DataKey::EntropyProvider(provider))
            .unwrap_or_else(|| panic!("provider not found"))
    }

    pub fn get_quality_metrics(e: Env) -> QualityMetrics {
        e.storage().instance().get(&DataKey::QualityMetrics).unwrap()
    }

    pub fn get_validation_result(e: Env, validation_id: BytesN<32>) -> RandomnessValidation {
        e.storage().instance().get(&DataKey::RandomnessValidation(validation_id))
            .unwrap_or_else(|| panic!("validation not found"))
    }

    pub fn version(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::Version).unwrap_or(1)
    }

    // Helper functions
    fn initialize_randomness_seed(e: &Env) {
        let initial_seed = e.crypto().sha256(&e.ledger().timestamp().to_val().to_bytes());
        
        let seed = RandomnessSeed {
            current_seed: initial_seed,
            previous_seed: BytesN::from_array(e, &[0; 32]),
            block_number: e.ledger().sequence(),
            timestamp: e.ledger().timestamp(),
            entropy_sources: Vec::new(e),
            quality_score: 1.0,
        };

        e.storage().instance().set(&DataKey::RandomnessSeed, &seed);
    }

    fn generate_request_id(e: &Env, requester: &Address, seed: &BytesN<32>, additional_data: &Vec<u8>) -> BytesN<32> {
        let mut data = Vec::new(e);
        data.push_back(requester.to_val());
        data.push_back(seed.to_val());
        data.push_back(additional_data.to_val(e));
        data.push_back(e.ledger().timestamp().to_val());
        
        e.crypto().sha256(&data.to_bytes())
    }

    fn collect_entropy_sources(e: &Env) -> Vec<EntropySource> {
        let mut sources = Vec::new(e);

        // Block hash entropy
        let block_hash = e.crypto().sha256(&e.ledger().sequence().to_val().to_bytes());
        sources.push_back(EntropySource {
            source_type: SourceType::BlockHash,
            value: block_hash,
            weight: 30,
            timestamp: e.ledger().timestamp(),
            reliability: 0.9,
        });

        // Timestamp entropy
        let timestamp_bytes = e.ledger().timestamp().to_be_bytes();
        let timestamp_hash = e.crypto().sha256(&timestamp_bytes.to_vec(e).to_bytes());
        sources.push_back(EntropySource {
            source_type: SourceType::Timestamp,
            value: timestamp_hash,
            weight: 20,
            timestamp: e.ledger().timestamp(),
            reliability: 0.8,
        });

        // Ledger sequence entropy
        let sequence_bytes = e.ledger().sequence().to_be_bytes();
        let sequence_hash = e.crypto().sha256(&sequence_bytes.to_vec(e).to_bytes());
        sources.push_back(EntropySource {
            source_type: SourceType::LedgerSequence,
            value: sequence_hash,
            weight: 25,
            timestamp: e.ledger().timestamp(),
            reliability: 0.9,
        });

        // Network entropy (simplified - in practice would use more sources)
        let network_entropy = e.crypto().sha256(&e.current_contract_address().to_val().to_bytes());
        sources.push_back(EntropySource {
            source_type: SourceType::NetworkEntropy,
            value: network_entropy,
            weight: 25,
            timestamp: e.ledger().timestamp(),
            reliability: 0.7,
        });

        sources
    }

    fn select_providers(e: &Env, max_providers: u32) -> Vec<Address> {
        // This is a simplified selection - in practice would use weighted selection
        let mut providers = Vec::new(e);
        
        // For now, return empty - providers would be registered separately
        providers
    }

    fn verify_vrf_proof(e: &Env, seed: &BytesN<32>, proof: &VRFProof, output: &BytesN<32>) -> bool {
        // Simplified VRF verification - in practice would use proper cryptographic verification
        let mut data = Vec::new(e);
        data.push_back(seed.to_val());
        data.push_back(proof.gamma.to_val());
        data.push_back(proof.c.to_val());
        data.push_back(proof.s.to_val());
        data.push_back(proof.public_key.to_val());

        let expected_output = e.crypto().sha256(&data.to_bytes());
        
        // Check if output matches expected (simplified)
        expected_output == *output
    }

    fn validate_randomness_quality(e: &Env, randomness: &BytesN<32>) -> bool {
        let test_results = Self::run_randomness_tests(e, randomness);
        test_results.iter().all(|result| result.passed)
    }

    fn run_randomness_tests(e: &Env, randomness: &BytesN<32>) -> Vec<TestResult> {
        let mut results = Vec::new(e);

        // Test 1: Monobit test (frequency test)
        let monobit_result = Self::monobit_test(randomness);
        results.push_back(monobit_result);

        // Test 2: Runs test
        let runs_result = Self::runs_test(randomness);
        results.push_back(runs_result);

        // Test 3: Longest run of ones test
        let longest_run_result = Self::longest_run_test(randomness);
        results.push_back(longest_run_result);

        results
    }

    fn monobit_test(randomness: &BytesN<32>) -> TestResult {
        let mut ones = 0;
        for byte in randomness.as_bytes() {
            for bit in 0..8 {
                if (byte >> bit) & 1 == 1 {
                    ones += 1;
                }
            }
        }

        let total_bits = 256;
        let proportion = ones as f32 / total_bits as f32;
        let expected = 0.5;
        let variance = (1.0 / 12.0) / total_bits as f32; // For binomial distribution
        let z_score = (proportion - expected) / variance.sqrt();
        
        let passed = z_score.abs() < 1.96; // 95% confidence
        let score = (1.96 - z_score.abs()) / 1.96;

        TestResult {
            test_name: symbol_short!("monobit"),
            passed,
            score,
            details: Vec::new(),
        }
    }

    fn runs_test(randomness: &BytesN<32>) -> TestResult {
        let mut runs = 1;
        let mut prev_bit = randomness.as_bytes()[0] & 1;

        for byte in randomness.as_bytes() {
            for bit in 0..8 {
                let current_bit = (byte >> bit) & 1;
                if current_bit != prev_bit {
                    runs += 1;
                    prev_bit = current_bit;
                }
            }
        }

        // Expected runs for random sequence of 256 bits
        let expected_runs = (2.0 * 256.0 - 1.0) / 3.0;
        let variance = (16.0 * 256.0 - 29.0) / 90.0;
        let z_score = (runs as f32 - expected_runs) / variance.sqrt();
        
        let passed = z_score.abs() < 1.96;
        let score = (1.96 - z_score.abs()) / 1.96;

        TestResult {
            test_name: symbol_short!("runs"),
            passed,
            score,
            details: Vec::new(),
        }
    }

    fn longest_run_test(randomness: &BytesN<32>) -> TestResult {
        let mut longest_run = 0;
        let mut current_run = 0;
        let mut prev_bit = 0;

        for byte in randomness.as_bytes() {
            for bit in 0..8 {
                let current_bit = (byte >> bit) & 1;
                if current_bit == 1 {
                    current_run += 1;
                    if current_run > longest_run {
                        longest_run = current_run;
                    }
                } else {
                    current_run = 0;
                }
                prev_bit = current_bit;
            }
        }

        // For 256 bits, longest run should not exceed 26 (with high probability)
        let passed = longest_run <= 26;
        let score = if longest_run <= 10 { 1.0 } else { (26.0 - longest_run as f32) / 16.0 };

        TestResult {
            test_name: symbol_short!("longest_run"),
            passed,
            score,
            details: Vec::new(),
        }
    }

    fn calculate_quality_score(test_results: &Vec<TestResult>) -> f32 {
        if test_results.is_empty() {
            return 0.0;
        }

        let total_score: f32 = test_results.iter().map(|result| result.score).sum();
        total_score / test_results.len() as f32
    }

    fn generate_validation_id(e: &Env, randomness: &BytesN<32>) -> BytesN<32> {
        let mut data = Vec::new(e);
        data.push_back(randomness.to_val());
        data.push_back(e.ledger().timestamp().to_val());
        
        e.crypto().sha256(&data.to_bytes())
    }

    fn update_provider_stats(e: &Env, provider: &Address, success: bool) {
        let mut stats: ProviderStats = e.storage().persistent().get(&DataKey::ProviderStats(provider.clone()))
            .unwrap_or(ProviderStats {
                provider: provider.clone(),
                total_requests: 0,
                successful_requests: 0,
                average_response_time: 0,
                reputation_history: Vec::new(e),
                last_updated: e.ledger().timestamp(),
            });

        stats.total_requests += 1;
        if success {
            stats.successful_requests += 1;
        }
        stats.last_updated = e.ledger().timestamp();

        e.storage().persistent().set(&DataKey::ProviderStats(provider.clone()), &stats);
    }

    fn update_quality_metrics(e: &Env, success: bool) {
        let mut metrics: QualityMetrics = e.storage().instance().get(&DataKey::QualityMetrics).unwrap();
        
        metrics.total_requests += 1;
        if success {
            metrics.successful_requests += 1;
        }
        metrics.last_updated = e.ledger().timestamp();

        // Update quality score based on success rate
        let success_rate = metrics.successful_requests as f32 / metrics.total_requests as f32;
        metrics.randomness_quality_score = success_rate;

        e.storage().instance().set(&DataKey::QualityMetrics, &metrics);
    }
}
