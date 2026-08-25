use soroban_sdk::{contract, contractimpl, Address, Env};

use crate::access::{AccessControl, AccessError, Role, UserRecord};
use crate::course::{Course, CourseError, Courses};
use crate::progress::{CourseProgress, Progress, ProgressError, ProgressTracker};
use crate::types::LmsVersion;

/// Root contract for the Learning Management System.
///
/// This type is the contract's public surface. Every function in the
/// `#[contractimpl]` block below is callable from off-chain — through the
/// Stellar CLI, an SDK, or another contract — and nothing outside that block
/// is. Internal modules such as `access` hold the logic; this layer exists
/// to expose it and to keep the wire signatures in one reviewable place.
#[contract]
pub struct LmsContract;

#[contractimpl]
impl LmsContract {
    /// Initialize the contract and register its first administrator.
    ///
    /// This must be called exactly once, immediately after deployment, and
    /// it is the only way an administrator comes into being without an
    /// existing administrator's approval. Every later privileged operation
    /// traces its authority back to this call.
    ///
    /// # Errors
    /// * `AlreadyInitialized` — the contract has already been initialized
    pub fn initialize(env: Env, admin: Address) -> Result<(), AccessError> {
        AccessControl::initialize_admin(&env, &admin)
    }

    /// Whether the contract has been initialized.
    ///
    /// Deployment tooling can use this to tell a fresh deployment from one
    /// that is already live, without having to guess from an error.
    pub fn is_initialized(env: Env) -> bool {
        AccessControl::is_initialized(&env)
    }

    /// The version of the contract interface.
    pub fn version(_env: Env) -> LmsVersion {
        LmsVersion::V1
    }

    /// Register an additional administrator.
    ///
    /// Requires an existing administrator's authorization.
    ///
    /// # Errors
    /// * `AdminRequired` — the caller is registered but is not an admin
    /// * `UserNotRegistered` — the caller has no role at all
    /// * `AlreadyRegistered` — the target address already has a role
    pub fn register_admin(env: Env, caller: Address, admin: Address) -> Result<(), AccessError> {
        AccessControl::register_admin(&env, &caller, &admin)
    }

    /// Authorize an instructor.
    ///
    /// Requires an administrator's authorization.
    ///
    /// # Errors
    /// * `AdminRequired` — the caller is registered but is not an admin
    /// * `UserNotRegistered` — the caller has no role at all
    /// * `AlreadyRegistered` — the target address already has a role
    pub fn authorize_instructor(
        env: Env,
        caller: Address,
        instructor: Address,
    ) -> Result<(), AccessError> {
        AccessControl::authorize_instructor(&env, &caller, &instructor)
    }

    /// Register the calling address as a student.
    ///
    /// Students authorize their own registration, so no staff involvement
    /// is required to enroll as a learner.
    ///
    /// # Errors
    /// * `AlreadyRegistered` — the address already has a role
    pub fn register_student(env: Env, student: Address) -> Result<(), AccessError> {
        AccessControl::register_student(&env, &student)
    }

    /// Look up the role assigned to an address, if any.
    pub fn get_role(env: Env, user: Address) -> Option<Role> {
        AccessControl::get_role(&env, &user)
    }

    /// Look up the full access-control record for an address, if any.
    pub fn get_user(env: Env, user: Address) -> Option<UserRecord> {
        AccessControl::get_user(&env, &user)
    }

    /// Whether an address holds a specific role.
    pub fn has_role(env: Env, user: Address, role: Role) -> bool {
        AccessControl::has_role(&env, &user, role)
    }

    /// Create a draft course for an authorized administrator or instructor.
    pub fn create_course(
        env: Env,
        caller: Address,
        course_id: u32,
        instructor: Address,
        title: soroban_sdk::String,
        description_uri: soroban_sdk::String,
        price: i128,
        total_lessons: u32,
    ) -> Result<(), CourseError> {
        Courses::create_course(
            &env,
            &caller,
            course_id,
            &instructor,
            title,
            description_uri,
            price,
            total_lessons,
        )
    }

    /// Retrieve a course by its unique identifier.
    pub fn get_course(env: Env, course_id: u32) -> Option<Course> {
        Courses::get_course(&env, course_id)
    }

    /// Mark a lesson as complete for an enrolled student.
    pub fn mark_lesson_complete(
        env: Env,
        student: Address,
        course_id: u32,
        lesson_id: u32,
    ) -> Result<Progress, ProgressError> {
        ProgressTracker::mark_lesson_complete(&env, &student, course_id, lesson_id)
    }

    /// Get progress record for a student on a specific lesson.
    pub fn get_lesson_progress(
        env: Env,
        student: Address,
        course_id: u32,
        lesson_id: u32,
    ) -> Option<Progress> {
        ProgressTracker::get_lesson_progress(&env, &student, course_id, lesson_id)
    }

    /// Complete a lesson in a course.
    pub fn complete_lesson(
        env: Env,
        student: Address,
        course_id: u32,
        lesson_index: u32,
    ) -> Result<(), ProgressError> {
        ProgressTracker::complete_lesson(&env, &student, course_id, lesson_index)
    }

    /// Get total course progress for a student.
    pub fn get_course_progress(
        env: Env,
        student: Address,
        course_id: u32,
    ) -> Result<CourseProgress, ProgressError> {
        ProgressTracker::get_course_progress(&env, &student, course_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn contract_can_be_registered() {
        let env = Env::default();

        let _contract_id = env.register(LmsContract, ());
    }

    #[test]
    fn version_is_reported_without_initialization() {
        let env = Env::default();
        let id = env.register(LmsContract, ());

        // `version` reads no storage, so it answers on a bare deployment.
        assert_eq!(
            env.as_contract(&id, || LmsContract::version(env.clone())),
            LmsVersion::V1
        );
    }

    #[test]
    fn a_fresh_deployment_reports_itself_uninitialized() {
        let env = Env::default();
        let id = env.register(LmsContract, ());

        assert!(!env.as_contract(&id, || LmsContract::is_initialized(env.clone())));

        let admin = Address::generate(&env);
        env.mock_all_auths();

        env.as_contract(&id, || {
            LmsContract::initialize(env.clone(), admin.clone()).unwrap()
        });

        assert!(env.as_contract(&id, || LmsContract::is_initialized(env.clone())));
    }
}
