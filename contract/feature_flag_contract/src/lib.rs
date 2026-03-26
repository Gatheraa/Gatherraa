#![no_std]

#[cfg(test)]
mod test;

mod storage_types;
use storage_types::{DataKey, FeatureFlag, Environment, SegmentRule, Condition, ComparisonOperator,
                   UserSegment, ABTest, TestVariant, ABTestStatus, RolloutPlan, RolloutStage,
                   RolloutStrategy, AnalyticsData, EnvironmentConfig, KillSwitch, FeatureFlagError};

use soroban_sdk::{
    contract, contractimpl, symbol_short, vec, map, Address, BytesN, Env, IntoVal, String, Symbol, Vec, Map, U256,
};

#[contract]
pub struct FeatureFlagContract;

#[contractimpl]
impl FeatureFlagContract {
    // Initialize the contract
    pub fn initialize(e: Env, admin: Address) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::Version, &1u32);
        
        // Initialize environment configs
        Self::init_environment_configs(&e);
    }

    // Create a new feature flag
    pub fn create_feature_flag(
        e: Env,
        key: Symbol,
        enabled: bool,
        rollout_percentage: u32,
        environment: Environment,
        description: String,
        created_by: Address,
        tags: Vec<Symbol>,
        rollout_strategy: RolloutStrategy,
    ) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        // Validate inputs
        Self::validate_flag_inputs(&key, rollout_percentage, &environment)?;

        // Check for duplicate flag
        if e.storage().instance().has(&DataKey::FeatureFlag(key.clone())) {
            panic!("flag already exists");
        }

        let flag = FeatureFlag {
            key: key.clone(),
            enabled,
            rollout_percentage,
            environment,
            segments: Vec::new(&e),
            rules: Vec::new(&e),
            created_at: e.ledger().timestamp(),
            updated_at: e.ledger().timestamp(),
            created_by: created_by.clone(),
            description,
            tags,
            kill_switch_active: false,
            rollout_strategy,
        };

        e.storage().instance().set(&DataKey::FeatureFlag(key.clone()), &flag);

        // Update environment config
        Self::update_environment_flag_list(&e, &flag.environment, &key);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("flag_created"), key.clone()),
            (enabled, rollout_percentage),
        );
    }

    // Evaluate feature flag for a user
    pub fn evaluate_flag(e: Env, key: Symbol, user: Address, context: Map<Symbol, soroban_sdk::Val>) -> bool {
        let flag: FeatureFlag = e.storage().instance().get(&DataKey::FeatureFlag(key.clone()))
            .unwrap_or_else(|| panic!("flag not found"));

        // Check kill switch
        if flag.kill_switch_active {
            return false;
        }

        // Check if flag is enabled
        if !flag.enabled {
            return false;
        }

        // Get user segment
        let user_segment: UserSegment = e.storage().persistent().get(&DataKey::UserSegment(user.clone()))
            .unwrap_or(UserSegment {
                user: user.clone(),
                segments: Vec::new(&e),
                attributes: map![&e],
                last_updated: 0,
                version: 0,
            });

        // Evaluate based on rollout strategy
        let result = match flag.rollout_strategy {
            RolloutStrategy::Immediate => flag.enabled,
            RolloutStrategy::Gradual => Self::evaluate_gradual_rollout(&e, &flag, &user, &context),
            RolloutStrategy::Segmented => Self::evaluate_segmented_rollout(&e, &flag, &user_segment),
            RolloutStrategy::TimeBased => Self::evaluate_time_based_rollout(&e, &flag, &context),
            RolloutStrategy::UserBased => Self::evaluate_user_based_rollout(&e, &flag, &user),
        };

        // Record analytics
        Self::record_analytics(&e, &key, &user, result, None, &context, &flag.environment);

        result
    }

    // Create A/B test
    pub fn create_ab_test(
        e: Env,
        id: Symbol,
        name: String,
        feature_flag: Symbol,
        variants: Vec<TestVariant>,
        traffic_allocation: Map<Symbol, u32>,
        start_time: u64,
        end_time: u64,
        sample_size: u32,
        confidence_threshold: u32,
    ) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        // Validate inputs
        Self::validate_ab_test_inputs(&id, &feature_flag, &variants, &traffic_allocation, start_time, end_time)?;

        let test = ABTest {
            id: id.clone(),
            name,
            feature_flag: feature_flag.clone(),
            variants,
            traffic_allocation,
            start_time,
            end_time,
            status: ABTestStatus::Draft,
            sample_size,
            confidence_threshold,
        };

        e.storage().instance().set(&DataKey::ABTest(id.clone()), &test);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("ab_test_created"), id.clone()),
            (feature_flag, start_time),
        );
    }

    // Get A/B test variant for user
    pub fn get_ab_test_variant(e: Env, test_id: Symbol, user: Address) -> Option<Symbol> {
        let test: ABTest = e.storage().instance().get(&DataKey::ABTest(test_id.clone()))
            .unwrap_or_else(|| panic!("test not found"));

        if test.status != ABTestStatus::Running {
            return None;
        }

        let current_time = e.ledger().timestamp();
        if current_time < test.start_time || current_time > test.end_time {
            return None;
        }

        // Simple hash-based assignment
        let user_hash = e.crypto().sha256(&user.to_val().to_bytes());
        let hash_value = u32::from_le_bytes([
            user_hash.as_bytes()[0],
            user_hash.as_bytes()[1],
            user_hash.as_bytes()[2],
            user_hash.as_bytes()[3],
        ]);

        let mut cumulative = 0u32;
        for (variant_id, allocation) in test.traffic_allocation.iter() {
            cumulative += allocation;
            if hash_value % 100 < cumulative {
                return Some(variant_id);
            }
        }

        None
    }

    // Create rollout plan
    pub fn create_rollout_plan(
        e: Env,
        feature_flag: Symbol,
        stages: Vec<RolloutStage>,
        auto_advance: bool,
    ) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let plan = RolloutPlan {
            feature_flag: feature_flag.clone(),
            stages,
            current_stage: 0,
            auto_advance,
            created_at: e.ledger().timestamp(),
        };

        e.storage().instance().set(&DataKey::RolloutPlan(feature_flag.clone()), &plan);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("rollout_plan_created"), feature_flag.clone()),
            plan.stages.len(),
        );
    }

    // Add user to segment
    pub fn add_user_segment(
        e: Env,
        user: Address,
        segments: Vec<Symbol>,
        attributes: Map<Symbol, soroban_sdk::Val>,
    ) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let user_segment = UserSegment {
            user: user.clone(),
            segments,
            attributes,
            last_updated: e.ledger().timestamp(),
            version: 1,
        };

        e.storage().persistent().set(&DataKey::UserSegment(user.clone()), &user_segment);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("user_segmented"), user.clone()),
            user_segment.segments.len(),
        );
    }

    // Activate kill switch
    pub fn activate_kill_switch(e: Env, flag_key: Symbol, reason: String, auto_recovery: bool, recovery_time: Option<u64>) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut flag: FeatureFlag = e.storage().instance().get(&DataKey::FeatureFlag(flag_key.clone()))
            .unwrap_or_else(|| panic!("flag not found"));

        flag.kill_switch_active = true;
        e.storage().instance().set(&DataKey::FeatureFlag(flag_key.clone()), &flag);

        let kill_switch = KillSwitch {
            flag_key: flag_key.clone(),
            active: true,
            triggered_by: admin.clone(),
            triggered_at: e.ledger().timestamp(),
            reason,
            auto_recovery,
            recovery_time,
        };

        e.storage().instance().set(&DataKey::KillSwitch(flag_key.clone()), &kill_switch);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("kill_switch_activated"), flag_key.clone()),
            admin,
        );
    }

    // Deactivate kill switch
    pub fn deactivate_kill_switch(e: Env, flag_key: Symbol) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut flag: FeatureFlag = e.storage().instance().get(&DataKey::FeatureFlag(flag_key.clone()))
            .unwrap_or_else(|| panic!("flag not found"));

        flag.kill_switch_active = false;
        e.storage().instance().set(&DataKey::FeatureFlag(flag_key.clone()), &flag);

        let mut kill_switch: KillSwitch = e.storage().instance().get(&DataKey::KillSwitch(flag_key.clone()))
            .unwrap_or_else(|| panic!("kill switch not found"));

        kill_switch.active = false;
        e.storage().instance().set(&DataKey::KillSwitch(flag_key.clone()), &kill_switch);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("kill_switch_deactivated"), flag_key.clone()),
            admin,
        );
    }

    // Update feature flag
    pub fn update_feature_flag(
        e: Env,
        key: Symbol,
        enabled: Option<bool>,
        rollout_percentage: Option<u32>,
        description: Option<String>,
        tags: Option<Vec<Symbol>>,
    ) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut flag: FeatureFlag = e.storage().instance().get(&DataKey::FeatureFlag(key.clone()))
            .unwrap_or_else(|| panic!("flag not found"));

        if let Some(new_enabled) = enabled {
            flag.enabled = new_enabled;
        }

        if let Some(new_percentage) = rollout_percentage {
            Self::validate_percentage(new_percentage)?;
            flag.rollout_percentage = new_percentage;
        }

        if let Some(new_description) = description {
            flag.description = new_description;
        }

        if let Some(new_tags) = tags {
            flag.tags = new_tags;
        }

        flag.updated_at = e.ledger().timestamp();
        e.storage().instance().set(&DataKey::FeatureFlag(key.clone()), &flag);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("flag_updated"), key.clone()),
            flag.enabled,
        );
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
    pub fn get_feature_flag(e: Env, key: Symbol) -> FeatureFlag {
        e.storage().instance().get(&DataKey::FeatureFlag(key))
            .unwrap_or_else(|| panic!("flag not found"))
    }

    pub fn get_user_segment(e: Env, user: Address) -> UserSegment {
        e.storage().persistent().get(&DataKey::UserSegment(user))
            .unwrap_or(UserSegment {
                user,
                segments: Vec::new(&e),
                attributes: map![&e],
                last_updated: 0,
                version: 0,
            })
    }

    pub fn get_ab_test(e: Env, test_id: Symbol) -> ABTest {
        e.storage().instance().get(&DataKey::ABTest(test_id))
            .unwrap_or_else(|| panic!("test not found"))
    }

    pub fn get_rollout_plan(e: Env, flag_key: Symbol) -> RolloutPlan {
        e.storage().instance().get(&DataKey::RolloutPlan(flag_key))
            .unwrap_or_else(|| panic!("rollout plan not found"))
    }

    pub fn get_kill_switch(e: Env, flag_key: Symbol) -> KillSwitch {
        e.storage().instance().get(&DataKey::KillSwitch(flag_key))
            .unwrap_or_else(|| panic!("kill switch not found"))
    }

    pub fn version(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::Version).unwrap_or(1)
    }

    // Helper functions
    fn init_environment_configs(e: &Env) {
        let environments = vec![
            e,
            Environment::Development,
            Environment::Staging,
            Environment::Production,
            Environment::Testing,
        ];

        for env in environments.iter() {
            let config = EnvironmentConfig {
                environment: env.clone(),
                flags: Vec::new(e),
                overrides: map![e],
                defaults: map![e],
            };
            e.storage().instance().set(&DataKey::EnvironmentConfig, &config);
        }
    }

    fn validate_flag_inputs(key: &Symbol, rollout_percentage: u32, environment: &Environment) -> Result<(), FeatureFlagError> {
        if rollout_percentage > 100 {
            return Err(FeatureFlagError::InvalidPercentage);
        }

        // Additional validation can be added here
        Ok(())
    }

    fn validate_ab_test_inputs(
        id: &Symbol,
        feature_flag: &Symbol,
        variants: &Vec<TestVariant>,
        traffic_allocation: &Map<Symbol, u32>,
        start_time: u64,
        end_time: u64,
    ) -> Result<(), FeatureFlagError> {
        if variants.is_empty() {
            return Err(FeatureFlagError::InvalidVariant);
        }

        if start_time >= end_time {
            return Err(FeatureFlagError::InvalidTimeRange);
        }

        // Validate traffic allocation sums to 100
        let total: u32 = traffic_allocation.iter().map(|(_, allocation)| allocation).sum();
        if total != 100 {
            return Err(FeatureFlagError::InvalidTrafficAllocation);
        }

        Ok(())
    }

    fn validate_percentage(percentage: u32) -> Result<(), FeatureFlagError> {
        if percentage > 100 {
            return Err(FeatureFlagError::InvalidPercentage);
        }
        Ok(())
    }

    fn update_environment_flag_list(e: &Env, environment: &Environment, flag_key: &Symbol) {
        // Update environment config to include new flag
        // This would require more complex implementation in practice
    }

    fn evaluate_gradual_rollout(e: &Env, flag: &FeatureFlag, user: &Address, context: &Map<Symbol, soroban_sdk::Val>) -> bool {
        // Simple hash-based rollout
        let user_hash = e.crypto().sha256(&user.to_val().to_bytes());
        let hash_value = u32::from_le_bytes([
            user_hash.as_bytes()[0],
            user_hash.as_bytes()[1],
            user_hash.as_bytes()[2],
            user_hash.as_bytes()[3],
        ]);

        hash_value % 100 < flag.rollout_percentage
    }

    fn evaluate_segmented_rollout(e: &Env, flag: &FeatureFlag, user_segment: &UserSegment) -> bool {
        // Check if user is in any of the flag's segments
        for segment in flag.segments.iter() {
            if user_segment.segments.contains(segment) {
                return true;
            }
        }
        false
    }

    fn evaluate_time_based_rollout(e: &Env, flag: &FeatureFlag, context: &Map<Symbol, soroban_sdk::Val>) -> bool {
        // Time-based evaluation logic
        let current_time = e.ledger().timestamp();
        
        // Simple time-based rollout (could be more sophisticated)
        let time_factor = (current_time % 86400) * 100 / 86400; // Percentage through the day
        time_factor <= flag.rollout_percentage
    }

    fn evaluate_user_based_rollout(e: &Env, flag: &FeatureFlag, user: &Address) -> bool {
        // User-based rollout using consistent hashing
        let user_hash = e.crypto().sha256(&user.to_val().to_bytes());
        let hash_value = u32::from_le_bytes([
            user_hash.as_bytes()[0],
            user_hash.as_bytes()[1],
            user_hash.as_bytes()[2],
            user_hash.as_bytes()[3],
        ]);

        hash_value % 100 < flag.rollout_percentage
    }

    fn record_analytics(
        e: &Env,
        flag_key: &Symbol,
        user: &Address,
        evaluation: bool,
        variant: Option<Symbol>,
        context: &Map<Symbol, soroban_sdk::Val>,
        environment: &Environment,
    ) {
        let analytics = AnalyticsData {
            flag_key: flag_key.clone(),
            user: user.clone(),
            evaluation,
            variant,
            timestamp: e.ledger().timestamp(),
            context: context.clone(),
            environment: environment.clone(),
        };

        // Store analytics data (in practice, this might use a different storage strategy)
        e.storage().temporary().set(&symbol_short!("analytics"), &analytics, 3600); // 1 hour TTL
    }
}
