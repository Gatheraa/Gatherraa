pub mod errors;
pub mod storage;
pub mod types;

pub use errors::CourseError;
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

    /// Publish a draft course so students can enroll in it.
    ///
    /// Only staff — administrators and instructors — may publish courses,
    /// matching how creation is gated.
    ///
    /// # Errors
    /// * `CourseNotFound` — no course exists under the identifier
    /// * `CourseAlreadyPublished` — the course is already published
    pub fn publish_course(env: &Env, caller: &Address, course_id: u32) -> Result<(), CourseError> {
        AccessControl::require_staff(env, caller).map_err(|error| match error {
            crate::access::AccessError::UserNotRegistered => CourseError::UserNotRegistered,
            _ => CourseError::Unauthorized,
        })?;

        let mut course = storage::get_course(env, course_id).ok_or(CourseError::CourseNotFound)?;
        if course.status == CourseStatus::Published {
            return Err(CourseError::CourseAlreadyPublished);
        }

        course.status = CourseStatus::Published;
        course.updated_at = env.ledger().timestamp();
        storage::set_course(env, &course);
        crate::events::course_published(env, course_id, caller);

        Ok(())
    }

    /// Retrieve a course by its unique identifier.
    pub fn get_course(env: &Env, course_id: u32) -> Option<Course> {
        storage::get_course(env, course_id)
    }
}
