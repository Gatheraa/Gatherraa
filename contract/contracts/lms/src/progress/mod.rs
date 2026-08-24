pub mod errors;
pub mod storage;
pub mod types;

pub use errors::ProgressError;
pub use types::{Course, CourseProgress, COMPLETE_BASIS_POINTS};

use soroban_sdk::{Address, Env};

use crate::access::AccessControl;
use crate::events;

/// Course progress operations for the LMS contract.
pub struct Progress;

impl Progress {
    /// Register a course with a fixed number of lessons.
    ///
    /// Only staff — administrators and instructors — may create courses,
    /// matching how the access module gates the rest of course
    /// administration.
    ///
    /// `total_lessons` may be zero. An empty course is a legitimate state
    /// for a course still being authored, and progress reporting handles
    /// it without dividing by zero.
    ///
    /// Every course is born a draft; only the course-lifecycle module moves
    /// it onward from there, so a course can never skip its authoring phase
    /// by accident of how it was created.
    pub fn create_course(
        env: &Env,
        caller: &Address,
        course_id: u32,
        total_lessons: u32,
    ) -> Result<(), ProgressError> {
        AccessControl::require_staff(env, caller).map_err(|_| ProgressError::CourseNotFound)?;

        if storage::has_course(env, course_id) {
            return Err(ProgressError::CourseAlreadyExists);
        }

        storage::set_course(
            env,
            &Course {
                id: course_id,
                total_lessons,
                status: crate::course::CourseStatus::Draft,
            },
        );
        events::course_created(env, course_id, caller, total_lessons);

        Ok(())
    }

    /// Look up a registered course.
    pub fn get_course(env: &Env, course_id: u32) -> Option<Course> {
        storage::get_course(env, course_id)
    }

    /// Record that a student has completed one lesson of a course.
    ///
    /// Students authorize their own lesson completions, the same way they
    /// authorize their own registration in the access module.
    ///
    /// The lesson index is checked against the course length, and a lesson
    /// already marked complete is rejected rather than counted twice.
    /// Together those two checks are what bound the completed count at the
    /// course length, so reported progress can never exceed 100%.
    pub fn complete_lesson(
        env: &Env,
        student: &Address,
        course_id: u32,
        lesson_index: u32,
    ) -> Result<(), ProgressError> {
        student.require_auth();

        let course = storage::get_course(env, course_id).ok_or(ProgressError::CourseNotFound)?;

        // Lessons are zero-indexed, so the valid range is 0..total_lessons.
        // An empty course has no valid index at all, which this rejects.
        if lesson_index >= course.total_lessons {
            return Err(ProgressError::LessonOutOfRange);
        }

        if storage::is_lesson_completed(env, student, course_id, lesson_index) {
            return Err(ProgressError::LessonAlreadyCompleted);
        }

        storage::set_lesson_completed(env, student, course_id, lesson_index);

        let completed = storage::get_completed_count(env, student, course_id);
        storage::set_completed_count(env, student, course_id, completed + 1);
        events::lesson_completed(env, course_id, lesson_index, student);

        if completed + 1 == course.total_lessons {
            events::course_completed(env, course_id, student);
        }

        Ok(())
    }

    /// Returns whether a student has completed one specific lesson.
    pub fn is_lesson_completed(
        env: &Env,
        student: &Address,
        course_id: u32,
        lesson_index: u32,
    ) -> bool {
        storage::is_lesson_completed(env, student, course_id, lesson_index)
    }

    /// Calculate a student's progress through a course.
    ///
    /// Progress is `completed_lessons / total_lessons`, returned as raw
    /// counts plus a basis-point figure so the caller can choose between
    /// the exact fraction and the rounded percentage.
    ///
    /// The result is a pure function of stored state: the same student,
    /// course, and completion set always produce the same answer, with no
    /// dependence on ledger time or sequence.
    ///
    /// # Errors
    /// * `CourseNotFound` — no course is registered under `course_id`
    pub fn get_course_progress(
        env: &Env,
        student: &Address,
        course_id: u32,
    ) -> Result<CourseProgress, ProgressError> {
        let course = storage::get_course(env, course_id).ok_or(ProgressError::CourseNotFound)?;

        let completed_lessons = storage::get_completed_count(env, student, course_id);

        Ok(CourseProgress {
            completed_lessons,
            total_lessons: course.total_lessons,
            basis_points: Self::basis_points(completed_lessons, course.total_lessons),
        })
    }

