use soroban_sdk::{Address, BytesN, Env, Symbol, Vec, Map, U256};

#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    Version,
    InitializationState,
    ValidationResults,
    DefaultValues,
    StorageHealth,
}

// Storage initialization state tracking
#[derive(Clone, PartialEq)]
pub enum InitializationState {
    NotInitialized,
    Initializing,
    Initialized,
    ValidationFailed,
    Corrupted,
}

// Storage validation result
#[derive(Clone)]
pub struct ValidationResult {
    pub storage_key: Symbol,
    pub is_valid: bool,
    pub error_message: Option<String>,
    pub validation_timestamp: u64,
    pub default_applied: bool,
}

// Default value strategies
#[derive(Clone)]
pub enum DefaultStrategy {
    Zero,
    Empty,
    Default,
    Custom(soroban_sdk::Val),
    Computed,
}

// Default value configuration
#[derive(Clone)]
pub struct DefaultValue {
    pub key: Symbol,
    pub strategy: DefaultStrategy,
    pub value: Option<soroban_sdk::Val>,
    pub required: bool,
    pub validation_function: Option<Symbol>,
}

// Storage health metrics
#[derive(Clone)]
pub struct StorageHealth {
    pub total_keys: u32,
    pub initialized_keys: u32,
    pub corrupted_keys: u32,
    pub last_validation: u64,
    pub health_score: f32,
    pub issues: Vec<StorageIssue>,
}

#[derive(Clone)]
pub struct StorageIssue {
    pub key: Symbol,
    pub issue_type: IssueType,
    pub severity: Severity,
    pub description: String,
    pub detected_at: u64,
}

#[derive(Clone, PartialEq)]
pub enum IssueType {
    Uninitialized,
    Corrupted,
    InvalidType,
    MissingRequired,
    Outdated,
}

#[derive(Clone, PartialEq)]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

// Initialization configuration
#[derive(Clone)]
pub struct InitializationConfig {
    pub strict_mode: bool,
    pub auto_fix_issues: bool,
    pub validation_enabled: bool,
    pub backup_before_fix: bool,
    pub max_retry_attempts: u32,
    pub initialization_timeout: u64,
}

// Storage initialization template
#[derive(Clone)]
pub struct InitializationTemplate {
    pub template_id: Symbol,
    pub name: String,
    pub default_values: Vec<DefaultValue>,
    pub validation_rules: Vec<ValidationRule>,
    pub dependencies: Vec<Symbol>,
    pub config: InitializationConfig,
}

#[derive(Clone)]
pub struct ValidationRule {
    pub rule_id: Symbol,
    pub key: Symbol,
    pub validation_type: ValidationType,
    pub parameters: Map<Symbol, soroban_sdk::Val>,
    pub error_message: String,
}

#[derive(Clone, PartialEq)]
pub enum ValidationType {
    TypeCheck,
    RangeCheck,
    NotNull,
    Custom,
    Format,
    Length,
}

// Custom errors for storage initialization
#[derive(Debug, Clone, PartialEq)]
pub enum StorageInitializationError {
    AlreadyInitialized,
    NotInitialized,
    Unauthorized,
    ValidationFailed,
    CorruptedStorage,
    MissingRequiredKey,
    InvalidDefaultValue,
    InitializationTimeout,
    RetryExhausted,
    ConfigurationError,
    DependencyError,
    BackupFailed,
    RestoreFailed,
    ContractPaused,
    StorageError,
    SerializationError,
}
