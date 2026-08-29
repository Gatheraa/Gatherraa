pub mod errors;
pub mod storage;
pub mod types;

pub use errors::EnrollmentError;
pub use types::{Enrollment, EnrollmentStatus};

use soroban_sdk::{Address, Env};

use crate::access::{AccessControl, Role};
use crate::course::{CourseStatus, Courses};
use crate::events;

/// Enrollment operations for the LMS contract.
pub struct Enrollments;

impl Enrollments {
    /// Enroll a registered student in a published course.
    ///
    /// Students authorize their own enrollment, the same way they authorize
    /// their own registration in the access module.
    ///
    /// Three gates stand between a student and an enrollment record: the
    /// caller must hold the Student role, the course must exist and be
    /// published, and no enrollment record may already exist for the pair.
    /// The first gate is what ties enrollment to registration — a student
    /// who has not registered cannot enroll. The second keeps enrollments
    /// limited to courses that are actually open to students. The third
    /// makes duplicate enrollment impossible: a record, active or not,
    /// blocks a second one.
    ///
    /// # Errors
    /// * `StudentNotRegistered` — the caller holds no Student role
    /// * `CourseNotFound` — no course exists under the identifier
    /// * `CourseNotPublished` — the course is not yet published
    /// * `AlreadyEnrolled` — an enrollment record already exists
    pub fn enroll(env: &Env, student: &Address, course_id: u32) -> Result<(), EnrollmentError> {
        student.require_auth();

        if !AccessControl::has_role(env, student, Role::Student) {
            return Err(EnrollmentError::StudentNotRegistered);
        }

        let course = Courses::get_course(env, course_id).ok_or(EnrollmentError::CourseNotFound)?;
        if course.status != CourseStatus::Published {
            return Err(EnrollmentError::CourseNotPublished);
        }

        if storage::has_enrollment(env, student, course_id) {
            return Err(EnrollmentError::AlreadyEnrolled);
        }

        storage::set_enrollment(
            env,
            &Enrollment {
                student: student.clone(),
                course_id,
                enrolled_at: env.ledger().timestamp(),
                status: EnrollmentStatus::Active,
            },
        );
        events::student_enrolled(env, course_id, student);

        Ok(())
    }

    /// Withdraw a student from a course they are actively enrolled in.
    ///
    /// The record is retained with its status flipped to `Unenrolled`
    /// rather than deleted, so withdrawal history stays queryable through
    /// `get_enrollment`. `is_enrolled` answers false afterwards, and a
    /// withdrawn student who calls `enroll` again is rejected with
    /// `AlreadyEnrolled` — the record still exists, and duplicate
    /// enrollment is rejected whether or not it is active.
    ///
    /// # Errors
    /// * `NotEnrolled` — the student has no active enrollment to withdraw
    pub fn unenroll(env: &Env, student: &Address, course_id: u32) -> Result<(), EnrollmentError> {
        student.require_auth();

        let mut enrollment =
            storage::get_enrollment(env, student, course_id).ok_or(EnrollmentError::NotEnrolled)?;
        if enrollment.status == EnrollmentStatus::Unenrolled {
            return Err(EnrollmentError::NotEnrolled);
        }

        enrollment.status = EnrollmentStatus::Unenrolled;
        storage::set_enrollment(env, &enrollment);
        events::student_unenrolled(env, course_id, student);

        Ok(())
    }

    /// Retrieve the enrollment record for a student and course, if any.
    pub fn get_enrollment(env: &Env, student: &Address, course_id: u32) -> Option<Enrollment> {
        storage::get_enrollment(env, student, course_id)
    }