    /// Convert a completed/total pair into basis points.
    ///
    /// A course with no lessons reports zero rather than full completion.
    /// Nothing in it has been completed, and reporting 10_000 would let an
    /// empty course confer whatever completion unlocks downstream.
    ///
    /// The division is done in `u64` because `completed * 10_000` overflows
    /// `u32` for courses beyond roughly 429_496 lessons. The workspace
    /// release profile sets `overflow-checks = true`, so that would be a
    /// panic in a deployed contract rather than a silent wrap.
    ///
    /// Truncating toward zero is deliberate: for any `completed < total`
    /// the result is strictly below `COMPLETE_BASIS_POINTS`, so a course
    /// that is nearly finished can never round up to look finished.
    fn basis_points(completed: u32, total: u32) -> u32 {
        if total == 0 {
            return 0;
        }

        let scaled = (completed as u64) * (COMPLETE_BASIS_POINTS as u64) / (total as u64);

        scaled as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::access::Role;
    use crate::LmsContract;
    use soroban_sdk::testutils::{Address as _, Ledger as _};
    use soroban_sdk::{Address, Env};

    /// Run one contract call.
    ///
    /// Two things make this wrapper necessary rather than decorative.
    ///
    /// Storage access is only legal inside a contract invocation, so the
    /// module functions cannot be called straight from a test — the host
    /// rejects it with "no contract running".
    ///
    /// And each call needs its *own* frame. Calling `require_auth()` twice
    /// for the same address inside one frame fails with
    /// `Error(Auth, ExistingValue)` — "frame is already authorized" — so
    /// batching several operations into a single `as_contract` block would
    /// fail for reasons that have nothing to do with the code under test.
    /// One frame per call also matches how these functions are really
    /// reached: one invocation per transaction.
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

    /// Register an admin, promote `instructor`, and register `student`, so
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

    /// Create a course and return its identifier.
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

    fn progress_of(
        env: &Env,
        contract_id: &Address,
        student: &Address,
        course_id: u32,
    ) -> Result<CourseProgress, ProgressError> {
        call(env, contract_id, || {
            Progress::get_course_progress(env, student, course_id)
        })
    }

    fn complete(
        env: &Env,
        contract_id: &Address,
        student: &Address,
        course_id: u32,
        lesson_index: u32,
    ) -> Result<(), ProgressError> {
        call(env, contract_id, || {
            Progress::complete_lesson(env, student, course_id, lesson_index)
        })
    }

    #[test]
    fn creates_a_course() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 1, 4);

