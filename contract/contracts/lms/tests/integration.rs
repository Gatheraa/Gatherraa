//! Integration tests for the LMS contract (#657).
//!
//! These differ from the unit tests in `src/` in a way that matters. Unit
//! tests reach the module functions directly and have to fabricate a
//! contract context with `env.as_contract`. These go through
//! `LmsContractClient`, the client Soroban generates from the
//! `#[contractimpl]` block, so every call here is a real contract
//! invocation: its own frame, its own authorization check, dispatched
//! across the contract boundary exactly as an off-chain caller would reach
//! it.
//!
//! That distinction is the point. A function can be correct internally and
//! still be unreachable or wrongly authorized from outside, and only a test
//! that crosses the boundary can tell.
//!
//! Scope note: this file covers the surface that exists today —
//! initialization, access control, and certificate issuance/retrieval
//! (#653). Payment, course completion, completion-gated certificate
//! issuance, and event verification are the remaining tasks on #657, and
//! they are blocked on the modules that implement them: #646 (payment),
//! #650 (course completion), #654 (certificate verification), #655
//! (events). Each should extend this file rather than start a new one.

use lms::{
    AccessError, CertificateError, LmsContract, LmsContractClient, LmsVersion, Role, UserRecord,
};
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{Address, Env, String};

/// A deployed contract plus the four addresses the tests need.
struct Deployment<'a> {
    env: Env,
    client: LmsContractClient<'a>,
    admin: Address,
    instructor: Address,
    student: Address,
    outsider: Address,
}

/// Deploy the contract without initializing it.
fn deploy() -> Deployment<'static> {
    let env = Env::default();
    let contract_id = env.register(LmsContract, ());
    let client = LmsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);
    let student = Address::generate(&env);
    let outsider = Address::generate(&env);

    env.mock_all_auths();

    Deployment {
        env,
        client,
        admin,
        instructor,
        student,
        outsider,
    }
}

/// Deploy and initialize, the normal starting point.
fn deploy_initialized() -> Deployment<'static> {
    let d = deploy();
    d.client.initialize(&d.admin);
    d
}

// ---------------------------------------------------------------------------
// Deployment and initialization
// ---------------------------------------------------------------------------

#[test]
fn a_deployed_contract_answers_before_initialization() {
    let d = deploy();

    // Both of these read no user state, so they must work on a bare
    // deployment. Deployment tooling depends on it.
    assert_eq!(d.client.version(), LmsVersion::V1);
    assert!(!d.client.is_initialized());
}

#[test]
fn initialization_creates_the_first_administrator() {
    let d = deploy();

    d.client.initialize(&d.admin);

    assert!(d.client.is_initialized());
    assert_eq!(d.client.get_role(&d.admin), Some(Role::Admin));
    assert_eq!(
        d.client.get_user(&d.admin),
        Some(UserRecord {
            address: d.admin.clone(),
            role: Role::Admin,
        })
    );
}

/// The authorization boundary that matters most. Initialization is the only
/// route to an administrator role that needs no existing administrator's
/// approval, so it has to be a one-time event. If a second address could
/// initialize, anyone could self-appoint as administrator after launch and
/// then hand out instructor and administrator roles at will.
#[test]
fn a_second_address_cannot_initialize_the_contract() {
    let d = deploy_initialized();

    assert_eq!(
        d.client.try_initialize(&d.outsider),
        Err(Ok(AccessError::AlreadyInitialized))
    );

    // The outsider gained nothing, and the real admin is untouched.
    assert_eq!(d.client.get_role(&d.outsider), None);
    assert_eq!(d.client.get_role(&d.admin), Some(Role::Admin));
}

#[test]
fn re_initializing_with_the_same_admin_is_rejected() {
    let d = deploy_initialized();

    assert_eq!(
        d.client.try_initialize(&d.admin),
        Err(Ok(AccessError::AlreadyInitialized))
    );
}

// ---------------------------------------------------------------------------
// Authorization boundaries
// ---------------------------------------------------------------------------