    /// Whether a student has an active enrollment in a course.
    pub fn is_enrolled(env: &Env, student: &Address, course_id: u32) -> bool {
        storage::get_enrollment(env, student, course_id)
            .map(|enrollment| enrollment.status == EnrollmentStatus::Active)
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::LmsContract;
    use soroban_sdk::testutils::{Address as _, Events};
    use soroban_sdk::{Address, Env, String};

    /// Run one contract call in its own frame.
    ///
    /// These functions touch contract storage, which the host only permits
    /// inside a contract invocation — calling them straight from a test
    /// fails with `Error(Context, InternalError)`, "no contract running".
    ///
    /// Each call also needs its own frame. Two `require_auth()` calls on
    /// the same address within a single frame fail with
    /// `Error(Auth, ExistingValue)`, so one frame per call, matching how
    /// these functions are reached in production: one invocation per
    /// transaction.
    fn call<T>(env: &Env, contract_id: &Address, f: impl FnOnce() -> T) -> T {
        env.as_contract(contract_id, f)
    }

    fn setup() -> (Env, Address, Address, Address, Address, Address) {
        let env = Env::default();
        let contract_id = env.register(LmsContract, ());

        let admin = Address::generate(&env);
        let instructor = Address::generate(&env);
        let student = Address::generate(&env);
        let outsider = Address::generate(&env);

        env.mock_all_auths();

        // The admin role is what lets staff create and publish courses, so
        // initialize it once up front.
        env.as_contract(&contract_id, || {
            crate::access::AccessControl::initialize_admin(&env, &admin).unwrap()
        });

        (env, contract_id, admin, instructor, student, outsider)
    }

    /// Create and publish a course, returning its identifier.
    fn publish_course(env: &Env, id: &Address, admin: &Address, course_id: u32) {
        call(env, id, || {
            crate::course::Courses::create_course(
                env,
                admin,
                course_id,
                admin,
                String::from_str(env, "Course"),
                String::from_str(env, "https://example.com/course"),
                0,
                1,
            )
            .unwrap()
        });
        call(env, id, || {
            crate::course::Courses::publish_course(env, admin, course_id).unwrap()
        });
    }

    #[test]
    fn a_registered_student_can_enroll_in_a_published_course() {
        let (env, id, admin, _, student, _) = setup();

        call(&env, &id, || {
            crate::access::AccessControl::register_student(&env, &student).unwrap()
        });
        publish_course(&env, &id, &admin, 1);

        call(&env, &id, || {
            Enrollments::enroll(&env, &student, 1).unwrap()
        });

        let enrollment = call(&env, &id, || {
            Enrollments::get_enrollment(&env, &student, 1).unwrap()
        });
        assert_eq!(enrollment.student, student);
        assert_eq!(enrollment.course_id, 1);
        assert_eq!(enrollment.status, EnrollmentStatus::Active);
        assert_eq!(enrollment.enrolled_at, env.ledger().timestamp());

        assert!(call(&env, &id, || Enrollments::is_enrolled(
            &env, &student, 1
        )));
    }

    #[test]
    fn an_unregistered_address_cannot_enroll() {
        let (env, id, admin, _, _, outsider) = setup();

        publish_course(&env, &id, &admin, 1);

        assert_eq!(
            call(&env, &id, || Enrollments::enroll(&env, &outsider, 1)),
            Err(EnrollmentError::StudentNotRegistered)
        );
    }

    #[test]
    fn an_instructor_cannot_enroll() {
        let (env, id, admin, instructor, _, _) = setup();

        call(&env, &id, || {
            crate::access::AccessControl::authorize_instructor(&env, &admin, &instructor).unwrap()
        });
        publish_course(&env, &id, &admin, 1);

        assert_eq!(
            call(&env, &id, || Enrollments::enroll(&env, &instructor, 1)),
            Err(EnrollmentError::StudentNotRegistered)
        );
    }

    #[test]
    fn enrollment_in_a_draft_course_is_rejected() {
        let (env, id, admin, _, student, _) = setup();

        call(&env, &id, || {
            crate::access::AccessControl::register_student(&env, &student).unwrap()
        });
        call(&env, &id, || {
            crate::course::Courses::create_course(
                &env,
                &admin,
                1,
                &admin,
                String::from_str(&env, "Course"),
                String::from_str(&env, "https://example.com/course"),
                0,
                1,
            )
            .unwrap()
        });

        assert_eq!(
            call(&env, &id, || Enrollments::enroll(&env, &student, 1)),
            Err(EnrollmentError::CourseNotPublished)
        );
    }

    #[test]
    fn enrollment_in_an_unknown_course_is_rejected() {
        let (env, id, _, _, student, _) = setup();

        call(&env, &id, || {
            crate::access::AccessControl::register_student(&env, &student).unwrap()
        });

        assert_eq!(
            call(&env, &id, || Enrollments::enroll(&env, &student, 42)),
            Err(EnrollmentError::CourseNotFound)
        );
    }

    #[test]
    fn duplicate_enrollment_is_rejected() {
        let (env, id, admin, _, student, _) = setup();

        call(&env, &id, || {
            crate::access::AccessControl::register_student(&env, &student).unwrap()
        });
        publish_course(&env, &id, &admin, 1);

        call(&env, &id, || {
            Enrollments::enroll(&env, &student, 1).unwrap()
        });

        assert_eq!(
            call(&env, &id, || Enrollments::enroll(&env, &student, 1)),
            Err(EnrollmentError::AlreadyEnrolled)
        );
    }

    #[test]
    fn enrolling_emits_a_student_enrolled_event() {
        let (env, id, admin, _, student, _) = setup();

        call(&env, &id, || {
            crate::access::AccessControl::register_student(&env, &student).unwrap()
        });
        publish_course(&env, &id, &admin, 1);

        call(&env, &id, || {
            Enrollments::enroll(&env, &student, 1).unwrap()
        });

        assert_eq!(env.events().all().len(), 1);
    }

    #[test]
    fn unenrolling_marks_the_enrollment_inactive() {
        let (env, id, admin, _, student, _) = setup();

        call(&env, &id, || {
            crate::access::AccessControl::register_student(&env, &student).unwrap()
        });
        publish_course(&env, &id, &admin, 1);
        call(&env, &id, || {
            Enrollments::enroll(&env, &student, 1).unwrap()
        });

        call(&env, &id, || {
            Enrollments::unenroll(&env, &student, 1).unwrap()
        });

        let enrollment = call(&env, &id, || {
            Enrollments::get_enrollment(&env, &student, 1).unwrap()
        });
        assert_eq!(enrollment.status, EnrollmentStatus::Unenrolled);
        assert!(!call(&env, &id, || Enrollments::is_enrolled(
            &env, &student, 1
        )));
    }

    #[test]
    fn unenrolling_twice_is_rejected() {
        let (env, id, admin, _, student, _) = setup();

        call(&env, &id, || {
            crate::access::AccessControl::register_student(&env, &student).unwrap()
        });
        publish_course(&env, &id, &admin, 1);
        call(&env, &id, || {
            Enrollments::enroll(&env, &student, 1).unwrap()
        });
        call(&env, &id, || {
            Enrollments::unenroll(&env, &student, 1).unwrap()
        });

        assert_eq!(
            call(&env, &id, || Enrollments::unenroll(&env, &student, 1)),
            Err(EnrollmentError::NotEnrolled)
        );
    }

    #[test]
    fn unenrolling_without_an_enrollment_is_rejected() {
        let (env, id, _, _, student, _) = setup();

        call(&env, &id, || {
            crate::access::AccessControl::register_student(&env, &student).unwrap()
        });

        assert_eq!(
            call(&env, &id, || Enrollments::unenroll(&env, &student, 1)),
            Err(EnrollmentError::NotEnrolled)
        );
    }

    #[test]
    fn a_withdrawn_student_cannot_enroll_again() {
        let (env, id, admin, _, student, _) = setup();

        call(&env, &id, || {
            crate::access::AccessControl::register_student(&env, &student).unwrap()
        });
        publish_course(&env, &id, &admin, 1);
        call(&env, &id, || {
            Enrollments::enroll(&env, &student, 1).unwrap()
        });
        call(&env, &id, || {
            Enrollments::unenroll(&env, &student, 1).unwrap()
        });

        assert_eq!(
            call(&env, &id, || Enrollments::enroll(&env, &student, 1)),
            Err(EnrollmentError::AlreadyEnrolled)
        );
    }
}
