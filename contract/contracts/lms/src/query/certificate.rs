use soroban_sdk::{contracttype, Address, Env};

/// A course-completion certificate, as exposed to the frontend.
///
/// Mirrors the record shape the certificate module (#653/#654) persists, so
/// the frontend can integrate against a stable response today and the
/// queries can be switched to the real storage reads when that module lands.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CertificateView {
    /// Unique identifier for the certificate.
    pub certificate_id: u64,

    /// The student the certificate was issued to.
    pub student: Address,

    /// The course the certificate attests completion of.
    pub course_id: u32,

    /// Ledger timestamp at which the certificate was issued.
    pub issued_at: u64,
}

/// Read-only certificate queries (#656).
pub struct CertificateQueries;

impl CertificateQueries {
    /// Look up a certificate by its identifier, if one exists.
    ///
    /// Returns `None` today: certificate storage is not wired into the
    /// contract yet (the certificate module is tracked in #653/#654). When
    /// it lands this will read `StorageKey::Certificate(certificate_id)` and
    /// return the stored certificate.
    pub fn get_certificate(env: &Env, certificate_id: u64) -> Option<CertificateView> {
        let _ = (env, certificate_id);
        None
    }

    /// Whether a certificate with the given identifier exists and was issued
    /// to the given student for the given course.
    ///
    /// Returns `false` today: certificate storage is not wired into the
    /// contract yet (the certificate module is tracked in #653/#654). When
    /// it lands this will read `StorageKey::Certificate(certificate_id)` and
    /// verify that its `student` and `course_id` match the arguments.
    pub fn verify_certificate(
        env: &Env,
        certificate_id: u64,
        student: &Address,
        course_id: u32,
    ) -> bool {
        let _ = (env, certificate_id, student, course_id);
        false
    }
}