#[test]
fn an_admin_can_authorize_an_instructor() {
    let d = deploy_initialized();

    d.client.authorize_instructor(&d.admin, &d.instructor);

    assert_eq!(d.client.get_role(&d.instructor), Some(Role::Instructor));
    assert!(d.client.has_role(&d.instructor, &Role::Instructor));
}

#[test]
fn an_admin_can_create_another_admin() {
    let d = deploy_initialized();

    let second_admin = Address::generate(&d.env);

    d.client.register_admin(&d.admin, &second_admin);

    assert_eq!(d.client.get_role(&second_admin), Some(Role::Admin));
}

#[test]
fn a_student_can_register_themselves() {
    let d = deploy_initialized();

    d.client.register_student(&d.student);

    assert_eq!(d.client.get_role(&d.student), Some(Role::Student));
}

#[test]
fn a_student_cannot_authorize_an_instructor() {
    let d = deploy_initialized();

    d.client.register_student(&d.student);

    assert_eq!(
        d.client.try_authorize_instructor(&d.student, &d.instructor),
        Err(Ok(AccessError::AdminRequired))
    );

    assert_eq!(d.client.get_role(&d.instructor), None);
}

#[test]
fn a_student_cannot_create_an_admin() {
    let d = deploy_initialized();

    d.client.register_student(&d.student);

    assert_eq!(
        d.client.try_register_admin(&d.student, &d.outsider),
        Err(Ok(AccessError::AdminRequired))
    );

    assert_eq!(d.client.get_role(&d.outsider), None);
}

#[test]
fn an_instructor_cannot_create_an_admin() {
    let d = deploy_initialized();

    d.client.authorize_instructor(&d.admin, &d.instructor);

    assert_eq!(
        d.client.try_register_admin(&d.instructor, &d.outsider),
        Err(Ok(AccessError::AdminRequired))
    );
}

#[test]
fn an_instructor_cannot_authorize_another_instructor() {
    let d = deploy_initialized();

    d.client.authorize_instructor(&d.admin, &d.instructor);

    let other = Address::generate(&d.env);

    assert_eq!(
        d.client.try_authorize_instructor(&d.instructor, &other),
        Err(Ok(AccessError::AdminRequired))
    );
}

#[test]
fn an_unregistered_caller_cannot_act_as_staff() {
    let d = deploy_initialized();

    // An outsider has no role at all, which is a distinct rejection from
    // having the wrong role.
    assert_eq!(
        d.client
            .try_authorize_instructor(&d.outsider, &d.instructor),
        Err(Ok(AccessError::UserNotRegistered))
    );
}

#[test]
fn an_address_cannot_hold_two_roles() {
    let d = deploy_initialized();

    d.client.register_student(&d.student);

    assert_eq!(
        d.client.try_authorize_instructor(&d.admin, &d.student),
        Err(Ok(AccessError::AlreadyRegistered))
    );

    // The original role survives the rejected upgrade attempt.
    assert_eq!(d.client.get_role(&d.student), Some(Role::Student));
}

/// Authorization is enforced by the host, not merely by the contract's own
/// checks. With auth switched off, an unsigned call aborts rather than
/// returning a contract error.
#[test]
#[should_panic(expected = "Unauthorized function call for address")]
fn an_unsigned_call_is_rejected_by_the_host() {
    let d = deploy_initialized();

    d.env.set_auths(&[]);

    d.client.register_student(&d.student);
}

// ---------------------------------------------------------------------------
// Storage behaviour
// ---------------------------------------------------------------------------

#[test]
fn unknown_addresses_have_no_role_and_no_record() {
    let d = deploy_initialized();

    assert_eq!(d.client.get_role(&d.outsider), None);
    assert_eq!(d.client.get_user(&d.outsider), None);
    assert!(!d.client.has_role(&d.outsider, &Role::Student));
    assert!(!d.client.has_role(&d.outsider, &Role::Instructor));
    assert!(!d.client.has_role(&d.outsider, &Role::Admin));
}

