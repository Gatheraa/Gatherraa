pub mod errors;
pub mod storage;
pub mod types;

pub use errors::ProgressError;
pub use types::{Course, CourseProgress, LessonProgress, Progress, COMPLETE_BASIS_POINTS};

use soroban_sdk::{Address, Env, String};

use crate::access::{AccessControl, Role};
use crate::course::{CourseStatus, Courses};
use crate::events;

/// Course and lesson progress operations for the LMS contract.
pub struct ProgressTracker;

impl ProgressTracker {
    /// Register a course with a fixed number of lessons.
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

        let timestamp = env.ledger().timestamp();
        storage::set_course(
            env,
            &Course {
                course_id,
                instructor: caller.clone(),
                title: String::from_str(env, ""),
                description_uri: String::from_str(env, ""),
                price: 0,
                status: CourseStatus::Draft,
                created_at: timestamp,
                updated_at: timestamp,
                total_lessons,
            },
        );
        events::course_created(env, course_id, caller, total_lessons);

        Ok(())
    }

    /// Look up a registered course.
    pub fn get_course(env: &Env, course_id: u32) -> Option<Course> {
        Courses::get_course(env, course_id)
    }

    /// Mark a lesson as complete for an enrolled student.
    ///
    /// - Only enrolled students can update progress.
    /// - Students must authorize the update.
    /// - Completion is persisted with completed_at timestamp.
    /// - Duplicate completion is handled safely by returning the existing record
    ///   without incrementing counts or failing.
    pub fn mark_lesson_complete(
        env: &Env,
        student: &Address,
        course_id: u32,
        lesson_id: u32,
    ) -> Result<Progress, ProgressError> {
        student.require_auth();

        if !AccessControl::has_role(env, student, Role::Student) {
            return Err(ProgressError::NotEnrolled);
        }

        let course = storage::get_course(env, course_id).ok_or(ProgressError::CourseNotFound)?;

        if lesson_id >= course.total_lessons {
            return Err(ProgressError::LessonOutOfRange);
        }

        // Duplicate completion handled safely: return existing progress without double counting
        if let Some(existing) = storage::get_lesson_progress(env, student, course_id, lesson_id) {
            if existing.completed {
                return Ok(existing);
            }
        }

        let timestamp = env.ledger().timestamp();
        let record = Progress {
            student: student.clone(),
            course_id,
            lesson_id,
            completed: true,
            completed_at: timestamp,
        };

        storage::set_lesson_progress(env, &record);
        storage::set_lesson_completed(env, student, course_id, lesson_id);

        let completed = storage::get_completed_count(env, student, course_id);
        storage::set_completed_count(env, student, course_id, completed + 1);
        events::lesson_completed(env, course_id, lesson_id, student);

        if completed + 1 == course.total_lessons {
            events::course_completed(env, course_id, student);
        }

        Ok(record)
    }

    /// Retrieve the lesson progress record for a student on a specific lesson.
    pub fn get_lesson_progress(
        env: &Env,
        student: &Address,
        course_id: u32,
        lesson_id: u32,
    ) -> Option<Progress> {
        storage::get_lesson_progress(env, student, course_id, lesson_id)
    }

    /// Record that a student has completed one lesson of a course (legacy endpoint).
    pub fn complete_lesson(
        env: &Env,
        student: &Address,
        course_id: u32,
        lesson_index: u32,
    ) -> Result<(), ProgressError> {
        student.require_auth();

        let course = storage::get_course(env, course_id).ok_or(ProgressError::CourseNotFound)?;

        if lesson_index >= course.total_lessons {
            return Err(ProgressError::LessonOutOfRange);
        }

        if storage::is_lesson_completed(env, student, course_id, lesson_index) {
            return Err(ProgressError::LessonAlreadyCompleted);
        }

        let timestamp = env.ledger().timestamp();
        let record = Progress {
            student: student.clone(),
            course_id,
            lesson_id: lesson_index,
            completed: true,
            completed_at: timestamp,
        };

        storage::set_lesson_progress(env, &record);
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
    fn basis_points(completed: u32, total: u32) -> u32 {
        if total == 0 {
            return 0;
        }

        let completed_wide = u64::from(completed);
        let complete_bps_wide = u64::from(COMPLETE_BASIS_POINTS);
        let total_wide = u64::from(total);

        let multiplied = completed_wide.saturating_mul(complete_bps_wide);
        let divided = multiplied / total_wide;

        u32::try_from(divided).unwrap_or(COMPLETE_BASIS_POINTS)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger as _};
    use soroban_sdk::Env;

    use crate::contract::LmsContract;
    use crate::course::CourseStatus;

    fn call<F, T>(env: &Env, contract_id: &Address, f: F) -> T
    where
        F: FnOnce() -> T,
    {
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

    fn create_course(
        env: &Env,
        contract_id: &Address,
        instructor: &Address,
        id: u32,
        lessons: u32,
    ) {
        call(env, contract_id, || {
            ProgressTracker::create_course(env, instructor, id, lessons).unwrap()
        });
    }

    fn progress_of(
        env: &Env,
        contract_id: &Address,
        student: &Address,
        course_id: u32,
    ) -> Result<CourseProgress, ProgressError> {
        call(env, contract_id, || {
            ProgressTracker::get_course_progress(env, student, course_id)
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
            ProgressTracker::complete_lesson(env, student, course_id, lesson_index)
        })
    }

    fn mark_complete(
        env: &Env,
        contract_id: &Address,
        student: &Address,
        course_id: u32,
        lesson_id: u32,
    ) -> Result<Progress, ProgressError> {
        call(env, contract_id, || {
            ProgressTracker::mark_lesson_complete(env, student, course_id, lesson_id)
        })
    }

    fn get_lesson_prog(
        env: &Env,
        contract_id: &Address,
        student: &Address,
        course_id: u32,
        lesson_id: u32,
    ) -> Option<Progress> {
        call(env, contract_id, || {
            ProgressTracker::get_lesson_progress(env, student, course_id, lesson_id)
        })
    }

    #[test]
    fn student_marks_lesson_complete_and_persists() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 10, 5);

        assert_eq!(get_lesson_prog(&env, &id, &student, 10, 0), None);

        let progress = mark_complete(&env, &id, &student, 10, 0).unwrap();

        assert_eq!(progress.student, student);
        assert_eq!(progress.course_id, 10);
        assert_eq!(progress.lesson_id, 0);
        assert!(progress.completed);
        assert_eq!(progress.completed_at, env.ledger().timestamp());

        assert_eq!(
            get_lesson_prog(&env, &id, &student, 10, 0),
            Some(progress)
        );

        let course_prog = progress_of(&env, &id, &student, 10).unwrap();
        assert_eq!(course_prog.completed_lessons, 1);
        assert_eq!(course_prog.basis_points, 2_000);
    }

    #[test]
    fn only_enrolled_students_can_update_progress() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 10, 5);

        let unenrolled = Address::generate(&env);

        assert_eq!(
            mark_complete(&env, &id, &unenrolled, 10, 0),
            Err(ProgressError::NotEnrolled)
        );

        assert_eq!(
            mark_complete(&env, &id, &instructor, 10, 0),
            Err(ProgressError::NotEnrolled)
        );
    }

    #[test]
    fn duplicate_completion_is_handled_safely() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 10, 5);

        let first = mark_complete(&env, &id, &student, 10, 0).unwrap();

        env.ledger().with_mut(|ledger| {
            ledger.timestamp += 500;
        });

        let second = mark_complete(&env, &id, &student, 10, 0).unwrap();

        assert_eq!(first, second);

        let course_prog = progress_of(&env, &id, &student, 10).unwrap();
        assert_eq!(course_prog.completed_lessons, 1);
    }

    #[test]
    fn mark_lesson_out_of_range_is_rejected() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 10, 3);

        assert_eq!(
            mark_complete(&env, &id, &student, 10, 3),
            Err(ProgressError::LessonOutOfRange)
        );
        assert_eq!(
            mark_complete(&env, &id, &student, 10, 100),
            Err(ProgressError::LessonOutOfRange)
        );
    }

    #[test]
    fn mark_lesson_on_unknown_course_is_rejected() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        assert_eq!(
            mark_complete(&env, &id, &student, 999, 0),
            Err(ProgressError::CourseNotFound)
        );
    }

    #[test]
    fn creates_a_course() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 1, 4);

        assert_eq!(
            call(&env, &id, || ProgressTracker::get_course(&env, 1)),
            Some(Course {
                course_id: 1,
                instructor: instructor.clone(),
                title: String::from_str(&env, ""),
                description_uri: String::from_str(&env, ""),
                price: 0,
                status: CourseStatus::Draft,
                created_at: env.ledger().timestamp(),
                updated_at: env.ledger().timestamp(),
                total_lessons: 4,
            })
        );
    }

    #[test]
    fn duplicate_course_is_rejected() {
        let (env, id, instructor, student) = setup();
        seed_roles(&env, &id, &instructor, &student);

        create_course(&env, &id, &instructor, 1, 4);

        assert_eq!(
            call(&env, &id, || ProgressTracker::create_course(
                &env,
                &instructor,
                1,
                9
            )),
            Err(ProgressError::CourseAlreadyExists)
        );

        assert_eq!(
            call(&env, &id, || ProgressTracker::get_course(&env, 1))
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

        assert_eq!(
            complete(&env, &id, &student, 1, 3),
            Err(ProgressError::LessonOutOfRange)
        );
        assert_eq!(
            complete(&env, &id, &student, 1, u32::MAX),
            Err(ProgressError::LessonOutOfRange)
        );

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

        assert!(call(&env, &id, || ProgressTracker::is_lesson_completed(
            &env, &student, 1, 3
        )));
        assert!(call(&env, &id, || ProgressTracker::is_lesson_completed(
            &env, &student, 1, 1
        )));
        assert!(!call(&env, &id, || ProgressTracker::is_lesson_completed(
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

        env.set_auths(&[]);

        call(&env, &contract_id, || {
            ProgressTracker::complete_lesson(&env, &student, 1, 0)
        })
        .unwrap();
    }

    #[test]
    fn truncation_never_rounds_a_partial_course_up_to_complete() {
        assert_eq!(ProgressTracker::basis_points(9_999, 10_000), 9_999);
        assert_eq!(
            ProgressTracker::basis_points(10_000, 10_000),
            COMPLETE_BASIS_POINTS
        );

        let almost = ProgressTracker::basis_points(999_999, 1_000_000);
        assert!(almost < COMPLETE_BASIS_POINTS);
        assert_eq!(almost, 9_999);
    }

    #[test]
    fn basis_point_arithmetic_survives_very_long_courses() {
        assert_eq!(
            ProgressTracker::basis_points(u32::MAX, u32::MAX),
            COMPLETE_BASIS_POINTS
        );
        assert_eq!(ProgressTracker::basis_points(u32::MAX / 2, u32::MAX), 4_999);
        assert_eq!(ProgressTracker::basis_points(0, u32::MAX), 0);
    }

    #[test]
    fn an_empty_course_yields_zero_basis_points_without_dividing_by_zero() {
        assert_eq!(ProgressTracker::basis_points(0, 0), 0);
    }
}
