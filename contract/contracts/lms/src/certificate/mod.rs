pub mod errors;
pub mod storage;
pub mod types;

pub use errors::CertificateError;
pub use types::Certificate;

use soroban_sdk::{Address, Env, String};

use crate::access::AccessControl;
use crate::events;

/// Certificate issuance and retrieval for the LMS contract.
pub struct CertificateService;

impl CertificateService {
    /// Issue a course-completion certificate to a student.
    ///
    /// Only staff — administrators and instructors — may issue certificates,
    /// matching how the access module gates the rest of course
    /// administration. A credential anyone could mint would be worthless.
    ///
    /// The certificate identifier is allocated from a monotonic counter, so
    /// identifiers are unique by construction: a freshly issued certificate
    /// can never collide with an earlier one, and a reverted transaction
    /// rolls the allocation back, so a failed issuance consumes nothing.
    ///
    /// The issuance timestamp is taken from the ledger at call time, which
    /// is the one trustworthy clock a contract has.
    ///
    /// # Errors
    /// * `Unauthorized` — the caller is not staff
    /// * `InvalidMetadataUri` — `metadata_uri` is empty
    pub fn issue_certificate(
        env: &Env,
        caller: &Address,
        student: &Address,
        course_id: u32,
        metadata_uri: String,
    ) -> Result<Certificate, CertificateError> {
        AccessControl::require_staff(env, caller).map_err(|_| CertificateError::Unauthorized)?;

        if metadata_uri.is_empty() {
            return Err(CertificateError::InvalidMetadataUri);
        }

        let certificate = Certificate {
            certificate_id: storage::next_certificate_id(env),
            student: student.clone(),
            course_id,
            issued_at: env.ledger().timestamp(),
            metadata_uri,
        };

        storage::set_certificate(env, &certificate);
        events::certificate_issued(env, certificate.certificate_id, course_id, student);

        Ok(certificate)
    }

