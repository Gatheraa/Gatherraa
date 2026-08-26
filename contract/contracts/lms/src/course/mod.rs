pub mod errors;
pub mod storage;
pub mod types;

pub use errors::CourseError;
pub use types::CourseStatus;

use soroban_sdk::{Address, Env};

use crate::access::AccessControl;
use crate::events;
use crate::progress::storage as progress_storage;

/// Course lifecycle operations for the LMS contract.
pub struct CourseLifecycle;

impl CourseLifecycle {
    /// Move a course from Draft to Published.
    ///
    /// This is the only way a course becomes available to students, and it
    /// only works once: publishing an already-published course, or trying
    /// to resurrect an archived one, is rejected rather than silently
    /// tolerated. An archived course is a historical record — letting it
    /// come back would change what past enrollments and certificates
    /// referred to.
    ///
    /// # Errors
    /// * `NotAuthorized` — the caller is not staff
    /// * `CourseNotFound` — no course is registered under `course_id`
    /// * `InvalidTransition` — the course is not in the Draft state
    pub fn publish_course(env: &Env, caller: &Address, course_id: u32) -> Result<(), CourseError> {
        Self::require_staff(env, caller)?;

        let course =
            progress_storage::get_course(env, course_id).ok_or(CourseError::CourseNotFound)?;

        if course.status != CourseStatus::Draft {
            return Err(CourseError::InvalidTransition);
        }

        storage::set_status(env, course_id, CourseStatus::Published);
        events::course_published(env, course_id, caller);

        Ok(())
    }

    /// Move a course from Published to Archived.
    ///
    /// Archiving is the end of the lifecycle. A draft must be published
    /// before it can be archived — withdrawing something that never went
    /// live has no meaning here and would leave students who somehow saw
    /// the draft with a record of a course that officially never existed.
    /// An archived course cannot be archived again or re-published.
    ///
    /// # Errors
    /// * `NotAuthorized` — the caller is not staff
    /// * `CourseNotFound` — no course is registered under `course_id`
    /// * `InvalidTransition` — the course is not in the Published state
    pub fn archive_course(env: &Env, caller: &Address, course_id: u32) -> Result<(), CourseError> {
        Self::require_staff(env, caller)?;

        let course =
            progress_storage::get_course(env, course_id).ok_or(CourseError::CourseNotFound)?;

        if course.status != CourseStatus::Published {
            return Err(CourseError::InvalidTransition);
        }

        storage::set_status(env, course_id, CourseStatus::Archived);
        events::course_archived(env, course_id, caller);

        Ok(())
    }

    /// Change a course's lesson count.
    ///
    /// Allowed while the course is a draft (normal authoring) and while it
    /// is published (instructors routinely correct content after launch).
    /// Rejected for archived courses: they are read-only by definition.
    ///
    /// Lowering the count below lessons students have already completed is
    /// deliberately permitted. Progress reporting clamps against the new
    /// total, and completion already recorded stays recorded; refusing the
    /// edit instead would trap a mistyped lesson count forever.
    ///
    /// # Errors
    /// * `NotAuthorized` — the caller is not staff
    /// * `CourseNotFound` — no course is registered under `course_id`
    /// * `InvalidTransition` — the course is archived
    pub fn update_course(
        env: &Env,
        caller: &Address,
        course_id: u32,
        total_lessons: u32,
    ) -> Result<(), CourseError> {
        Self::require_staff(env, caller)?;

        let course =
            progress_storage::get_course(env, course_id).ok_or(CourseError::CourseNotFound)?;

        if course.status == CourseStatus::Archived {
            return Err(CourseError::InvalidTransition);
        }

        storage::set_total_lessons(env, course_id, total_lessons);

        Ok(())
    }

    /// Look up a course's current lifecycle state.
    pub fn get_status(env: &Env, course_id: u32) -> Option<CourseStatus> {
        storage::get_status(env, course_id)
    }

