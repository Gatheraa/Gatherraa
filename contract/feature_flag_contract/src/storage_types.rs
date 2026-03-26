use soroban_sdk::{Address, BytesN, Env, Symbol, Vec, Map, U256};

#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    Version,
    FeatureFlag(Symbol),
    UserSegment(Address),
    SegmentRule,
    AnalyticsData,
    EnvironmentConfig,
    KillSwitch,
    ABTest(Symbol),
    RolloutPlan(Symbol),
}

#[derive(Clone)]
pub struct FeatureFlag {
    pub key: Symbol,
    pub enabled: bool,
    pub rollout_percentage: u32,
    pub environment: Environment,
    pub segments: Vec<Symbol>,
    pub rules: Vec<SegmentRule>,
    pub created_at: u64,
    pub updated_at: u64,
    pub created_by: Address,
    pub description: String,
    pub tags: Vec<Symbol>,
    pub kill_switch_active: bool,
    pub rollout_strategy: RolloutStrategy,
}

#[derive(Clone, PartialEq)]
pub enum Environment {
    Development,
    Staging,
    Production,
    Testing,
}

#[derive(Clone)]
pub struct SegmentRule {
    pub id: Symbol,
    pub name: String,
    pub conditions: Vec<Condition>,
    pub priority: u32,
    pub active: bool,
}

#[derive(Clone)]
pub struct Condition {
    pub field: Symbol,
    pub operator: ComparisonOperator,
    pub value: soroban_sdk::Val,
    pub weight: u32,
}

#[derive(Clone, PartialEq)]
pub enum ComparisonOperator {
    Equals,
    NotEquals,
    GreaterThan,
    LessThan,
    GreaterThanOrEqual,
    LessThanOrEqual,
    Contains,
    NotContains,
    In,
    NotIn,
}

#[derive(Clone)]
pub struct UserSegment {
    pub user: Address,
    pub segments: Vec<Symbol>,
    pub attributes: Map<Symbol, soroban_sdk::Val>,
    pub last_updated: u64,
    pub version: u32,
}

#[derive(Clone)]
pub struct ABTest {
    pub id: Symbol,
    pub name: String,
    pub feature_flag: Symbol,
    pub variants: Vec<TestVariant>,
    pub traffic_allocation: Map<Symbol, u32>,
    pub start_time: u64,
    pub end_time: u64,
    pub status: ABTestStatus,
    pub sample_size: u32,
    pub confidence_threshold: u32,
}

#[derive(Clone)]
pub struct TestVariant {
    pub id: Symbol,
    pub name: String,
    pub weight: u32,
    pub config: Map<Symbol, soroban_sdk::Val>,
}

#[derive(Clone, PartialEq)]
pub enum ABTestStatus {
    Draft,
    Running,
    Paused,
    Completed,
    Cancelled,
}

#[derive(Clone)]
pub struct RolloutPlan {
    pub feature_flag: Symbol,
    pub stages: Vec<RolloutStage>,
    pub current_stage: u32,
    pub auto_advance: bool,
    pub created_at: u64,
}

#[derive(Clone)]
pub struct RolloutStage {
    pub percentage: u32,
    pub duration: u64,
    pub criteria: Vec<Condition>,
    pub completed: bool,
}

#[derive(Clone)]
pub enum RolloutStrategy {
    Immediate,
    Gradual,
    Segmented,
    TimeBased,
    UserBased,
}

#[derive(Clone)]
pub struct AnalyticsData {
    pub flag_key: Symbol,
    pub user: Address,
    pub evaluation: bool,
    pub variant: Option<Symbol>,
    pub timestamp: u64,
    pub context: Map<Symbol, soroban_sdk::Val>,
    pub environment: Environment,
}

#[derive(Clone)]
pub struct EnvironmentConfig {
    pub environment: Environment,
    pub flags: Vec<Symbol>,
    pub overrides: Map<Symbol, bool>,
    pub defaults: Map<Symbol, bool>,
}

#[derive(Clone)]
pub struct KillSwitch {
    pub flag_key: Symbol,
    pub active: bool,
    pub triggered_by: Address,
    pub triggered_at: u64,
    pub reason: String,
    pub auto_recovery: bool,
    pub recovery_time: Option<u64>,
}

// Custom errors
#[derive(Debug, Clone, PartialEq)]
pub enum FeatureFlagError {
    AlreadyInitialized,
    NotInitialized,
    Unauthorized,
    FlagNotFound,
    InvalidFlagKey,
    InvalidPercentage,
    InvalidEnvironment,
    InvalidSegment,
    InvalidRule,
    InvalidABTest,
    ABTestNotFound,
    InvalidRolloutPlan,
    RolloutPlanNotFound,
    InvalidVariant,
    UserNotFound,
    InvalidCondition,
    InvalidOperator,
    InvalidValue,
    KillSwitchActive,
    FlagDisabled,
    TestNotRunning,
    InvalidTimeRange,
    DuplicateFlag,
    DuplicateSegment,
    DuplicateTest,
    InvalidTrafficAllocation,
    InsufficientSampleSize,
    ConfidenceThresholdNotMet,
    ContractPaused,
    StorageError,
    SerializationError,
}