    /// Look up a certificate by its identifier.
    pub fn get_certificate(env: &Env, certificate_id: u64) -> Option<Certificate> {
        storage::get_certificate(env, certificate_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::LmsContract;
    use soroban_sdk::testutils::{Address as _, Events as _, Ledger as _};
    use soroban_sdk::{Address, Env, String, Symbol, TryIntoVal};

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

    fn setup() -> (Env, Address, Address, Address, Address, Address) {
        let env = Env::default();
        let contract_id = env.register(LmsContract, ());

        let admin = Address::generate(&env);
        let instructor = Address::generate(&env);
        let student = Address::generate(&env);
        let outsider = Address::generate(&env);

        env.mock_all_auths();

        (env, contract_id, admin, instructor, student, outsider)
    }

    /// Register an admin and promote `instructor`, so certificate issuance
    /// is authorized.
    fn seed_staff(env: &Env, contract_id: &Address, admin: &Address, instructor: &Address) {
        call(env, contract_id, || {
            AccessControl::initialize_admin(env, admin).unwrap()
        });
        call(env, contract_id, || {
            AccessControl::authorize_instructor(env, admin, instructor).unwrap()
        });
    }

    fn issue(
        env: &Env,
        contract_id: &Address,
        caller: &Address,
        student: &Address,
        course_id: u32,
        metadata_uri: &str,
    ) -> Result<Certificate, CertificateError> {
        call(env, contract_id, || {
            CertificateService::issue_certificate(
                env,
                caller,
                student,
                course_id,
                String::from_str(env, metadata_uri),
            )
        })
    }

    #[test]
    fn an_admin_can_issue_a_certificate() {
        let (env, id, admin, _, student, _) = setup();
        seed_staff(&env, &id, &admin, &Address::generate(&env));

        let certificate = issue(&env, &id, &admin, &student, 7, "ipfs://cert/1").unwrap();

        assert_eq!(certificate.certificate_id, 1);
        assert_eq!(certificate.student, student);
        assert_eq!(certificate.course_id, 7);
        assert_eq!(certificate.issued_at, env.ledger().timestamp());
        assert_eq!(
            certificate.metadata_uri,
            String::from_str(&env, "ipfs://cert/1")
        );
    }

    #[test]
    fn an_instructor_can_issue_a_certificate() {
        let (env, id, admin, instructor, student, _) = setup();
        seed_staff(&env, &id, &admin, &instructor);

        let certificate = issue(&env, &id, &instructor, &student, 7, "ipfs://cert/1").unwrap();

        assert_eq!(certificate.certificate_id, 1);
        assert_eq!(certificate.student, student);
    }

    #[test]
    fn certificate_identifiers_are_unique() {
        let (env, id, admin, _, student, _) = setup();
        seed_staff(&env, &id, &admin, &Address::generate(&env));

        let first = issue(&env, &id, &admin, &student, 1, "ipfs://cert/1").unwrap();
        let second = issue(&env, &id, &admin, &student, 2, "ipfs://cert/2").unwrap();

        assert_eq!(first.certificate_id, 1);
        assert_eq!(second.certificate_id, 2);
        assert_ne!(first.certificate_id, second.certificate_id);

        // Both remain independently retrievable.
        assert_eq!(
            call(&env, &id, || CertificateService::get_certificate(
                &env,
                first.certificate_id
            )),
            Some(first)
        );
        assert_eq!(
            call(&env, &id, || CertificateService::get_certificate(
                &env,
                second.certificate_id
            )),
            Some(second)
        );
    }

    #[test]
    fn certificates_are_associated_with_their_student_and_course() {
        let (env, id, admin, _, student, _) = setup();
        seed_staff(&env, &id, &admin, &Address::generate(&env));

        let other = Address::generate(&env);

        let for_student = issue(&env, &id, &admin, &student, 3, "ipfs://cert/1").unwrap();
        let for_other = issue(&env, &id, &admin, &other, 9, "ipfs://cert/2").unwrap();

        assert_eq!(for_student.student, student);
        assert_eq!(for_student.course_id, 3);
        assert_eq!(for_other.student, other);
        assert_eq!(for_other.course_id, 9);

        // Each certificate's association survives retrieval.
        let fetched = call(&env, &id, || {
            CertificateService::get_certificate(&env, for_student.certificate_id)
        })
        .unwrap();
        assert_eq!(fetched.student, student);
        assert_eq!(fetched.course_id, 3);
    }

    #[test]
    fn retrieval_returns_none_for_an_unknown_identifier() {
        let (env, id, admin, _, student, _) = setup();
        seed_staff(&env, &id, &admin, &Address::generate(&env));

        issue(&env, &id, &admin, &student, 1, "ipfs://cert/1").unwrap();

        assert_eq!(
            call(&env, &id, || CertificateService::get_certificate(&env, 404)),
            None
        );
    }

    #[test]
    fn a_student_cannot_issue_a_certificate() {
        let (env, id, admin, _, student, _) = setup();
        seed_staff(&env, &id, &admin, &Address::generate(&env));
        call(&env, &id, || {
            AccessControl::register_student(&env, &student).unwrap()
        });

        assert_eq!(
            issue(&env, &id, &student, &student, 1, "ipfs://cert/1"),
            Err(CertificateError::Unauthorized)
        );

        // The rejected call stored nothing.
        assert_eq!(
            call(&env, &id, || CertificateService::get_certificate(&env, 1)),
            None
        );
    }

    #[test]
    fn an_unregistered_caller_cannot_issue_a_certificate() {
        let (env, id, admin, _, student, outsider) = setup();
        seed_staff(&env, &id, &admin, &Address::generate(&env));

        assert_eq!(
            issue(&env, &id, &outsider, &student, 1, "ipfs://cert/1"),
            Err(CertificateError::Unauthorized)
        );
    }

    #[test]
    fn an_empty_metadata_uri_is_rejected_and_consumes_no_identifier() {
        let (env, id, admin, _, student, _) = setup();
        seed_staff(&env, &id, &admin, &Address::generate(&env));

        assert_eq!(
            issue(&env, &id, &admin, &student, 1, ""),
            Err(CertificateError::InvalidMetadataUri)
        );

        // Nothing was stored by the rejected call...
        assert_eq!(
            call(&env, &id, || CertificateService::get_certificate(&env, 1)),
            None
        );

        // ...and the counter was not consumed: the next valid issuance
        // still gets identifier 1.
        let certificate = issue(&env, &id, &admin, &student, 1, "ipfs://cert/1").unwrap();
        assert_eq!(certificate.certificate_id, 1);
    }

    #[test]
    fn issued_at_reflects_the_ledger_timestamp() {
        let (env, id, admin, _, student, _) = setup();
        seed_staff(&env, &id, &admin, &Address::generate(&env));

        env.ledger().with_mut(|ledger| {
            ledger.timestamp = 1_700_000_000;
        });

        let certificate = issue(&env, &id, &admin, &student, 1, "ipfs://cert/1").unwrap();

        assert_eq!(certificate.issued_at, 1_700_000_000);
    }

    #[test]
    fn issued_certificates_survive_ledger_advancement() {
        let (env, id, admin, _, student, _) = setup();
        seed_staff(&env, &id, &admin, &Address::generate(&env));

        let certificate = issue(&env, &id, &admin, &student, 1, "ipfs://cert/1").unwrap();

        env.ledger().with_mut(|ledger| {
            ledger.sequence_number += 100_000;
            ledger.timestamp += 10_000_000;
        });

        // Certificates live in persistent storage, so they outlive the
        // ledger moving on. If this ever fails, the records are in the
        // wrong storage durability.
        assert_eq!(
            call(&env, &id, || CertificateService::get_certificate(
                &env,
                certificate.certificate_id
            )),
            Some(certificate)
        );
    }

    #[test]
    fn the_counter_keeps_advancing_across_issuances() {
        let (env, id, admin, _, student, _) = setup();
        seed_staff(&env, &id, &admin, &Address::generate(&env));

        for expected_id in 1..=5u64 {
            let certificate = issue(&env, &id, &admin, &student, 1, "ipfs://cert/1").unwrap();
            assert_eq!(certificate.certificate_id, expected_id);
        }
    }

    #[test]
    fn retrieval_needs_no_authorization() {
        let (env, id, admin, _, student, _) = setup();
        seed_staff(&env, &id, &admin, &Address::generate(&env));

        let certificate = issue(&env, &id, &admin, &student, 1, "ipfs://cert/1").unwrap();

        // Reads take no caller at all, so there is no role to check. The
        // flip side is that retrieval is public: anyone can verify a
        // certificate by its identifier.
        assert_eq!(
            call(&env, &id, || CertificateService::get_certificate(
                &env,
                certificate.certificate_id
            )),
            Some(certificate)
        );
    }

    #[test]
    fn issued_certificates_emit_the_certificate_issued_event() {
        let (env, id, admin, _, student, _) = setup();
        seed_staff(&env, &id, &admin, &Address::generate(&env));

        issue(&env, &id, &admin, &student, 7, "ipfs://cert/1").unwrap();

        let events = env.events().all();
        assert_eq!(events.len(), 1);

        let (_, topics, _) = events.get(0).unwrap();
        // The two static topics from the contractevent declaration.
        let first: Symbol = topics.get(0).unwrap().try_into_val(&env).unwrap();
        let second: Symbol = topics.get(1).unwrap().try_into_val(&env).unwrap();
        assert_eq!(first, Symbol::new(&env, "lms"));
        assert_eq!(second, Symbol::new(&env, "certificate_issued"));
    }
}
