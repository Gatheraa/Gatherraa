use soroban_sdk::{contract, contractimpl, Address, Env, String};

use crate::access::{AccessControl, AccessError, Role, UserRecord};
use crate::certificate::{Certificate, CertificateError, CertificateService};
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

    /// Issue a course-completion certificate to a student.
    ///
    /// Only staff — administrators and instructors — may issue
    /// certificates. The certificate identifier is allocated from a
    /// monotonic counter, so identifiers are unique by construction.
    ///
    /// # Errors
    /// * `Unauthorized` — the caller is not staff
    /// * `InvalidMetadataUri` — `metadata_uri` is empty
    pub fn issue_certificate(
        env: Env,
        caller: Address,
        student: Address,
        course_id: u32,
        metadata_uri: String,
    ) -> Result<Certificate, CertificateError> {
        CertificateService::issue_certificate(&env, &caller, &student, course_id, metadata_uri)
    }

    /// Look up a certificate by its identifier.
    ///
    /// Retrieval is public: anyone can check a certificate by its
    /// identifier without authorization.
    pub fn get_certificate(env: Env, certificate_id: u64) -> Option<Certificate> {
        CertificateService::get_certificate(&env, certificate_id)
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
