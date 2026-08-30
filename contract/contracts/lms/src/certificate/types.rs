use soroban_sdk::{contracttype, Address, String};

/// A verifiable course-completion credential issued by the LMS.
///
/// The certificate is a pure data record: it names the student it was
/// issued to, the course it attests completion of, when it was issued, and
/// where the human-readable certificate artifact lives. Verification logic
/// (checking that the student genuinely completed the course) is a separate
/// concern from the record itself.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Certificate {
    /// Unique identifier for the certificate.
    ///
    /// Allocated from a monotonic counter at issuance, so no two issued
    /// certificates ever share an identifier.
    pub certificate_id: u64,

    /// The student the certificate was issued to.
    pub student: Address,

    /// The course the certificate attests completion of.
    pub course_id: u32,

    /// Ledger timestamp (in seconds) at which the certificate was issued.
    pub issued_at: u64,

    /// Off-chain URI pointing at the certificate's metadata or artifact.
    ///
    /// The credential's human-readable form — the document a graduate can
    /// display and a verifier can check — lives off-chain; the contract
    /// stores only the reference to it.
    pub metadata_uri: String,
}
