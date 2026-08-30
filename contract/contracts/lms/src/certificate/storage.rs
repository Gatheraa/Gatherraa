use soroban_sdk::Env;

use crate::StorageKey;

use super::types::Certificate;

/// Returns the certificate stored under the given identifier.
pub fn get_certificate(env: &Env, certificate_id: u64) -> Option<Certificate> {
    env.storage()
        .persistent()
        .get(&StorageKey::Certificate(certificate_id))
}

/// Persist a certificate record.
///
/// Writing the whole record under `certificate_id` keeps one certificate to
/// one storage entry, keyed exactly the way callers ask for it.
pub fn set_certificate(env: &Env, certificate: &Certificate) {
    env.storage().persistent().set(
        &StorageKey::Certificate(certificate.certificate_id),
        certificate,
    );
}

/// Allocate the next unique certificate identifier.
///
/// The counter lives in instance storage, alongside the rest of the
/// contract's configuration: there is exactly one of it and it is the
/// contract's own state, not a per-record record.
///
/// Identifiers are allocated by construction rather than by checking for
/// collisions. The counter is monotonic, so a freshly allocated identifier
/// can never have been handed out before, and a reverted transaction rolls
/// the increment back with everything else — a failed issuance consumes no
/// identifier.
pub fn next_certificate_id(env: &Env) -> u64 {
    let next = env
        .storage()
        .instance()
        .get(&StorageKey::CertificateCounter)
        .unwrap_or(0)
        + 1;

    env.storage()
        .instance()
        .set(&StorageKey::CertificateCounter, &next);

    next
}