        assert_eq!(
            call(&env, &id, || Progress::get_course(&env, 1)),
            Some(Course {
                id: 1,
                total_lessons: 4,
                status: crate::course::CourseStatus::Draft
            })
        );
    }

    #[test]
    fn duplicate_course_is_rejected() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 1, 4);

        assert_eq!(
            call(&env, &id, || Progress::create_course(
                &env,
                &instructor,
                1,
                9
            )),
            Err(ProgressError::CourseAlreadyExists)
        );

        // The original course is untouched by the rejected call.
        assert_eq!(
            call(&env, &id, || Progress::get_course(&env, 1))
                .unwrap()
                .total_lessons,
            4
        );
    }

    #[test]
    fn progress_on_an_unknown_course_is_an_error() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        assert_eq!(
            progress_of(&env, &id, &student, 404),
            Err(ProgressError::CourseNotFound)
        );
    }

    #[test]
    fn zero_percent_before_any_lesson_is_completed() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 1, 4);

        let progress = progress_of(&env, &id, &student, 1).unwrap();

        assert_eq!(progress.completed_lessons, 0);
        assert_eq!(progress.total_lessons, 4);
        assert_eq!(progress.basis_points, 0);
        assert!(!progress.is_complete());
    }

    #[test]
    fn progress_updates_after_each_lesson_completion() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 1, 4);

        for (lesson_index, expected_bps) in [(0u32, 2_500u32), (1, 5_000), (2, 7_500), (3, 10_000)]
        {
            complete(&env, &id, &student, 1, lesson_index).unwrap();

            let progress = progress_of(&env, &id, &student, 1).unwrap();

            assert_eq!(progress.completed_lessons, lesson_index + 1);
            assert_eq!(progress.basis_points, expected_bps);
        }
    }

    #[test]
    fn one_hundred_percent_when_every_lesson_is_complete() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 1, 3);

        for lesson_index in 0..3 {
            complete(&env, &id, &student, 1, lesson_index).unwrap();
        }

        let progress = progress_of(&env, &id, &student, 1).unwrap();

        assert_eq!(progress.completed_lessons, 3);
        assert_eq!(progress.total_lessons, 3);
        assert_eq!(progress.basis_points, COMPLETE_BASIS_POINTS);
        assert!(progress.is_complete());
    }

    #[test]
    fn an_empty_course_reports_zero_not_full_completion() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 7, 0);

        let progress = progress_of(&env, &id, &student, 7).unwrap();

        assert_eq!(progress.completed_lessons, 0);
        assert_eq!(progress.total_lessons, 0);
        assert_eq!(progress.basis_points, 0);

        // The important half: an empty course must not read as finished.
        assert!(!progress.is_complete());
    }

    #[test]
    fn an_empty_course_has_no_completable_lesson() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 7, 0);

        assert_eq!(
            complete(&env, &id, &student, 7, 0),
            Err(ProgressError::LessonOutOfRange)
        );
    }

    #[test]
    fn a_lesson_past_the_end_of_the_course_is_rejected() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 1, 3);

        // Lessons are zero-indexed, so index 3 is one past the end.
        assert_eq!(
            complete(&env, &id, &student, 1, 3),
            Err(ProgressError::LessonOutOfRange)
        );
        assert_eq!(
            complete(&env, &id, &student, 1, u32::MAX),
            Err(ProgressError::LessonOutOfRange)
        );

        // Neither rejected call recorded anything.
        assert_eq!(
            progress_of(&env, &id, &student, 1)
                .unwrap()
                .completed_lessons,
            0
        );
    }

    #[test]
    fn completing_the_same_lesson_twice_is_rejected_and_does_not_double_count() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 1, 4);

        complete(&env, &id, &student, 1, 0).unwrap();

        assert_eq!(
            complete(&env, &id, &student, 1, 0),
            Err(ProgressError::LessonAlreadyCompleted)
        );

        let progress = progress_of(&env, &id, &student, 1).unwrap();

        assert_eq!(progress.completed_lessons, 1);
        assert_eq!(progress.basis_points, 2_500);
    }

    #[test]
    fn progress_cannot_exceed_one_hundred_percent() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 1, 2);

        complete(&env, &id, &student, 1, 0).unwrap();
        complete(&env, &id, &student, 1, 1).unwrap();

        // Every further attempt is either out of range or a duplicate.
        assert_eq!(
            complete(&env, &id, &student, 1, 2),
            Err(ProgressError::LessonOutOfRange)
        );
        assert_eq!(
            complete(&env, &id, &student, 1, 0),
            Err(ProgressError::LessonAlreadyCompleted)
        );

        let progress = progress_of(&env, &id, &student, 1).unwrap();

        assert_eq!(progress.completed_lessons, 2);
        assert_eq!(progress.basis_points, COMPLETE_BASIS_POINTS);
    }

    #[test]
    fn lessons_completed_out_of_order_still_count() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 1, 4);

        complete(&env, &id, &student, 1, 3).unwrap();
        complete(&env, &id, &student, 1, 1).unwrap();

        let progress = progress_of(&env, &id, &student, 1).unwrap();

        assert_eq!(progress.completed_lessons, 2);
        assert_eq!(progress.basis_points, 5_000);

        assert!(call(&env, &id, || Progress::is_lesson_completed(
            &env, &student, 1, 3
        )));
        assert!(call(&env, &id, || Progress::is_lesson_completed(
            &env, &student, 1, 1
        )));
        assert!(!call(&env, &id, || Progress::is_lesson_completed(
            &env, &student, 1, 0
        )));
    }

    #[test]
    fn progress_is_tracked_per_student() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        let other = Address::generate(&env);
        call(&env, &id, || {
            AccessControl::register_student(&env, &other).unwrap()
        });

        create_course(&env, &id, &instructor, 1, 4);

        complete(&env, &id, &student, 1, 0).unwrap();
        complete(&env, &id, &student, 1, 1).unwrap();
        complete(&env, &id, &other, 1, 0).unwrap();

        assert_eq!(
            progress_of(&env, &id, &student, 1).unwrap().basis_points,
            5_000
        );
        assert_eq!(
            progress_of(&env, &id, &other, 1).unwrap().basis_points,
            2_500
        );
    }

    #[test]
    fn progress_is_tracked_per_course() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 1, 4);
        create_course(&env, &id, &instructor, 2, 4);

        complete(&env, &id, &student, 1, 0).unwrap();

        assert_eq!(
            progress_of(&env, &id, &student, 1).unwrap().basis_points,
            2_500
        );
        assert_eq!(progress_of(&env, &id, &student, 2).unwrap().basis_points, 0);
    }

    #[test]
    fn repeated_reads_return_the_same_answer() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 1, 3);
        complete(&env, &id, &student, 1, 0).unwrap();

        let first = progress_of(&env, &id, &student, 1).unwrap();

        // Advancing the ledger must not change a stored-state calculation.
        env.ledger().with_mut(|ledger| {
            ledger.sequence_number += 1_000;
            ledger.timestamp += 100_000;
        });

        let second = progress_of(&env, &id, &student, 1).unwrap();

        assert_eq!(first, second);
        assert_eq!(first.basis_points, 3_333);
    }

    #[test]
    fn a_student_with_no_record_reads_as_zero_rather_than_missing() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 1, 5);

        let stranger = Address::generate(&env);

        let progress = progress_of(&env, &id, &stranger, 1).unwrap();

        assert_eq!(progress.completed_lessons, 0);
        assert_eq!(progress.total_lessons, 5);
        assert_eq!(progress.basis_points, 0);
    }

    /// `require_auth` failures abort at the host level rather than
    /// returning a contract error, so an unauthorized completion shows up
    /// as a panic — `Error(Auth, InvalidAction)`, "Unauthorized function
    /// call for address" — and not as `Err(..)`. Asserting on the panic is
    /// the only way to pin this behaviour.
    #[test]
    #[should_panic(expected = "Unauthorized function call for address")]
    fn a_student_cannot_complete_a_lesson_for_someone_else() {
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
        create_course(&env, &contract_id, &instructor, 1, 4);

        // Auth is now switched off, so the student's own signature is the
        // only thing that could authorize this and it is absent.
        env.set_auths(&[]);

        call(&env, &contract_id, || {
            Progress::complete_lesson(&env, &student, 1, 0)
        })
        .unwrap();
    }

    #[test]
    fn truncation_never_rounds_a_partial_course_up_to_complete() {
        // 9_999 of 10_000 lessons is 9_999 basis points, not 10_000. The
        // gap matters because callers may gate rewards on the figure.
        assert_eq!(Progress::basis_points(9_999, 10_000), 9_999);
        assert_eq!(
            Progress::basis_points(10_000, 10_000),
            COMPLETE_BASIS_POINTS
        );

        // One lesson short of a very long course still reads as incomplete.
        let almost = Progress::basis_points(999_999, 1_000_000);
        assert!(almost < COMPLETE_BASIS_POINTS);
        assert_eq!(almost, 9_999);
    }

    #[test]
    fn basis_point_arithmetic_survives_very_long_courses() {
        // `completed * 10_000` exceeds u32::MAX beyond roughly 429_496
        // lessons. Computing in u64 keeps these exact instead of panicking
        // under the release profile's overflow checks.
        assert_eq!(
            Progress::basis_points(u32::MAX, u32::MAX),
            COMPLETE_BASIS_POINTS
        );
        assert_eq!(Progress::basis_points(u32::MAX / 2, u32::MAX), 4_999);
        assert_eq!(Progress::basis_points(0, u32::MAX), 0);
    }

    #[test]
    fn an_empty_course_yields_zero_basis_points_without_dividing_by_zero() {
        assert_eq!(Progress::basis_points(0, 0), 0);
    }
}
