use soroban_sdk::{contracttype, contracterror, Address, BytesN, Env, Symbol, Vec, Map, U256, String};

#[derive(Clone)]
#[contracttype]
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
#[contracttype]
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
#[contracttype]
pub enum Environment {
    Development,
    Staging,
    Production,
    Testing,
}

#[derive(Clone)]
#[contracttype]
pub struct SegmentRule {
    pub id: Symbol,
    pub name: String,
    pub conditions: Vec<Condition>,
    pub priority: u32,
    pub active: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct Condition {
    pub field: Symbol,
    pub operator: ComparisonOperator,
    pub value: soroban_sdk::Val,
    pub weight: u32,
}

#[derive(Clone, PartialEq)]
#[contracttype]
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
#[contracttype]
pub struct UserSegment {
    pub user: Address,
    pub segments: Vec<Symbol>,
    pub attributes: Map<Symbol, soroban_sdk::Val>,
    pub last_updated: u64,
    pub version: u32,
}

#[derive(Clone)]
#[contracttype]
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
#[contracttype]
pub struct TestVariant {
    pub id: Symbol,
    pub name: String,
    pub weight: u32,
    pub config: Map<Symbol, soroban_sdk::Val>,
}

#[derive(Clone, PartialEq)]
#[contracttype]
pub enum ABTestStatus {
    Draft,
    Running,
    Paused,
    Completed,
    Cancelled,
}

#[derive(Clone)]
#[contracttype]
pub struct RolloutPlan {
    pub feature_flag: Symbol,
    pub stages: Vec<RolloutStage>,
    pub current_stage: u32,
    pub auto_advance: bool,
    pub created_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct RolloutStage {
    pub percentage: u32,
    pub duration: u64,
    pub criteria: Vec<Condition>,
    pub completed: bool,
}

#[derive(Clone)]
#[contracttype]
pub enum RolloutStrategy {
    Immediate,
    Gradual,
    Segmented,
    TimeBased,
    UserBased,
}

#[derive(Clone)]
#[contracttype]
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
#[contracttype]
pub struct EnvironmentConfig {
    pub environment: Environment,
    pub flags: Vec<Symbol>,
    pub overrides: Map<Symbol, bool>,
    pub defaults: Map<Symbol, bool>,
}

#[derive(Clone)]
#[contracttype]
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
#[contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FeatureFlagError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    FlagNotFound = 4,
    InvalidFlagKey = 5,
    InvalidPercentage = 6,
    InvalidEnvironment = 7,
    InvalidSegment = 8,
    InvalidRule = 9,
    InvalidABTest = 10,
    ABTestNotFound = 11,
    InvalidRolloutPlan = 12,
    RolloutPlanNotFound = 13,
    InvalidVariant = 14,
    UserNotFound = 15,
    InvalidCondition = 16,
    InvalidOperator = 17,
    InvalidValue = 18,
    KillSwitchActive = 19,
    FlagDisabled = 20,
    TestNotRunning = 21,
    InvalidTimeRange = 22,
    DuplicateFlag = 23,
    DuplicateSegment = 24,
    DuplicateTest = 25,
    InvalidTrafficAllocation = 26,
    InsufficientSampleSize = 27,
    ConfidenceThresholdNotMet = 28,
    ContractPaused = 29,
    StorageError = 30,
    SerializationError = 31,
}
