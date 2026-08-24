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
//! initialization and access control. Payment, course completion,
//! certificate issuance, and event verification are the remaining tasks on
//! #657, and they are blocked on the modules that implement them: #646
//! (payment), #650 (course completion), #653 and #654 (certificates), #655
//! (events). Each should extend this file rather than start a new one.

use lms::{
    AccessError, Course, CourseProgress, LmsContract, LmsContractClient, LmsVersion, Progress,
    ProgressError, Role, StorageKey, UserRecord,
};
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{Address, Env};

/// A deployed contract plus the four addresses the tests need.
struct Deployment<'a> {
    env: Env,
    client: LmsContractClient<'a>,
    contract_id: Address,
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
        contract_id,
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

// ---------------------------------------------------------------------------
// Read / query interface (#656)
// ---------------------------------------------------------------------------
//
// The course/progress queries read real storage, so these tests seed it
// through the internal `Progress` service (course creation is not yet on the
// public surface) and then read it back across the contract boundary.
// Everything else returns the honest empty answer documented in the query
// module, which is also asserted here.

/// Seed a course and one completed lesson through the internal progress
/// service, exactly as the course-management module will once it lands.
fn seed_course_with_progress(d: &Deployment<'_>) {
    d.env.as_contract(&d.contract_id, || {
        Progress::create_course(&d.env, &d.instructor, 1, 4).unwrap();
        Progress::complete_lesson(&d.env, &d.student, 1, 0).unwrap();
    });
}

#[test]
fn get_course_returns_the_stored_course_across_the_boundary() {
    let d = deploy_initialized();
    d.client.authorize_instructor(&d.admin, &d.instructor);
    d.client.register_student(&d.student);

    seed_course_with_progress(&d);

    assert_eq!(
        d.client.get_course(&1),
        Some(Course {
            id: 1,
            total_lessons: 4
        })
    );
    assert_eq!(d.client.get_course(&404), None);
}

#[test]
fn get_course_progress_returns_stored_progress_across_the_boundary() {
    let d = deploy_initialized();
    d.client.authorize_instructor(&d.admin, &d.instructor);
    d.client.register_student(&d.student);

    seed_course_with_progress(&d);

    assert_eq!(
        d.client.get_course_progress(&d.student, &1),
        CourseProgress {
            completed_lessons: 1,
            total_lessons: 4,
            basis_points: 2_500,
        }
    );

    // An unknown course is an error, not an empty result.
    assert_eq!(
        d.client.try_get_course_progress(&d.student, &404),
        Err(Ok(ProgressError::CourseNotFound))
    );
}

#[test]
fn queries_without_backing_storage_return_honest_empty_answers() {
    let d = deploy_initialized();
    d.client.register_student(&d.student);

    // Curriculum storage does not exist on-chain yet (#640–#644).
    assert_eq!(d.client.get_modules(&1), soroban_sdk::Vec::new(&d.env));
    assert_eq!(d.client.get_lessons(&1, &2), soroban_sdk::Vec::new(&d.env));

    // Enrollment storage does not exist on-chain yet (#645/#646).
    assert!(!d.client.get_enrollment(&d.student, &1));

    // Assessment storage is not wired into the contract yet (#651/#652).
    assert_eq!(d.client.get_assessment_result(&d.student, &7), None);

    // Certificate storage does not exist on-chain yet (#653/#654).
    assert_eq!(d.client.get_certificate(&1), None);
    assert!(!d.client.verify_certificate(&1, &d.student, &7));
}

#[test]
fn queries_across_the_boundary_do_not_modify_contract_state() {
    let d = deploy_initialized();
    d.client.authorize_instructor(&d.admin, &d.instructor);
    d.client.register_student(&d.student);
    seed_course_with_progress(&d);

    // The full read surface, including unknown ids.
    d.client.get_course(&1);
    d.client.get_course(&404);
    d.client.get_modules(&1);
    d.client.get_lessons(&1, &2);
    d.client.get_enrollment(&d.student, &1);
    d.client.get_course_progress(&d.student, &1);
    // The erroring read must go through `try_` — the plain client method
    // panics on a contract error, which is exactly the point: it is still a
    // read, so it must not write anything either.
    assert_eq!(
        d.client.try_get_course_progress(&d.student, &404),
        Err(Ok(ProgressError::CourseNotFound))
    );
    d.client.get_assessment_result(&d.student, &7);
    d.client.get_certificate(&1);
    d.client.verify_certificate(&1, &d.student, &7);

    // Stored state is unchanged: the course and the progress record read
    // back exactly as seeded.
    assert_eq!(
        d.client.get_course(&1),
        Some(Course {
            id: 1,
            total_lessons: 4
        })
    );
    assert_eq!(
        d.client.get_course_progress(&d.student, &1),
        CourseProgress {
            completed_lessons: 1,
            total_lessons: 4,
            basis_points: 2_500,
        }
    );

    // No new keys appeared. The unknown course and the lesson the student
    // never completed must still read as absent after the queries above.
    let course_404_absent = d.env.as_contract(&d.contract_id, || {
        d.env.storage().persistent().has(&StorageKey::Course(404))
    });
    let lesson_1_absent = d.env.as_contract(&d.contract_id, || {
        d.env.storage()
            .persistent()
            .has(&StorageKey::LessonCompletion(d.student.clone(), 1, 1))
    });
    assert!(!course_404_absent);
    assert!(!lesson_1_absent);
}