#[test]
fn roles_are_stored_independently_per_address() {
    let d = deploy_initialized();

    d.client.authorize_instructor(&d.admin, &d.instructor);
    d.client.register_student(&d.student);

    assert_eq!(d.client.get_role(&d.admin), Some(Role::Admin));
    assert_eq!(d.client.get_role(&d.instructor), Some(Role::Instructor));
    assert_eq!(d.client.get_role(&d.student), Some(Role::Student));
    assert_eq!(d.client.get_role(&d.outsider), None);
}

#[test]
fn stored_roles_survive_ledger_advancement() {
    let d = deploy_initialized();

    d.client.register_student(&d.student);

    d.env.ledger().with_mut(|ledger| {
        ledger.sequence_number += 100_000;
        ledger.timestamp += 10_000_000;
    });

    // Persistent entries outlive the ledger moving on. If this ever fails,
    // the roles are in the wrong storage durability.
    assert_eq!(d.client.get_role(&d.student), Some(Role::Student));
    assert!(d.client.is_initialized());
}

#[test]
fn a_rejected_call_writes_nothing() {
    let d = deploy_initialized();

    d.client.register_student(&d.student);

    let before = d.client.get_user(&d.student);

    assert_eq!(
        d.client.try_register_admin(&d.student, &d.outsider),
        Err(Ok(AccessError::AdminRequired))
    );

    assert_eq!(d.client.get_user(&d.student), before);
    assert_eq!(d.client.get_role(&d.outsider), None);
}

// ---------------------------------------------------------------------------
// Certificates (#653)
// ---------------------------------------------------------------------------

#[test]
fn staff_can_issue_a_certificate_and_it_can_be_retrieved() {
    let d = deploy_initialized();

    let certificate = d.client.issue_certificate(
        &d.admin,
        &d.student,
        &7,
        &String::from_str(&d.env, "ipfs://cert/1"),
    );

    assert_eq!(certificate.certificate_id, 1);
    assert_eq!(certificate.student, d.student);
    assert_eq!(certificate.course_id, 7);
    assert_eq!(certificate.issued_at, d.env.ledger().timestamp());
    assert_eq!(
        certificate.metadata_uri,
        String::from_str(&d.env, "ipfs://cert/1")
    );

    // Retrieval returns exactly what was issued.
    assert_eq!(d.client.get_certificate(&1), Some(certificate));
}

#[test]
fn an_instructor_can_issue_certificates() {
    let d = deploy_initialized();
    d.client.authorize_instructor(&d.admin, &d.instructor);

    let certificate = d.client.issue_certificate(
        &d.instructor,
        &d.student,
        &7,
        &String::from_str(&d.env, "ipfs://cert/1"),
    );

    assert_eq!(certificate.certificate_id, 1);
    assert_eq!(certificate.student, d.student);
}

#[test]
fn certificate_identifiers_are_unique() {
    let d = deploy_initialized();

    let first = d.client.issue_certificate(
        &d.admin,
        &d.student,
        &1,
        &String::from_str(&d.env, "ipfs://cert/1"),
    );
    let second = d.client.issue_certificate(
        &d.admin,
        &d.student,
        &2,
        &String::from_str(&d.env, "ipfs://cert/2"),
    );

    assert_eq!(first.certificate_id, 1);
    assert_eq!(second.certificate_id, 2);
    assert_ne!(first.certificate_id, second.certificate_id);

    // Both remain independently retrievable.
    assert_eq!(d.client.get_certificate(&1), Some(first));
    assert_eq!(d.client.get_certificate(&2), Some(second));
}

#[test]
fn certificates_are_associated_with_their_student_and_course() {
    let d = deploy_initialized();
    d.client.register_student(&d.student);
    let other = Address::generate(&d.env);

    d.client.issue_certificate(
        &d.admin,
        &d.student,
        &3,
        &String::from_str(&d.env, "ipfs://cert/1"),
    );
    d.client.issue_certificate(
        &d.admin,
        &other,
        &9,
        &String::from_str(&d.env, "ipfs://cert/2"),
    );

    let for_student = d.client.get_certificate(&1).unwrap();
    let for_other = d.client.get_certificate(&2).unwrap();

    assert_eq!(for_student.student, d.student);
    assert_eq!(for_student.course_id, 3);
    assert_eq!(for_other.student, other);
    assert_eq!(for_other.course_id, 9);
}

