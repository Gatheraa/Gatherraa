use soroban_sdk::contracterror;

/// Errors produced by the LMS certificate module.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum CertificateError {
    /// The caller does not have the staff privileges required to issue
    /// certificates.
    ///
    /// Certificate issuance is a privileged operation, the same way course
    /// creation is: a credential that anyone could mint would be worthless.
    Unauthorized = 1,

    /// The certificate's metadata URI is empty.
    ///
    /// A certificate with no metadata URI points at nothing, so it could
    /// never be verified against its artifact. The URI is the whole point
    /// of the field.
    InvalidMetadataUri = 2,
}
