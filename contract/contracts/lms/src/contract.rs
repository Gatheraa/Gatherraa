use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

use crate::access::{AccessControl, AccessError, Role, UserRecord};
use crate::progress::{Course, CourseProgress, ProgressError};
use crate::query::{
    AssessmentQueries, AssessmentResultView, CertificateQueries, CertificateView, CourseQueries,
    EnrollmentQueries, ProgressQueries,
};
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

    // -------------------------------------------------------------------
    // Read / query interface (#656)
    // -------------------------------------------------------------------
    //
    // Every function below is a pure read: no storage writes, no events, no
    // authorization. They exist so the frontend and indexers can inspect
    // contract state without transacting. Data that has no on-chain storage
    // yet (modules, lessons, enrollment, assessment results, certificates)
    // returns the honest empty answer until the corresponding write module
    // lands; each query documents the storage key it will read then.

    /// Look up a registered course, if one exists.
    pub fn get_course(env: Env, course_id: u32) -> Option<Course> {
        CourseQueries::get_course(&env, course_id)
    }

    /// List the module identifiers belonging to a course.
    pub fn get_modules(env: Env, course_id: u32) -> Vec<u32> {
        CourseQueries::get_modules(&env, course_id)
    }

    /// List the lesson identifiers belonging to a module of a course.
    pub fn get_lessons(env: Env, course_id: u32, module_id: u32) -> Vec<u32> {
        CourseQueries::get_lessons(&env, course_id, module_id)
    }

    /// Whether the given student is enrolled in the given course.
    pub fn get_enrollment(env: Env, student: Address, course_id: u32) -> bool {
        EnrollmentQueries::get_enrollment(&env, &student, course_id)
    }

    /// Calculate a student's progress through a course.
    ///
    /// # Errors
    /// * `ProgressError::CourseNotFound` — no course is registered under
    ///   `course_id`
    pub fn get_course_progress(
        env: Env,
        student: Address,
        course_id: u32,
    ) -> Result<CourseProgress, ProgressError> {
        ProgressQueries::get_course_progress(&env, &student, course_id)
    }

    /// Fetch a student's result for an assessment, if one exists.
    pub fn get_assessment_result(
        env: Env,
        student: Address,
        assessment_id: u64,
    ) -> Option<AssessmentResultView> {
        AssessmentQueries::get_assessment_result(&env, &student, assessment_id)
    }

    /// Look up a certificate by its identifier, if one exists.
    pub fn get_certificate(env: Env, certificate_id: u64) -> Option<CertificateView> {
        CertificateQueries::get_certificate(&env, certificate_id)
    }

    /// Whether a certificate with the given identifier exists and was issued
    /// to the given student for the given course.
    pub fn verify_certificate(
        env: Env,
        certificate_id: u64,
        student: Address,
        course_id: u32,
    ) -> bool {
        CertificateQueries::verify_certificate(&env, certificate_id, &student, course_id)
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