    /// Gate every lifecycle operation behind instructor-or-admin.
    ///
    /// The access module's error type carries more detail (registered but
    /// wrong role vs. unregistered) than this module's single
    /// `NotAuthorized`, so the distinction collapses here. Callers who need
    /// it can consult `get_role` directly; what matters for the lifecycle
    /// is only that non-staff are rejected before any state is read.
    fn require_staff(env: &Env, caller: &Address) -> Result<(), CourseError> {
        AccessControl::require_staff(env, caller).map_err(|_| CourseError::NotAuthorized)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::access::AccessControl;
    use crate::LmsContract;
    use soroban_sdk::testutils::Address as _;

    /// Run one contract call in its own frame.
    ///
    /// Storage access is only legal inside a contract invocation, and two
    /// `require_auth()` calls in one frame fail with "frame is already
    /// authorized", so each operation gets its own `as_contract` block.
    fn call<T>(env: &Env, contract_id: &Address, f: impl FnOnce() -> T) -> T {
        env.as_contract(contract_id, f)
    }

    struct Fixture {
        env: Env,
        contract_id: Address,
        admin: Address,
        instructor: Address,
        student: Address,
    }

    fn setup() -> Fixture {
        let env = Env::default();
        let contract_id = env.register(LmsContract, ());
        let admin = Address::generate(&env);
        let instructor = Address::generate(&env);
        let student = Address::generate(&env);

        env.mock_all_auths();

        call(&env, &contract_id, || {
            AccessControl::initialize_admin(&env, &admin).unwrap()
        });
        call(&env, &contract_id, || {
            AccessControl::authorize_instructor(&env, &admin, &instructor).unwrap()
        });
        call(&env, &contract_id, || {
            AccessControl::register_student(&env, &student).unwrap()
        });

        // Create one course as the instructor; it starts as a draft.
        call(&env, &contract_id, || {
            crate::progress::Progress::create_course(&env, &instructor, 1, 4).unwrap()
        });

        Fixture {
            env,
            contract_id,
            admin,
            instructor,
            student,
        }
    }

    #[test]
    fn a_new_course_starts_as_a_draft() {
        let f = setup();

        assert_eq!(
            call(&f.env, &f.contract_id, || CourseLifecycle::get_status(
                &f.env, 1
            )),
            Some(CourseStatus::Draft)
        );
    }

    #[test]
    fn an_unknown_course_has_no_status() {
        let f = setup();

        assert_eq!(
            call(&f.env, &f.contract_id, || CourseLifecycle::get_status(
                &f.env, 99
            )),
            None
        );
    }

    #[test]
    fn full_lifecycle_walks_draft_published_archived() {
        let f = setup();

        call(&f.env, &f.contract_id, || {
            CourseLifecycle::publish_course(&f.env, &f.instructor, 1).unwrap()
        });
        assert_eq!(
            call(&f.env, &f.contract_id, || CourseLifecycle::get_status(
                &f.env, 1
            )),
            Some(CourseStatus::Published)
        );

        call(&f.env, &f.contract_id, || {
            CourseLifecycle::archive_course(&f.env, &f.instructor, 1).unwrap()
        });
        assert_eq!(
            call(&f.env, &f.contract_id, || CourseLifecycle::get_status(
                &f.env, 1
            )),
            Some(CourseStatus::Archived)
        );
    }

    #[test]
    fn an_admin_can_drive_the_same_lifecycle_as_an_instructor() {
        let f = setup();

        call(&f.env, &f.contract_id, || {
            CourseLifecycle::publish_course(&f.env, &f.admin, 1).unwrap()
        });
        call(&f.env, &f.contract_id, || {
            CourseLifecycle::archive_course(&f.env, &f.admin, 1).unwrap()
        });

        assert_eq!(
            call(&f.env, &f.contract_id, || CourseLifecycle::get_status(
                &f.env, 1
            )),
            Some(CourseStatus::Archived)
        );
    }

    #[test]
    fn a_student_cannot_modify_a_course() {
        let f = setup();

        let err = call(&f.env, &f.contract_id, || {
            CourseLifecycle::publish_course(&f.env, &f.student, 1).unwrap_err()
        });
        assert_eq!(err, CourseError::NotAuthorized);

        let err = call(&f.env, &f.contract_id, || {
            CourseLifecycle::update_course(&f.env, &f.student, 1, 9).unwrap_err()
        });
        assert_eq!(err, CourseError::NotAuthorized);

        let err = call(&f.env, &f.contract_id, || {
            CourseLifecycle::archive_course(&f.env, &f.student, 1).unwrap_err()
        });
        assert_eq!(err, CourseError::NotAuthorized);

        // Nothing changed.
        assert_eq!(
            call(&f.env, &f.contract_id, || CourseLifecycle::get_status(
                &f.env, 1
            )),
            Some(CourseStatus::Draft)
        );
    }

    #[test]
    fn an_unregistered_address_cannot_modify_a_course() {
        let f = setup();
        let outsider = Address::generate(&f.env);

        let err = call(&f.env, &f.contract_id, || {
            CourseLifecycle::publish_course(&f.env, &outsider, 1).unwrap_err()
        });
        assert_eq!(err, CourseError::NotAuthorized);
    }

    #[test]
    fn operations_on_an_unknown_course_report_it() {
        let f = setup();

        let err = call(&f.env, &f.contract_id, || {
            CourseLifecycle::publish_course(&f.env, &f.instructor, 99).unwrap_err()
        });
        assert_eq!(err, CourseError::CourseNotFound);

        let err = call(&f.env, &f.contract_id, || {
            CourseLifecycle::archive_course(&f.env, &f.instructor, 99).unwrap_err()
        });
        assert_eq!(err, CourseError::CourseNotFound);

        let err = call(&f.env, &f.contract_id, || {
            CourseLifecycle::update_course(&f.env, &f.instructor, 99, 2).unwrap_err()
        });
        assert_eq!(err, CourseError::CourseNotFound);
    }

    #[test]
    fn a_published_course_cannot_be_published_again() {
        let f = setup();

        call(&f.env, &f.contract_id, || {
            CourseLifecycle::publish_course(&f.env, &f.instructor, 1).unwrap()
        });

        let err = call(&f.env, &f.contract_id, || {
            CourseLifecycle::publish_course(&f.env, &f.instructor, 1).unwrap_err()
        });
        assert_eq!(err, CourseError::InvalidTransition);
    }

    #[test]
    fn a_draft_cannot_be_archived_without_being_published_first() {
        let f = setup();

        let err = call(&f.env, &f.contract_id, || {
            CourseLifecycle::archive_course(&f.env, &f.instructor, 1).unwrap_err()
        });
        assert_eq!(err, CourseError::InvalidTransition);

        assert_eq!(
            call(&f.env, &f.contract_id, || CourseLifecycle::get_status(
                &f.env, 1
            )),
            Some(CourseStatus::Draft)
        );
    }

    #[test]
    fn an_archived_course_is_frozen() {
        let f = setup();

        call(&f.env, &f.contract_id, || {
            CourseLifecycle::publish_course(&f.env, &f.instructor, 1).unwrap()
        });
        call(&f.env, &f.contract_id, || {
            CourseLifecycle::archive_course(&f.env, &f.instructor, 1).unwrap()
        });

        // No re-publication...
        let err = call(&f.env, &f.contract_id, || {
            CourseLifecycle::publish_course(&f.env, &f.instructor, 1).unwrap_err()
        });
        assert_eq!(err, CourseError::InvalidTransition);

        // ...no re-archiving...
        let err = call(&f.env, &f.contract_id, || {
            CourseLifecycle::archive_course(&f.env, &f.instructor, 1).unwrap_err()
        });
        assert_eq!(err, CourseError::InvalidTransition);

        // ...and no content edits.
        let err = call(&f.env, &f.contract_id, || {
            CourseLifecycle::update_course(&f.env, &f.instructor, 1, 7).unwrap_err()
        });
        assert_eq!(err, CourseError::InvalidTransition);

        assert_eq!(
            call(&f.env, &f.contract_id, || CourseLifecycle::get_status(
                &f.env, 1
            )),
            Some(CourseStatus::Archived)
        );
    }

    #[test]
    fn updates_are_allowed_while_draft_and_published_but_change_nothing_else() {
        let f = setup();

        call(&f.env, &f.contract_id, || {
            CourseLifecycle::update_course(&f.env, &f.instructor, 1, 6).unwrap()
        });

        call(&f.env, &f.contract_id, || {
            CourseLifecycle::publish_course(&f.env, &f.instructor, 1).unwrap()
        });
        call(&f.env, &f.contract_id, || {
            CourseLifecycle::update_course(&f.env, &f.admin, 1, 5).unwrap()
        });

        let course = call(&f.env, &f.contract_id, || {
            progress_storage::get_course(&f.env, 1)
        })
        .unwrap();
        assert_eq!(course.total_lessons, 5);
        assert_eq!(course.status, CourseStatus::Published);
        assert_eq!(course.id, 1);
pub use types::{Course, CourseStatus};

use soroban_sdk::{Address, Env, String};

use crate::access::AccessControl;

/// Course management operations for the LMS contract.
pub struct Courses;

impl Courses {
    /// Create and persist a draft course for an authorized staff member.
    pub fn create_course(
        env: &Env,
        caller: &Address,
        course_id: u32,
        instructor: &Address,
        title: String,
        description_uri: String,
        price: i128,
        total_lessons: u32,
    ) -> Result<(), CourseError> {
        AccessControl::require_staff(env, caller).map_err(|error| match error {
            crate::access::AccessError::UserNotRegistered => CourseError::UserNotRegistered,
            _ => CourseError::Unauthorized,
        })?;

        if storage::has_course(env, course_id) {
            return Err(CourseError::CourseAlreadyExists);
        }

        let timestamp = env.ledger().timestamp();
        storage::set_course(
            env,
            &Course {
                course_id,
                instructor: instructor.clone(),
                title,
                description_uri,
                price,
                status: CourseStatus::Draft,
                created_at: timestamp,
                updated_at: timestamp,
                total_lessons,
            },
        );

        Ok(())
    }

    /// Retrieve a course by its unique identifier.
    pub fn get_course(env: &Env, course_id: u32) -> Option<Course> {
        storage::get_course(env, course_id)
    }
}
