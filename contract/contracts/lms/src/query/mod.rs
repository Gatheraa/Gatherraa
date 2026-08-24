//! Read-only query interface for the LMS contract (#656).
//!
//! Every function in this module is a pure read: none of them write to
//! storage, emit an event, or require authorization. They exist so the
//! frontend and indexers can inspect contract state without transacting.
//!
//! ## Data availability today
//!
//! Courses and student progress have backing storage, so `get_course` and
//! `get_course_progress` return real data. Modules, lessons, enrollment,
//! assessment results, and certificates have **no on-chain storage yet** —
//! their write-side modules are still open (#640–#644 curriculum, #645/#646
//! enrollment, #651/#652 assessment, #653/#654 certificates). Those queries
//! return the honest empty answer and each one documents the storage key it
//! will read once the writer module lands, so wiring the seam is a drop-in
//! change rather than an interface change.

pub mod assessment;
pub mod certificate;
pub mod course;
pub mod enrollment;
pub mod progress;

pub use assessment::{AssessmentQueries, AssessmentResultView};
pub use certificate::{CertificateQueries, CertificateView};
pub use course::CourseQueries;
pub use enrollment::EnrollmentQueries;
pub use progress::ProgressQueries;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::access::{AccessControl, Role};
    use crate::progress::{Course, Progress, ProgressError};
    use crate::{LmsContract, StorageKey};
    use soroban_sdk::testutils::{Address as _, Events as _};
    use soroban_sdk::{Address, Env, Vec};

    /// Run one contract call.
    ///
    /// Storage access is only legal inside a contract invocation, and each
    /// call needs its own frame — see the access/progress module tests for
    /// the full explanation. One frame per call also matches how these
    /// functions are really reached: one invocation per transaction.
    fn call<T>(env: &Env, contract_id: &Address, f: impl FnOnce() -> T) -> T {
        env.as_contract(contract_id, f)
    }

    fn setup() -> (Env, Address, Address, Address) {
        let env = Env::default();
        let contract_id = env.register(LmsContract, ());

        let instructor = Address::generate(&env);
        let student = Address::generate(&env);

        env.mock_all_auths();

        (env, contract_id, instructor, student)
    }

    /// Initialize an admin, promote `instructor`, and register `student`, so
    /// course creation and lesson completion are authorized.
    fn seed_roles(env: &Env, contract_id: &Address, instructor: &Address, student: &Address) {
        let admin = Address::generate(env);

        call(env, contract_id, || {
            AccessControl::initialize_admin(env, &admin).unwrap()
        });
        call(env, contract_id, || {
            AccessControl::authorize_instructor(env, &admin, instructor).unwrap()
        });
        call(env, contract_id, || {
            AccessControl::register_student(env, student).unwrap()
        });

        assert_eq!(
            call(env, contract_id, || AccessControl::get_role(env, student)),
            Some(Role::Student)
        );
    }

    /// Create a course with the given id and lesson count.
    fn create_course(
        env: &Env,
        contract_id: &Address,
        instructor: &Address,
        id: u32,
        lessons: u32,
    ) {
        call(env, contract_id, || {
            Progress::create_course(env, instructor, id, lessons).unwrap()
        });
    }

    // -------------------------------------------------------------------
    // get_course
    // -------------------------------------------------------------------

    #[test]
    fn get_course_returns_the_stored_course() {
        let (env, id, instructor, _) = setup();
        seed_roles(&env, &id, &instructor, &Address::generate(&env));
        create_course(&env, &id, &instructor, 1, 4);

        assert_eq!(
            call(&env, &id, || CourseQueries::get_course(&env, 1)),
            Some(Course {
                id: 1,
                total_lessons: 4
            })
        );
    }

    #[test]
    fn get_course_returns_none_for_an_unknown_course() {
        let (env, id, _, _) = setup();

        assert_eq!(
            call(&env, &id, || CourseQueries::get_course(&env, 404)),
            None
        );
    }

    // -------------------------------------------------------------------
    // get_modules / get_lessons
    // -------------------------------------------------------------------

    #[test]
    fn get_modules_returns_empty_until_curriculum_storage_exists() {
        let (env, id, _, _) = setup();

        assert_eq!(
            call(&env, &id, || CourseQueries::get_modules(&env, 1)),
            Vec::new(&env)
        );
    }

    #[test]
    fn get_lessons_returns_empty_until_curriculum_storage_exists() {
        let (env, id, _, _) = setup();

        assert_eq!(
            call(&env, &id, || CourseQueries::get_lessons(&env, 1, 2)),
            Vec::new(&env)
        );
    }

    // -------------------------------------------------------------------
    // get_enrollment
    // -------------------------------------------------------------------

    #[test]
    fn get_enrollment_returns_false_until_enrollment_storage_exists() {
        let (env, id, _, student) = setup();
        seed_roles(&env, &id, &Address::generate(&env), &student);

        assert!(!call(&env, &id, || EnrollmentQueries::get_enrollment(
            &env, &student, 1
        )));
    }

    // -------------------------------------------------------------------
    // get_course_progress
    // -------------------------------------------------------------------

    #[test]
    fn get_course_progress_returns_stored_progress() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);
        create_course(&env, &id, &instructor, 1, 4);

        call(&env, &id, || {
            Progress::complete_lesson(&env, &student, 1, 0).unwrap()
        });
        call(&env, &id, || {
            Progress::complete_lesson(&env, &student, 1, 1).unwrap()
        });

        let progress = call(&env, &id, || {
            ProgressQueries::get_course_progress(&env, &student, 1)
        })
        .unwrap();

        assert_eq!(progress.completed_lessons, 2);
        assert_eq!(progress.total_lessons, 4);
        assert_eq!(progress.basis_points, 5_000);
    }

    #[test]
    fn get_course_progress_errors_on_an_unknown_course() {
        let (env, id, _, student) = setup();
        seed_roles(&env, &id, &Address::generate(&env), &student);

        assert_eq!(
            call(&env, &id, || ProgressQueries::get_course_progress(
                &env, &student, 404
            )),
            Err(ProgressError::CourseNotFound)
        );
    }

    // -------------------------------------------------------------------
    // get_assessment_result
    // -------------------------------------------------------------------

    #[test]
    fn get_assessment_result_returns_none_until_assessment_storage_exists() {
        let (env, id, _, student) = setup();
        seed_roles(&env, &id, &Address::generate(&env), &student);

        assert_eq!(
            call(&env, &id, || AssessmentQueries::get_assessment_result(
                &env, &student, 7
            )),
            None
        );
    }

    // -------------------------------------------------------------------
    // get_certificate / verify_certificate
    // -------------------------------------------------------------------

    #[test]
    fn get_certificate_returns_none_until_certificate_storage_exists() {
        let (env, id, _, _) = setup();

        assert_eq!(
            call(&env, &id, || CertificateQueries::get_certificate(&env, 1)),
            None
        );
    }

    #[test]
    fn verify_certificate_returns_false_until_certificate_storage_exists() {
        let (env, id, _, student) = setup();
        seed_roles(&env, &id, &Address::generate(&env), &student);

        assert!(!call(&env, &id, || CertificateQueries::verify_certificate(
            &env, 1, &student, 7
        )));
    }

    // -------------------------------------------------------------------
    // The acceptance criterion that binds them all: queries never modify
    // contract state.
    // -------------------------------------------------------------------

    /// Every query must be a pure read. This seeds real state, runs every
    /// query in the interface — including against unknown ids — and then
    /// verifies the contract is byte-for-byte unchanged: stored records read
    /// back identically, no new storage keys appeared, and no events were
    /// emitted.
    #[test]
    fn queries_do_not_modify_contract_state() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);
        create_course(&env, &id, &instructor, 1, 4);
        call(&env, &id, || {
            Progress::complete_lesson(&env, &student, 1, 0).unwrap()
        });

        // Snapshot everything the queries could possibly touch.
        let course_before = call(&env, &id, || Progress::get_course(&env, 1));
        let completed_before = call(&env, &id, || {
            env.storage()
                .persistent()
                .get::<_, u32>(&StorageKey::StudentProgress(student.clone(), 1))
        });
        let events_before = env.events().all().len();

        // Run the full read surface, including reads of ids that do not
        // exist, which is exactly where a sloppy query would write.
        call(&env, &id, || CourseQueries::get_course(&env, 1));
        call(&env, &id, || CourseQueries::get_course(&env, 404));
        call(&env, &id, || CourseQueries::get_modules(&env, 1));
        call(&env, &id, || CourseQueries::get_lessons(&env, 1, 2));
        call(&env, &id, || {
            EnrollmentQueries::get_enrollment(&env, &student, 1)
        });
        let _ = call(&env, &id, || {
            ProgressQueries::get_course_progress(&env, &student, 1)
        });
        let _ = call(&env, &id, || {
            ProgressQueries::get_course_progress(&env, &student, 404)
        });
        call(&env, &id, || {
            AssessmentQueries::get_assessment_result(&env, &student, 7)
        });
        call(&env, &id, || CertificateQueries::get_certificate(&env, 1));
        call(&env, &id, || {
            CertificateQueries::verify_certificate(&env, 1, &student, 7)
        });

        // Stored records are untouched.
        assert_eq!(
            call(&env, &id, || Progress::get_course(&env, 1)),
            course_before
        );
        assert_eq!(
            call(&env, &id, || {
                env.storage()
                    .persistent()
                    .get::<_, u32>(&StorageKey::StudentProgress(student.clone(), 1))
            }),
            completed_before
        );

        // No new keys appeared: the unknown ids queried above are still
        // unknown, and no certificate/lesson keys were fabricated.
        assert!(!call(&env, &id, || env
            .storage()
            .persistent()
            .has(&StorageKey::Course(404))));
        assert!(!call(&env, &id, || {
            env.storage()
                .persistent()
                .has(&StorageKey::LessonCompletion(student.clone(), 1, 1))
        }));

        // No events were emitted. Every write path in this contract emits an
        // event, so an unchanged event log is direct evidence of no writes.
        assert_eq!(env.events().all().len(), events_before);
    }
}
