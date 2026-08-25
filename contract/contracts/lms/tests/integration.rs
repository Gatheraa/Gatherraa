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
    AccessError, Course, CourseError, CourseStatus, LmsContract, LmsContractClient, LmsVersion,
    ProgressError, Role, UserRecord,
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
fn staff_can_store_and_retrieve_a_course() {
    let d = deploy_initialized();
    d.client.authorize_instructor(&d.admin, &d.instructor);

    d.env.ledger().with_mut(|ledger| ledger.timestamp = 1234);
    let title = String::from_str(&d.env, "Soroban LMS");
    let description_uri = String::from_str(&d.env, "ipfs://course-description");

    d.client.create_course(
        &d.instructor,
        &7,
        &d.instructor,
        &title,
        &description_uri,
        &5000,
        &12,
    );

    assert_eq!(
        d.client.get_course(&7),
        Some(Course {
            course_id: 7,
            instructor: d.instructor.clone(),
            title,
            description_uri,
            price: 5000,
            status: CourseStatus::Draft,
            created_at: 1234,
            updated_at: 1234,
            total_lessons: 12,
        })
    );
}

#[test]
fn course_ids_are_unique_and_duplicate_creation_preserves_original() {
    let d = deploy_initialized();
    let title = String::from_str(&d.env, "First");
    let description_uri = String::from_str(&d.env, "ipfs://first");

    d.client.create_course(
        &d.admin,
        &9,
        &d.instructor,
        &title,
        &description_uri,
        &100,
        &2,
    );

    let replacement_title = String::from_str(&d.env, "Replacement");
    assert_eq!(
        d.client.try_create_course(
            &d.admin,
            &9,
            &d.instructor,
            &replacement_title,
            &description_uri,
            &200,
            &5,
        ),
        Err(Ok(CourseError::CourseAlreadyExists))
    );

    assert_eq!(d.client.get_course(&9).unwrap().title, title);
    assert_eq!(d.client.get_course(&9).unwrap().price, 100);
}

#[test]
fn an_unregistered_caller_cannot_create_a_course() {
    let d = deploy_initialized();
    let title = String::from_str(&d.env, "Unauthorized");
    let description_uri = String::from_str(&d.env, "ipfs://unauthorized");

    assert_eq!(
        d.client.try_create_course(
            &d.outsider,
            &11,
            &d.instructor,
            &title,
            &description_uri,
            &0,
            &0,
        ),
        Err(Ok(CourseError::UserNotRegistered))
    );
    assert_eq!(d.client.get_course(&11), None);
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
// Lesson Progress Tracking Tests (#647)
// ---------------------------------------------------------------------------

#[test]
fn enrolled_student_marks_lesson_complete_and_tracks_progress() {
    let d = deploy();
    d.client.initialize(&d.admin);
    d.client.authorize_instructor(&d.admin, &d.instructor);
    d.client.register_student(&d.student);

    // Instructor creates a 3-lesson course
    d.client.create_course(
        &d.instructor,
        &1,
        &d.instructor,
        &String::from_str(&d.env, "Rust 101"),
        &String::from_str(&d.env, "ipfs://desc"),
        &0,
        &3,
    );

    // Initial state: no progress
    assert_eq!(d.client.get_lesson_progress(&d.student, &1, &0), None);
    let init_prog = d.client.get_course_progress(&d.student, &1);
    assert_eq!(init_prog.completed_lessons, 0);
    assert_eq!(init_prog.total_lessons, 3);
    assert_eq!(init_prog.basis_points, 0);

    // Student marks lesson 0 complete
    let prog0 = d.client.mark_lesson_complete(&d.student, &1, &0);
    assert_eq!(prog0.student, d.student);
    assert_eq!(prog0.course_id, 1);
    assert_eq!(prog0.lesson_id, 0);
    assert!(prog0.completed);
    assert_eq!(prog0.completed_at, d.env.ledger().timestamp());

    // Lesson progress is persisted
    assert_eq!(
        d.client.get_lesson_progress(&d.student, &1, &0),
        Some(prog0.clone())
    );

    // Course progress is updated (1 of 3 = 3333 bps)
    let cur_prog = d.client.get_course_progress(&d.student, &1);
    assert_eq!(cur_prog.completed_lessons, 1);
    assert_eq!(cur_prog.basis_points, 3_333);

    // Duplicate completion is handled safely (idempotent, returns existing progress)
    let prog0_dup = d.client.mark_lesson_complete(&d.student, &1, &0);
    assert_eq!(prog0, prog0_dup);
    let cur_prog_dup = d.client.get_course_progress(&d.student, &1);
    assert_eq!(cur_prog_dup.completed_lessons, 1);

    // Student completes remaining lessons
    d.client.mark_lesson_complete(&d.student, &1, &1);
    d.client.mark_lesson_complete(&d.student, &1, &2);

    let final_prog = d.client.get_course_progress(&d.student, &1);
    assert_eq!(final_prog.completed_lessons, 3);
    assert_eq!(final_prog.total_lessons, 3);
    assert_eq!(final_prog.basis_points, 10_000);
    assert!(final_prog.is_complete());
}

#[test]
fn unenrolled_user_cannot_mark_lesson_complete() {
    let d = deploy();
    d.client.initialize(&d.admin);
    d.client.authorize_instructor(&d.admin, &d.instructor);

    d.client.create_course(
        &d.instructor,
        &1,
        &d.instructor,
        &String::from_str(&d.env, "Rust 101"),
        &String::from_str(&d.env, "ipfs://desc"),
        &0,
        &3,
    );

    // Outsider (not registered as student) cannot mark lesson complete
    assert_eq!(
        d.client.try_mark_lesson_complete(&d.outsider, &1, &0),
        Err(Ok(ProgressError::NotEnrolled))
    );
}

#[test]
fn mark_lesson_out_of_range_or_nonexistent_course_fails() {
    let d = deploy();
    d.client.initialize(&d.admin);
    d.client.authorize_instructor(&d.admin, &d.instructor);
    d.client.register_student(&d.student);

    d.client.create_course(
        &d.instructor,
        &1,
        &d.instructor,
        &String::from_str(&d.env, "Rust 101"),
        &String::from_str(&d.env, "ipfs://desc"),
        &0,
        &2,
    );

    // Out of range (lesson 2 on 2-lesson course)
    assert_eq!(
        d.client.try_mark_lesson_complete(&d.student, &1, &2),
        Err(Ok(ProgressError::LessonOutOfRange))
    );

    // Unknown course
    assert_eq!(
        d.client.try_mark_lesson_complete(&d.student, &999, &0),
        Err(Ok(ProgressError::CourseNotFound))
    );
}