#[test]
fn only_staff_can_issue_certificates() {
    let d = deploy_initialized();
    d.client.register_student(&d.student);

    // A student cannot mint credentials for themselves or anyone else.
    assert_eq!(
        d.client.try_issue_certificate(
            &d.student,
            &d.student,
            &1,
            &String::from_str(&d.env, "ipfs://cert/1"),
        ),
        Err(Ok(CertificateError::Unauthorized))
    );

    // An unregistered caller is rejected too.
    assert_eq!(
        d.client.try_issue_certificate(
            &d.outsider,
            &d.student,
            &1,
            &String::from_str(&d.env, "ipfs://cert/1"),
        ),
        Err(Ok(CertificateError::Unauthorized))
    );

    // Neither rejected call stored anything.
    assert_eq!(d.client.get_certificate(&1), None);
}

#[test]
fn an_empty_metadata_uri_is_rejected_and_consumes_no_identifier() {
    let d = deploy_initialized();

    assert_eq!(
        d.client
            .try_issue_certificate(&d.admin, &d.student, &1, &String::from_str(&d.env, ""),),
        Err(Ok(CertificateError::InvalidMetadataUri))
    );

    // Nothing was stored by the rejected call...
    assert_eq!(d.client.get_certificate(&1), None);

    // ...and the counter was not consumed: the next valid issuance still
    // gets identifier 1.
    let certificate = d.client.issue_certificate(
        &d.admin,
        &d.student,
        &1,
        &String::from_str(&d.env, "ipfs://cert/1"),
    );
    assert_eq!(certificate.certificate_id, 1);
}

#[test]
fn retrieval_of_an_unknown_certificate_is_none() {
    let d = deploy_initialized();

    d.client.issue_certificate(
        &d.admin,
        &d.student,
        &1,
        &String::from_str(&d.env, "ipfs://cert/1"),
    );

    assert_eq!(d.client.get_certificate(&404), None);
}

#[test]
fn issued_certificates_survive_ledger_advancement() {
    let d = deploy_initialized();

    let certificate = d.client.issue_certificate(
        &d.admin,
        &d.student,
        &1,
        &String::from_str(&d.env, "ipfs://cert/1"),
    );

    d.env.ledger().with_mut(|ledger| {
        ledger.sequence_number += 100_000;
        ledger.timestamp += 10_000_000;
    });

    // Certificate records live in persistent storage, so they outlive the
    // ledger moving on.
    assert_eq!(
        d.client.get_certificate(&certificate.certificate_id),
        Some(certificate)
    );
}

// ---------------------------------------------------------------------------
// A full lifecycle, end to end
// ---------------------------------------------------------------------------

#[test]
fn a_complete_deployment_lifecycle() {
    let d = deploy();

    // 1. Deployed, not yet initialized.
    assert!(!d.client.is_initialized());
    assert_eq!(d.client.version(), LmsVersion::V1);

    // 2. Initialized by the deployer.
    d.client.initialize(&d.admin);
    assert!(d.client.is_initialized());

    // 3. Staff are onboarded by the admin.
    d.client.authorize_instructor(&d.admin, &d.instructor);

    // 4. A learner self-enrolls.
    d.client.register_student(&d.student);

    // 5. Everyone holds exactly the role they should, and nobody else
    //    holds anything.
    assert_eq!(d.client.get_role(&d.admin), Some(Role::Admin));
    assert_eq!(d.client.get_role(&d.instructor), Some(Role::Instructor));
    assert_eq!(d.client.get_role(&d.student), Some(Role::Student));
    assert_eq!(d.client.get_role(&d.outsider), None);

    // 6. The initialization door stays shut behind them.
    assert_eq!(
        d.client.try_initialize(&d.outsider),
        Err(Ok(AccessError::AlreadyInitialized))
    );
}
