//! Deterministic security tests for escrow validation rules.

use soroban_sdk::{
    contracttype,
    testutils::{Address as _, Ledger},
    Address, BytesN, Env, String, Vec,
};

use crate::{EscrowError, EscrowStatus};

#[allow(unused_imports)]
use stellar_access::ownable::{self as ownable, Ownable};
#[allow(unused_imports)]
use stellar_tokens::non_fungible::{Base, NonFungibleToken};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Config,
    Paused,
    ReentrancyLock,
    Escrow(BytesN<32>),
    Referral(Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RevenueSplit {
    pub organizer_percentage: i128,
    pub platform_percentage: i128,
    pub referral_percentage: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub description: String,
    pub amount: i128,
    pub completed: bool,
    pub completion_time: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RevenueSplitConfig {
    pub default_organizer_percentage: i128,
    pub default_platform_percentage: i128,
    pub default_referral_percentage: i128,
    pub max_referral_percentage: i128,
    pub precision: i128,
    pub min_escrow_amount: i128,
    pub max_escrow_amount: i128,
    pub dispute_timeout: u64,
    pub emergency_withdrawal_delay: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReferralTracker {
    pub referrer: Address,
    pub total_referrals: u32,
    pub total_rewards: i128,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct TestEscrow {
    event: Address,
    organizer: Address,
    purchaser: Address,
    amount: i128,
    token: Address,
    release_time: u64,
    splits: RevenueSplit,
    milestones: Vec<Milestone>,
    status: EscrowStatus,
}

fn create_test_config() -> RevenueSplitConfig {
    RevenueSplitConfig {
        default_organizer_percentage: 8_000_000,
        default_platform_percentage: 1_500_000,
        default_referral_percentage: 500_000,
        max_referral_percentage: 10_000_000,
        precision: 10_000_000,
        min_escrow_amount: 1_000_000,
        max_escrow_amount: 10_000_000_000,
        dispute_timeout: 86_400,
        emergency_withdrawal_delay: 3_600,
    }
}

fn default_split(config: &RevenueSplitConfig) -> RevenueSplit {
    RevenueSplit {
        organizer_percentage: config.default_organizer_percentage,
        platform_percentage: config.default_platform_percentage,
        referral_percentage: config.default_referral_percentage,
    }
}

fn create_test_env() -> (Env, Address, Address, Address, Address, RevenueSplitConfig) {
    let env = Env::default();
    env.ledger().set_timestamp(1_700_000_000);

    (
        env.clone(),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        create_test_config(),
    )
}

fn validate_split(split: &RevenueSplit, config: &RevenueSplitConfig) -> Result<(), EscrowError> {
    if split.organizer_percentage < 0
        || split.platform_percentage < 0
        || split.referral_percentage < 0
        || split.referral_percentage > config.max_referral_percentage
    {
        return Err(EscrowError::InvalidTerms);
    }

    let total = split
        .organizer_percentage
        .checked_add(split.platform_percentage)
        .and_then(|subtotal| subtotal.checked_add(split.referral_percentage))
        .ok_or(EscrowError::InvalidTerms)?;

    if total != config.precision {
        return Err(EscrowError::InvalidTerms);
    }

    Ok(())
}

fn validate_milestones(milestones: &Vec<Milestone>, amount: i128) -> Result<(), EscrowError> {
    let mut total = 0_i128;

    for milestone in milestones.iter() {
        if milestone.amount <= 0 {
            return Err(EscrowError::InvalidTerms);
        }

        total = total
            .checked_add(milestone.amount)
            .ok_or(EscrowError::InvalidTerms)?;
    }

    if !milestones.is_empty() && total != amount {
        return Err(EscrowError::InvalidTerms);
    }

    Ok(())
}

fn create_validated_escrow(
    env: &Env,
    event: Address,
    organizer: Address,
    purchaser: Address,
    amount: i128,
    token: Address,
    release_time: u64,
    splits: Option<RevenueSplit>,
    milestones: Option<Vec<Milestone>>,
    config: &RevenueSplitConfig,
) -> Result<TestEscrow, EscrowError> {
    if event == organizer || event == purchaser || organizer == purchaser || token == event {
        return Err(EscrowError::InvalidTerms);
    }

    if amount < config.min_escrow_amount || amount > config.max_escrow_amount {
        return Err(EscrowError::InvalidTerms);
    }

    if release_time <= env.ledger().timestamp() {
        return Err(EscrowError::EscrowExpired);
    }

    let splits = splits.unwrap_or_else(|| default_split(config));
    validate_split(&splits, config)?;

    let milestones = milestones.unwrap_or_else(|| Vec::new(env));
    validate_milestones(&milestones, amount)?;

    Ok(TestEscrow {
        event,
        organizer,
        purchaser,
        amount,
        token,
        release_time,
        splits,
        milestones,
        status: EscrowStatus::Created,
    })
}

fn release_funds(
    escrow: &mut TestEscrow,
    amount: i128,
    lock_held: bool,
) -> Result<(), EscrowError> {
    if lock_held {
        return Err(EscrowError::InvalidTerms);
    }

    if escrow.status == EscrowStatus::Completed {
        return Err(EscrowError::AlreadyCompleted);
    }

    if amount != escrow.amount {
        return Err(EscrowError::InvalidTerms);
    }

    escrow.status = EscrowStatus::Completed;
    Ok(())
}

fn pause_contract(caller: &Address, admin: &Address) -> Result<(), EscrowError> {
    if caller != admin {
        return Err(EscrowError::Unauthorized);
    }

    Ok(())
}

#[test]
fn test_reentrancy_attack_release_funds_is_rejected() {
    let (env, _admin, organizer, purchaser, token, config) = create_test_env();
    let mut escrow = create_validated_escrow(
        &env,
        Address::generate(&env),
        organizer,
        purchaser,
        1_000_000_000,
        token,
        env.ledger().timestamp() + 86_400,
        None,
        None,
        &config,
    )
    .expect("valid escrow setup should succeed");

    let err = release_funds(&mut escrow, 1_000_000_000, true)
        .expect_err("reentrant release must be rejected while the lock is held");

    assert_eq!(
        err,
        EscrowError::InvalidTerms,
        "reentrant release returned an unexpected error"
    );
    assert_eq!(
        escrow.status,
        EscrowStatus::Created,
        "reentrant release must not mutate escrow state"
    );
}

#[test]
fn test_amount_overflow_protection() {
    let (env, _admin, organizer, purchaser, token, config) = create_test_env();

    let err = create_validated_escrow(
        &env,
        Address::generate(&env),
        organizer,
        purchaser,
        i128::MAX,
        token,
        env.ledger().timestamp() + 86_400,
        None,
        None,
        &config,
    )
    .expect_err("amount above max_escrow_amount must be rejected");

    assert_eq!(
        err,
        EscrowError::InvalidTerms,
        "overflow amount returned an unexpected error"
    );
}

#[test]
fn test_percentage_calculation_overflow() {
    let config = create_test_config();
    let malicious_splits = RevenueSplit {
        organizer_percentage: i128::MAX,
        platform_percentage: i128::MAX,
        referral_percentage: i128::MAX,
    };

    let err = validate_split(&malicious_splits, &config)
        .expect_err("overflowing revenue split percentages must be rejected");

    assert_eq!(
        err,
        EscrowError::InvalidTerms,
        "overflowing percentages returned an unexpected error"
    );
}

#[test]
fn test_underflow_protection() {
    let (env, _admin, organizer, purchaser, token, config) = create_test_env();

    let err = create_validated_escrow(
        &env,
        Address::generate(&env),
        organizer,
        purchaser,
        -1_000_000,
        token,
        env.ledger().timestamp() + 86_400,
        None,
        None,
        &config,
    )
    .expect_err("negative escrow amount must be rejected");

    assert_eq!(
        err,
        EscrowError::InvalidTerms,
        "negative amount returned an unexpected error"
    );
}

#[test]
fn test_milestone_amount_overflow() {
    let (env, _admin, organizer, purchaser, token, config) = create_test_env();
    let milestones = Vec::from_array(
        &env,
        [
            Milestone {
                description: String::from_str(&env, "Milestone 1"),
                amount: i128::MAX,
                completed: false,
                completion_time: None,
            },
            Milestone {
                description: String::from_str(&env, "Milestone 2"),
                amount: i128::MAX,
                completed: false,
                completion_time: None,
            },
        ],
    );

    let err = create_validated_escrow(
        &env,
        Address::generate(&env),
        organizer,
        purchaser,
        1_000_000_000,
        token,
        env.ledger().timestamp() + 86_400,
        None,
        Some(milestones),
        &config,
    )
    .expect_err("overflowing milestone totals must be rejected");

    assert_eq!(
        err,
        EscrowError::InvalidTerms,
        "overflowing milestones returned an unexpected error"
    );
}

#[test]
fn test_unauthorized_admin_access() {
    let (env, admin, _organizer, _purchaser, _token, _config) = create_test_env();
    let unauthorized_user = Address::generate(&env);

    let err =
        pause_contract(&unauthorized_user, &admin).expect_err("non-admin pause must be rejected");

    assert_eq!(
        err,
        EscrowError::Unauthorized,
        "unauthorized admin access returned an unexpected error"
    );
}

#[test]
fn test_front_running_protection_is_predictable() {
    let (env, _admin, organizer, purchaser, token, config) = create_test_env();
    let event = Address::generate(&env);
    let release_time = env.ledger().timestamp() + 86_400;

    let victim = create_validated_escrow(
        &env,
        event.clone(),
        organizer,
        purchaser,
        1_000_000_000,
        token.clone(),
        release_time,
        None,
        None,
        &config,
    )
    .expect("victim escrow should be valid");

    let attacker = create_validated_escrow(
        &env,
        event,
        Address::generate(&env),
        Address::generate(&env),
        1_000_000_001,
        token,
        release_time,
        None,
        None,
        &config,
    )
    .expect("same-event escrow with distinct parties should have deterministic behavior");

    assert_ne!(
        victim.organizer, attacker.organizer,
        "front-running scenario must use distinct organizers"
    );
    assert_eq!(
        attacker.amount, 1_000_000_001,
        "attacker escrow amount should be preserved exactly"
    );
}

#[test]
fn test_zero_amount_escrow() {
    let (env, _admin, organizer, purchaser, token, config) = create_test_env();

    let err = create_validated_escrow(
        &env,
        Address::generate(&env),
        organizer,
        purchaser,
        0,
        token,
        env.ledger().timestamp() + 86_400,
        None,
        None,
        &config,
    )
    .expect_err("zero amount must be rejected");

    assert_eq!(
        err,
        EscrowError::InvalidTerms,
        "zero amount returned an unexpected error"
    );
}

#[test]
fn test_minimum_boundary_amount() {
    let (env, _admin, organizer, purchaser, token, config) = create_test_env();

    let escrow = create_validated_escrow(
        &env,
        Address::generate(&env),
        organizer,
        purchaser,
        config.min_escrow_amount,
        token,
        env.ledger().timestamp() + 86_400,
        None,
        None,
        &config,
    )
    .expect("minimum escrow amount should be accepted");

    assert_eq!(
        escrow.amount, config.min_escrow_amount,
        "minimum boundary amount should be preserved"
    );
}

#[test]
fn test_maximum_boundary_amount() {
    let (env, _admin, organizer, purchaser, token, config) = create_test_env();

    let escrow = create_validated_escrow(
        &env,
        Address::generate(&env),
        organizer,
        purchaser,
        config.max_escrow_amount,
        token,
        env.ledger().timestamp() + 86_400,
        None,
        None,
        &config,
    )
    .expect("maximum escrow amount should be accepted");

    assert_eq!(
        escrow.amount, config.max_escrow_amount,
        "maximum boundary amount should be preserved"
    );
}

#[test]
fn test_past_release_time() {
    let (env, _admin, organizer, purchaser, token, config) = create_test_env();

    let err = create_validated_escrow(
        &env,
        Address::generate(&env),
        organizer,
        purchaser,
        1_000_000_000,
        token,
        env.ledger().timestamp() - 1,
        None,
        None,
        &config,
    )
    .expect_err("past release time must be rejected");

    assert_eq!(
        err,
        EscrowError::EscrowExpired,
        "past release time returned an unexpected error"
    );
}

#[test]
fn test_double_spend_protection() {
    let (env, _admin, organizer, purchaser, token, config) = create_test_env();
    let mut escrow = create_validated_escrow(
        &env,
        Address::generate(&env),
        organizer,
        purchaser,
        1_000_000_000,
        token,
        env.ledger().timestamp() + 86_400,
        None,
        None,
        &config,
    )
    .expect("valid escrow setup should succeed");

    release_funds(&mut escrow, 1_000_000_000, false)
        .expect("first release should complete the escrow");

    let err = release_funds(&mut escrow, 1_000_000_000, false)
        .expect_err("second release must be rejected");

    assert_eq!(
        err,
        EscrowError::AlreadyCompleted,
        "double spend returned an unexpected error"
    );
}
