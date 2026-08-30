//! Verified decoding of LMS contract events from Soroban event XDR.
//!
//! Off-chain consumers (ingestion workers, indexers) receive Soroban events
//! as base64-encoded XDR of a [`DiagnosticEvent`] — Stellar RPC's
//! `getTransaction` returns exactly that in its `events` array. This module
//! turns that wire format into the same typed event structs the contract
//! publishes ([`LmsEvent`]), and defines an explicit error contract
//! ([`DecodeError`]) for inputs that are malformed, truncated, or outside the
//! LMS event set.
//!
//! # Guarantees
//!
//! * [`decode_event`] never panics. Every failure mode — bad base64, truncated
//!   or structurally invalid XDR, non-LMS events, malformed payloads — is a
//!   [`Result`]`::`[`Err`].
//! * Errors are categorized and never carry the input payload, so they can be
//!   logged or surfaced to an operator without leaking event contents.
//! * Only Soroban `DiagnosticEvent` XDR is accepted. Anything else (a
//!   different XDR type, an event that does not carry the `lms` topic prefix)
//!   is rejected with a categorized error. Non-Soroban XDR is out of scope.
//!
//! # Input format
//!
//! `input` must be a base64-encoded (standard alphabet, with padding) XDR
//! `DiagnosticEvent` as returned by Stellar RPC. Events are identified by
//! their topic prefix (`["lms", "<event_name>", ...]`). The emitter is gated
//! by contract: [`decode_event`] accepts events with no source constraint,
//! while [`decode_event_from`] requires the emitting `contract_id` to match an
//! expected deployment id. An LMS event must name its emitter; a
//! `contract_id` that is absent is rejected, and one that names a different
//! contract is rejected with [`DecodeError::UnexpectedContractId`], so an
//! unrelated or malicious contract cannot spoof an LMS event.
//!
//! Events from failed contract calls are decoded like any other event; the
//! caller decides whether to drop them based on
//! `DiagnosticEvent::in_successful_contract_call`.
//!
//! # Limits
//!
//! Decoding is bounded to [`MAX_EVENT_BYTES`] bytes and [`MAX_XDR_DEPTH`]
//! nesting so a hostile input cannot exhaust memory or the stack during
//! parsing.

// The decoder runs off-chain (non-wasm builds only, see `mod.rs`), where the
// standard library is available.
extern crate std;

use core::fmt;

use base64::Engine;
use soroban_sdk::xdr::{
    ContractEventBody, ContractEventType, ContractId, DiagnosticEvent, Error as XdrError, Limits,
    ReadXdr, ScMapEntry, ScSymbol, ScVal,
};
use soroban_sdk::{Address, Env, TryFromVal};

use super::types::{
    AssessmentSubmitted, CertificateIssued, CourseArchived, CourseCompleted, CourseCreated,
    CoursePublished, LessonCompleted, LessonCreated, ModuleCreated, StudentEnrolled,
    StudentUnenrolled,
};

/// Prefix topic shared by every LMS event.
const LMS_TOPIC: &str = "lms";

/// Upper bound on the size of an accepted event, in bytes. A legitimate LMS
/// event (a handful of topics plus a small data map) is well under 1 KiB; this
/// limit is generous while still bounding hostile inputs.
const MAX_EVENT_BYTES: usize = 16 * 1024;

/// Upper bound on XDR nesting depth, mirroring the host's own depth limit.
const MAX_XDR_DEPTH: u32 = 64;

/// A decoded LMS contract event.
///
/// Variants wrap the same event structs the contract publishes, so a decoded
/// event is directly comparable to the value that was emitted.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum LmsEvent {
    CourseCreated(CourseCreated),
    CoursePublished(CoursePublished),
    CourseArchived(CourseArchived),
    ModuleCreated(ModuleCreated),
    LessonCreated(LessonCreated),
    StudentEnrolled(StudentEnrolled),
    StudentUnenrolled(StudentUnenrolled),
    LessonCompleted(LessonCompleted),
    CourseCompleted(CourseCompleted),
    AssessmentSubmitted(AssessmentSubmitted),
    CertificateIssued(CertificateIssued),
}

/// Categorized failure modes for [`decode_event`].
///
/// Variants intentionally carry no payload data: an error can be logged or
/// returned to an operator without ever leaking the offending input.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DecodeError {
    /// The input is not valid base64.
    InvalidBase64,
    /// The input decodes as base64, but the XDR ends before the event is
    /// complete.
    TruncatedXdr,
    /// The input is not a structurally valid Soroban `DiagnosticEvent`
    /// (bad discriminant, unsupported XDR, trailing garbage, ...).
    MalformedXdr,
    /// The input is a valid Soroban event, but not an LMS contract event
    /// (wrong topic prefix, unknown event name, or a non-contract event type).
    UnsupportedEvent,
    /// The event is an LMS event, but the emitting `contract_id` does not
    /// match the expected deployment id supplied to [`decode_event_from`].
    /// Categorized only: the offending id is never carried.
    UnexpectedContractId,
    /// The event is an LMS event, but its fields do not match the documented
    /// representation (missing, extra, or mistyped topics or data fields).
    InvalidPayload,
}

impl fmt::Display for DecodeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::InvalidBase64 => "input is not valid base64",
            Self::TruncatedXdr => "XDR is truncated: input ends before the event is complete",
            Self::MalformedXdr => "XDR is malformed: input is not a valid Soroban DiagnosticEvent",
            Self::UnsupportedEvent => "unsupported event: valid XDR, but not an LMS contract event",
            Self::UnexpectedContractId => {
                "unexpected contract id: event emitter does not match the expected deployment"
            }
            Self::InvalidPayload => {
                "invalid payload: event fields do not match the documented LMS representation"
            }
        };
        f.write_str(message)
    }
}

/// Decode a base64-encoded Soroban `DiagnosticEvent` into a typed LMS event.
///
/// Convenience entry point with **no source constraint**: the emitting
/// contract's `contract_id` is not checked, and an unnamed emitter is
/// accepted. Use [`decode_event_from`] when the extraction pipeline must gate
/// on a known deployment id.
///
/// See the [module documentation](self) for the input format, guarantees, and
/// limits. This function never panics.
pub fn decode_event(env: &Env, input: &str) -> Result<LmsEvent, DecodeError> {
    let diagnostic = parse_diagnostic(input)?;
    check_source(&diagnostic, None)?;
    decode_diagnostic_event(env, &diagnostic)
}

/// Decode a base64-encoded Soroban `DiagnosticEvent` into a typed LMS event,
/// requiring the emitting contract id to match `expected_contract`.
///
/// A `DiagnosticEvent` whose `contract_id` is `Some(expected)` (byte-identical
/// bytes) decodes successfully; a `Some(other)` emitter is rejected with
/// [`DecodeError::UnexpectedContractId`]; an absent emitter is rejected with
/// [`DecodeError::UnsupportedEvent`] (an LMS event must name its emitter). The
/// expected `[u8; 32]` is the raw contract id hash of the LMS deployment being
/// consumed.
///
/// See the [module documentation](self) for the input format, guarantees, and
/// limits. This function never panics.
pub fn decode_event_from(
    env: &Env,
    input: &str,
    expected_contract: &[u8; 32],
) -> Result<LmsEvent, DecodeError> {
    let diagnostic = parse_diagnostic(input)?;
    check_source(&diagnostic, Some(expected_contract))?;
    decode_diagnostic_event(env, &diagnostic)
}

/// Parse a base64-encoded `DiagnosticEvent` under the module's size and depth
/// limits, mapping parse failures onto the public error contract.
fn parse_diagnostic(input: &str) -> Result<DiagnosticEvent, DecodeError> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(input)
        .map_err(|_| DecodeError::InvalidBase64)?;
    let limits = Limits {
        depth: MAX_XDR_DEPTH,
        len: MAX_EVENT_BYTES,
    };
    DiagnosticEvent::from_xdr(&bytes, limits).map_err(classify_xdr_error)
}

/// Enforce the emitter source constraint.
///
/// `None` means unconstrained: any or absent emitter is accepted (the
/// [`decode_event`] convenience). `Some(expected)` requires the emitter to be
/// present and byte-identical to `expected`.
fn check_source(
    diagnostic: &DiagnosticEvent,
    expected_contract: Option<&[u8; 32]>,
) -> Result<(), DecodeError> {
    let Some(expected) = expected_contract else {
        return Ok(());
    };
    match &diagnostic.event.contract_id {
        // `contract_id` is `ContractId(pub Hash(pub [u8;32]))` in stellar-xdr 23.
        Some(ContractId(hash)) if hash.0 == *expected => Ok(()),
        // A well-formed LMS event naming a different contract is spoofed or
        // foreign; reject it without leaking the id.
        Some(_) => Err(DecodeError::UnexpectedContractId),
        // An LMS event must name its emitter.
        None => Err(DecodeError::UnsupportedEvent),
    }
}

/// Map an XDR parse failure onto the public error contract.
fn classify_xdr_error(err: XdrError) -> DecodeError {
    match err {
        // A read that hit the end of the buffer mid-value means the input
        // ended prematurely.
        XdrError::Io(io) if io.kind() == std::io::ErrorKind::UnexpectedEof => {
            DecodeError::TruncatedXdr
        }
        _ => DecodeError::MalformedXdr,
    }
}

/// Decode an already-parsed `DiagnosticEvent`.
fn decode_diagnostic_event(
    env: &Env,
    diagnostic: &DiagnosticEvent,
) -> Result<LmsEvent, DecodeError> {
    // Only contract events carry LMS topics; system and diagnostic events are
    // outside the LMS event set.
    if diagnostic.event.type_ != ContractEventType::Contract {
        return Err(DecodeError::UnsupportedEvent);
    }
    match &diagnostic.event.body {
        ContractEventBody::V0(v0) => decode_v0(env, v0.topics.as_slice(), &v0.data),
    }
}

/// Identify the event by its topic prefix and dispatch to its decoder.
fn decode_v0(env: &Env, topics: &[ScVal], data: &ScVal) -> Result<LmsEvent, DecodeError> {
    if symbol_bytes(topics.first()) != Some(LMS_TOPIC.as_bytes()) {
        return Err(DecodeError::UnsupportedEvent);
    }
    let Some(name) = symbol_bytes(topics.get(1)) else {
        return Err(DecodeError::UnsupportedEvent);
    };
    match name {
        b"course_created" => decode_course_created(env, topics, data),
        b"course_published" => decode_course_published(env, topics, data),
        b"course_archived" => decode_course_archived(env, topics, data),
        b"module_created" => decode_module_created(env, topics, data),
        b"lesson_created" => decode_lesson_created(env, topics, data),
        b"student_enrolled" => decode_student_enrolled(env, topics, data),
        b"student_unenrolled" => decode_student_unenrolled(env, topics, data),
        b"lesson_completed" => decode_lesson_completed(env, topics, data),
        b"course_completed" => decode_course_completed(env, topics, data),
        b"assessment_submitted" => decode_assessment_submitted(env, topics, data),
        b"certificate_issued" => decode_certificate_issued(env, topics, data),
        _ => Err(DecodeError::UnsupportedEvent),
    }
}

// ---------------------------------------------------------------------------
// Per-event decoders. Each one validates the exact topic layout of the
// documented representation and looks data fields up by name in the data map
// (the `#[contractevent]` macro emits data as a map keyed by field name, with
// keys sorted alphabetically, so position-independent lookup is required).
// Unknown extra data keys are ignored for forward compatibility; anything
// missing or mistyped is `InvalidPayload`.
// ---------------------------------------------------------------------------

fn decode_course_created(
    env: &Env,
    topics: &[ScVal],
    data: &ScVal,
) -> Result<LmsEvent, DecodeError> {
    if topics.len() != 3 {
        return Err(DecodeError::InvalidPayload);
    }
    let course_id = topic_u32(&topics[2])?;
    let entries = data_entries(data)?;
    let creator = field_address(env, entries, "creator")?;
    let total_lessons = field_u32(entries, "total_lessons")?;
    Ok(LmsEvent::CourseCreated(CourseCreated {
        course_id,
        creator,
        total_lessons,
    }))
}

fn decode_course_published(
    env: &Env,
    topics: &[ScVal],
    data: &ScVal,
) -> Result<LmsEvent, DecodeError> {
    if topics.len() != 3 {
        return Err(DecodeError::InvalidPayload);
    }
    let course_id = topic_u32(&topics[2])?;
    let publisher = field_address(env, data_entries(data)?, "publisher")?;
    Ok(LmsEvent::CoursePublished(CoursePublished {
        course_id,
        publisher,
    }))
}

fn decode_course_archived(
    env: &Env,
    topics: &[ScVal],
    data: &ScVal,
) -> Result<LmsEvent, DecodeError> {
    if topics.len() != 3 {
        return Err(DecodeError::InvalidPayload);
    }
    let course_id = topic_u32(&topics[2])?;
    let archiver = field_address(env, data_entries(data)?, "archiver")?;
    Ok(LmsEvent::CourseArchived(CourseArchived {
        course_id,
        archiver,
    }))
}

fn decode_module_created(
    env: &Env,
    topics: &[ScVal],
    data: &ScVal,
) -> Result<LmsEvent, DecodeError> {
    if topics.len() != 4 {
        return Err(DecodeError::InvalidPayload);
    }
    let course_id = topic_u32(&topics[2])?;
    let module_id = topic_u32(&topics[3])?;
    let creator = field_address(env, data_entries(data)?, "creator")?;
    Ok(LmsEvent::ModuleCreated(ModuleCreated {
        course_id,
        module_id,
        creator,
    }))
}

fn decode_lesson_created(
    env: &Env,
    topics: &[ScVal],
    data: &ScVal,
) -> Result<LmsEvent, DecodeError> {
    if topics.len() != 5 {
        return Err(DecodeError::InvalidPayload);
    }
    let course_id = topic_u32(&topics[2])?;
    let module_id = topic_u32(&topics[3])?;
    let lesson_id = topic_u32(&topics[4])?;
    let creator = field_address(env, data_entries(data)?, "creator")?;
    Ok(LmsEvent::LessonCreated(LessonCreated {
        course_id,
        module_id,
        lesson_id,
        creator,
    }))
}

fn decode_student_enrolled(
    env: &Env,
    topics: &[ScVal],
    data: &ScVal,
) -> Result<LmsEvent, DecodeError> {
    if topics.len() != 4 {
        return Err(DecodeError::InvalidPayload);
    }
    let course_id = topic_u32(&topics[2])?;
    let student = topic_address(env, &topics[3])?;
    data_entries(data)?; // no data fields; must still be a map
    Ok(LmsEvent::StudentEnrolled(StudentEnrolled {
        course_id,
        student,
    }))
}

fn decode_student_unenrolled(
    env: &Env,
    topics: &[ScVal],
    data: &ScVal,
) -> Result<LmsEvent, DecodeError> {
    if topics.len() != 4 {
        return Err(DecodeError::InvalidPayload);
    }
    let course_id = topic_u32(&topics[2])?;
    let student = topic_address(env, &topics[3])?;
    data_entries(data)?;
    Ok(LmsEvent::StudentUnenrolled(StudentUnenrolled {
        course_id,
        student,
    }))
}

fn decode_lesson_completed(
    env: &Env,
    topics: &[ScVal],
    data: &ScVal,
) -> Result<LmsEvent, DecodeError> {
    if topics.len() != 5 {
        return Err(DecodeError::InvalidPayload);
    }
    let course_id = topic_u32(&topics[2])?;
    let lesson_index = topic_u32(&topics[3])?;
    let student = topic_address(env, &topics[4])?;
    data_entries(data)?;
    Ok(LmsEvent::LessonCompleted(LessonCompleted {
        course_id,
        lesson_index,
        student,
    }))
}

fn decode_course_completed(
    env: &Env,
    topics: &[ScVal],
    data: &ScVal,
) -> Result<LmsEvent, DecodeError> {
    if topics.len() != 4 {
        return Err(DecodeError::InvalidPayload);
    }
    let course_id = topic_u32(&topics[2])?;
    let student = topic_address(env, &topics[3])?;
    data_entries(data)?;
    Ok(LmsEvent::CourseCompleted(CourseCompleted {
        course_id,
        student,
    }))
}

fn decode_assessment_submitted(
    env: &Env,
    topics: &[ScVal],
    data: &ScVal,
) -> Result<LmsEvent, DecodeError> {
    if topics.len() != 4 {
        return Err(DecodeError::InvalidPayload);
    }
    let assessment_id = topic_u64(&topics[2])?;
    let student = topic_address(env, &topics[3])?;
    let entries = data_entries(data)?;
    let attempt = field_u32(entries, "attempt")?;
    let score = field_u32(entries, "score")?;
    let passed = field_bool(entries, "passed")?;
    Ok(LmsEvent::AssessmentSubmitted(AssessmentSubmitted {
        assessment_id,
        student,
        attempt,
        score,
        passed,
    }))
}

fn decode_certificate_issued(
    env: &Env,
    topics: &[ScVal],
    data: &ScVal,
) -> Result<LmsEvent, DecodeError> {
    if topics.len() != 5 {
        return Err(DecodeError::InvalidPayload);
    }
    let certificate_id = topic_u64(&topics[2])?;
    let course_id = topic_u32(&topics[3])?;
    let student = topic_address(env, &topics[4])?;
    data_entries(data)?;
    Ok(LmsEvent::CertificateIssued(CertificateIssued {
        certificate_id,
        course_id,
        student,
    }))
}

// ---------------------------------------------------------------------------
// Topic field readers.
// ---------------------------------------------------------------------------

fn topic_u32(topic: &ScVal) -> Result<u32, DecodeError> {
    match topic {
        ScVal::U32(value) => Ok(*value),
        _ => Err(DecodeError::InvalidPayload),
    }
}

fn topic_u64(topic: &ScVal) -> Result<u64, DecodeError> {
    match topic {
        ScVal::U64(value) => Ok(*value),
        _ => Err(DecodeError::InvalidPayload),
    }
}

fn topic_address(env: &Env, topic: &ScVal) -> Result<Address, DecodeError> {
    Address::try_from_val(env, topic).map_err(|_| DecodeError::InvalidPayload)
}

// ---------------------------------------------------------------------------
// Data field readers. The data ScVal must be a map; fields are read by name
// because the `#[contractevent]` macro serializes data fields as a map keyed
// by field name (keys sorted alphabetically).
// ---------------------------------------------------------------------------

fn data_entries(data: &ScVal) -> Result<&[ScMapEntry], DecodeError> {
    match data {
        ScVal::Map(Some(entries)) => Ok(entries.as_slice()),
        _ => Err(DecodeError::InvalidPayload),
    }
}

fn find_entry<'a>(entries: &'a [ScMapEntry], key: &str) -> Option<&'a ScVal> {
    entries.iter().find_map(|entry| match &entry.key {
        ScVal::Symbol(ScSymbol(symbol)) if symbol.as_slice() == key.as_bytes() => Some(&entry.val),
        _ => None,
    })
}

fn field_u32(entries: &[ScMapEntry], key: &str) -> Result<u32, DecodeError> {
    match find_entry(entries, key) {
        Some(ScVal::U32(value)) => Ok(*value),
        _ => Err(DecodeError::InvalidPayload),
    }
}

fn field_bool(entries: &[ScMapEntry], key: &str) -> Result<bool, DecodeError> {
    match find_entry(entries, key) {
        Some(ScVal::Bool(value)) => Ok(*value),
        _ => Err(DecodeError::InvalidPayload),
    }
}

fn field_address(env: &Env, entries: &[ScMapEntry], key: &str) -> Result<Address, DecodeError> {
    match find_entry(entries, key) {
        Some(scval) => Address::try_from_val(env, scval).map_err(|_| DecodeError::InvalidPayload),
        None => Err(DecodeError::InvalidPayload),
    }
}

/// The raw bytes of an `ScVal::Symbol`, if `scval` is one.
fn symbol_bytes(scval: Option<&ScVal>) -> Option<&[u8]> {
    match scval {
        Some(ScVal::Symbol(ScSymbol(symbol))) => Some(symbol.as_slice()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{string::String, vec, vec::Vec};

    use base64::Engine;
    use soroban_sdk::testutils::{Address as _, Events as _};
    use soroban_sdk::xdr::{
        ContractEvent, ContractEventBody, ContractEventType, ContractEventV0, ContractId,
        DiagnosticEvent, ExtensionPoint, Limits, ScAddress, ScMap, ScMapEntry, ScString, ScSymbol,
        ScVal, StringM, VecM, WriteXdr,
    };
    use soroban_sdk::{Address, Env, TryFromVal};

    /// Deploy the contract so `as_contract` has a real instance to run
    /// against (the host refuses event publication from an unregistered
    /// address).
    fn deploy() -> (Env, Address) {
        let env = Env::default();
        let contract_id = env.register(crate::LmsContract, ());
        (env, contract_id)
    }

    // -----------------------------------------------------------------------
    // Building DiagnosticEvent XDR, exactly as Stellar RPC returns it.
    // -----------------------------------------------------------------------

    /// Encode a `DiagnosticEvent` to base64 XDR — the format `decode_event`
    /// accepts.
    fn encode_diagnostic(
        successful: bool,
        contract_id: Option<ContractId>,
        type_: ContractEventType,
        topics: Vec<ScVal>,
        data: ScVal,
    ) -> String {
        let event = ContractEvent {
            ext: ExtensionPoint::V0,
            contract_id,
            type_,
            body: ContractEventBody::V0(ContractEventV0 {
                topics: VecM::try_from(topics).unwrap(),
                data,
            }),
        };
        let diagnostic = DiagnosticEvent {
            in_successful_contract_call: successful,
            event,
        };
        diagnostic.to_xdr_base64(Limits::none()).unwrap()
    }

    /// Convenience for the common case: a contract event with no contract id.
    fn encode_contract_event(topics: Vec<ScVal>, data: ScVal) -> String {
        encode_diagnostic(true, None, ContractEventType::Contract, topics, data)
    }

    /// Publish an event through the host (as the contract would) and return
    /// its base64 XDR, as `env.events().all()` reports it.
    fn encoded_latest(env: &Env) -> String {
        let (contract, topics, data) = env.events().all().get(0).unwrap();
        let contract_id = match ScVal::from(&contract) {
            ScVal::Address(ScAddress::Contract(contract_id)) => Some(contract_id),
            _ => panic!("expected a contract address"),
        };
        let topics: Vec<ScVal> = topics
            .iter()
            .map(|topic| ScVal::try_from_val(env, &topic).unwrap())
            .collect();
        let data = ScVal::try_from_val(env, &data).unwrap();
        encode_diagnostic(true, contract_id, ContractEventType::Contract, topics, data)
    }

    /// Publish an event inside a contract frame, then decode the single event
    /// the host recorded.
    fn publish_and_decode<T>(env: &Env, contract_id: &Address, event: T) -> LmsEvent
    where
        T: soroban_sdk::Event,
    {
        env.as_contract(contract_id, || event.publish(env));
        decode_event(env, &encoded_latest(env)).unwrap()
    }

    // -----------------------------------------------------------------------
    // Hand-crafted ScVal helpers for malformed-input tests.
    // -----------------------------------------------------------------------

    fn symbol(value: &str) -> ScVal {
        ScVal::Symbol(ScSymbol(StringM::<32>::try_from(value).unwrap()))
    }

    fn address_value(address: &Address) -> ScVal {
        ScVal::from(address)
    }

    fn map(entries: &[(ScVal, ScVal)]) -> ScVal {
        let entries: Vec<ScMapEntry> = entries
            .iter()
            .map(|(key, val)| ScMapEntry {
                key: key.clone(),
                val: val.clone(),
            })
            .collect();
        ScVal::Map(Some(ScMap(VecM::try_from(entries).unwrap())))
    }

    fn course_created_topics(course_id: u32) -> Vec<ScVal> {
        vec![
            symbol("lms"),
            symbol("course_created"),
            ScVal::U32(course_id),
        ]
    }

    /// Data map exactly as the `#[contractevent]` macro emits it: keys sorted
    /// alphabetically.
    fn course_created_data(creator: &Address, total_lessons: u32) -> ScVal {
        map(&[
            (symbol("creator"), address_value(creator)),
            (symbol("total_lessons"), ScVal::U32(total_lessons)),
        ])
    }

    // -----------------------------------------------------------------------
    // Round trips: every event type decodes to exactly what was published.
    // -----------------------------------------------------------------------

    #[test]
    fn course_created_round_trips() {
        let (env, contract_id) = deploy();
        let creator = Address::generate(&env);

        let event = CourseCreated {
            course_id: 7,
            creator: creator.clone(),
            total_lessons: 12,
        };
        let decoded = publish_and_decode(&env, &contract_id, event.clone());
        assert_eq!(decoded, LmsEvent::CourseCreated(event));
    }

    #[test]
    fn course_published_round_trips() {
        let (env, contract_id) = deploy();
        let publisher = Address::generate(&env);

        let event = CoursePublished {
            course_id: 3,
            publisher: publisher.clone(),
        };
        let decoded = publish_and_decode(&env, &contract_id, event.clone());
        assert_eq!(decoded, LmsEvent::CoursePublished(event));
    }

    #[test]
    fn course_archived_round_trips() {
        let (env, contract_id) = deploy();
        let archiver = Address::generate(&env);

        let event = CourseArchived {
            course_id: 5,
            archiver: archiver.clone(),
        };
        let decoded = publish_and_decode(&env, &contract_id, event.clone());
        assert_eq!(decoded, LmsEvent::CourseArchived(event));
    }

    #[test]
    fn module_created_round_trips() {
        let (env, contract_id) = deploy();
        let creator = Address::generate(&env);

        let event = ModuleCreated {
            course_id: 1,
            module_id: 2,
            creator: creator.clone(),
        };
        let decoded = publish_and_decode(&env, &contract_id, event.clone());
        assert_eq!(decoded, LmsEvent::ModuleCreated(event));
    }

    #[test]
    fn lesson_created_round_trips() {
        let (env, contract_id) = deploy();
        let creator = Address::generate(&env);

        let event = LessonCreated {
            course_id: 1,
            module_id: 2,
            lesson_id: 3,
            creator: creator.clone(),
        };
        let decoded = publish_and_decode(&env, &contract_id, event.clone());
        assert_eq!(decoded, LmsEvent::LessonCreated(event));
    }

    #[test]
    fn student_enrolled_round_trips() {
        let (env, contract_id) = deploy();
        let student = Address::generate(&env);

        let event = StudentEnrolled {
            course_id: 9,
            student: student.clone(),
        };
        let decoded = publish_and_decode(&env, &contract_id, event.clone());
        assert_eq!(decoded, LmsEvent::StudentEnrolled(event));
    }

    #[test]
    fn student_unenrolled_round_trips() {
        let (env, contract_id) = deploy();
        let student = Address::generate(&env);

        let event = StudentUnenrolled {
            course_id: 9,
            student: student.clone(),
        };
        let decoded = publish_and_decode(&env, &contract_id, event.clone());
        assert_eq!(decoded, LmsEvent::StudentUnenrolled(event));
    }

    #[test]
    fn lesson_completed_round_trips() {
        let (env, contract_id) = deploy();
        let student = Address::generate(&env);

        let event = LessonCompleted {
            course_id: 1,
            lesson_index: 4,
            student: student.clone(),
        };
        let decoded = publish_and_decode(&env, &contract_id, event.clone());
        assert_eq!(decoded, LmsEvent::LessonCompleted(event));
    }

    #[test]
    fn course_completed_round_trips() {
        let (env, contract_id) = deploy();
        let student = Address::generate(&env);

        let event = CourseCompleted {
            course_id: 1,
            student: student.clone(),
        };
        let decoded = publish_and_decode(&env, &contract_id, event.clone());
        assert_eq!(decoded, LmsEvent::CourseCompleted(event));
    }

    #[test]
    fn assessment_submitted_round_trips() {
        let (env, contract_id) = deploy();
        let student = Address::generate(&env);

        let event = AssessmentSubmitted {
            assessment_id: 42,
            student: student.clone(),
            attempt: 2,
            score: 90,
            passed: true,
        };
        let decoded = publish_and_decode(&env, &contract_id, event.clone());
        assert_eq!(decoded, LmsEvent::AssessmentSubmitted(event));
    }

    #[test]
    fn certificate_issued_round_trips() {
        let (env, contract_id) = deploy();
        let student = Address::generate(&env);

        let event = CertificateIssued {
            certificate_id: 100,
            course_id: 1,
            student: student.clone(),
        };
        let decoded = publish_and_decode(&env, &contract_id, event.clone());
        assert_eq!(decoded, LmsEvent::CertificateIssued(event));
    }

    // -----------------------------------------------------------------------
    // Rejection paths.
    // -----------------------------------------------------------------------

    #[test]
    fn invalid_base64_is_rejected() {
        let env = Env::default();

        assert_eq!(
            decode_event(&env, "!!! not base64 !!!"),
            Err(DecodeError::InvalidBase64)
        );
    }

    #[test]
    fn empty_input_is_truncated() {
        let env = Env::default();

        // The empty string is valid base64, but the XDR behind it ends before
        // the event is complete.
        assert_eq!(decode_event(&env, ""), Err(DecodeError::TruncatedXdr));
    }

    #[test]
    fn truncated_xdr_is_rejected() {
        let (env, contract_id) = deploy();
        let creator = Address::generate(&env);
        env.as_contract(&contract_id, || {
            crate::events::course_created(&env, 1, &creator, 3)
        });
        let valid = encoded_latest(&env);

        // Chop the event down to its first four bytes (the
        // `in_successful_contract_call` discriminant); everything after it is
        // missing.
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(&valid)
            .unwrap();
        let input = base64::engine::general_purpose::STANDARD.encode(&bytes[..4]);

        assert_eq!(decode_event(&env, &input), Err(DecodeError::TruncatedXdr));
    }

    #[test]
    fn garbage_bytes_are_rejected() {
        let env = Env::default();

        let input = base64::engine::general_purpose::STANDARD.encode([0xffu8; 32]);

        assert_eq!(decode_event(&env, &input), Err(DecodeError::MalformedXdr));
    }

    #[test]
    fn trailing_garbage_after_a_valid_event_is_rejected() {
        let (env, contract_id) = deploy();
        let creator = Address::generate(&env);
        env.as_contract(&contract_id, || {
            crate::events::course_created(&env, 1, &creator, 3)
        });
        let valid = encoded_latest(&env);

        let mut bytes = base64::engine::general_purpose::STANDARD
            .decode(&valid)
            .unwrap();
        bytes.extend_from_slice(&[0u8; 8]);
        let input = base64::engine::general_purpose::STANDARD.encode(&bytes);

        assert_eq!(decode_event(&env, &input), Err(DecodeError::MalformedXdr));
    }

    #[test]
    fn a_non_lms_topic_prefix_is_rejected() {
        let env = Env::default();

        let topics = vec![symbol("other"), symbol("course_created"), ScVal::U32(1)];
        let input = encode_contract_event(topics, ScVal::Void);

        assert_eq!(
            decode_event(&env, &input),
            Err(DecodeError::UnsupportedEvent)
        );
    }

    #[test]
    fn an_unknown_event_name_is_rejected() {
        let env = Env::default();

        let topics = vec![symbol("lms"), symbol("mystery_event"), ScVal::U32(1)];
        let input = encode_contract_event(topics, ScVal::Void);

        assert_eq!(
            decode_event(&env, &input),
            Err(DecodeError::UnsupportedEvent)
        );
    }

    #[test]
    fn a_missing_event_name_topic_is_rejected() {
        let env = Env::default();

        let input = encode_contract_event(vec![symbol("lms")], ScVal::Void);

        assert_eq!(
            decode_event(&env, &input),
            Err(DecodeError::UnsupportedEvent)
        );
    }

    #[test]
    fn a_diagnostic_type_event_is_rejected() {
        let env = Env::default();

        let input = encode_diagnostic(
            true,
            None,
            ContractEventType::Diagnostic,
            vec![],
            ScVal::Void,
        );

        assert_eq!(
            decode_event(&env, &input),
            Err(DecodeError::UnsupportedEvent)
        );
    }

    #[test]
    fn the_wrong_number_of_topics_is_rejected() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // `course_created` needs exactly three topics; give it two.
        let topics = vec![symbol("lms"), symbol("course_created")];
        let input = encode_contract_event(topics, course_created_data(&creator, 4));

        assert_eq!(decode_event(&env, &input), Err(DecodeError::InvalidPayload));
    }

    #[test]
    fn a_mistyped_topic_is_rejected() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // The course id must be a u32; a u64 is a different topic type.
        let topics = vec![symbol("lms"), symbol("course_created"), ScVal::U64(1)];
        let input = encode_contract_event(topics, course_created_data(&creator, 4));

        assert_eq!(decode_event(&env, &input), Err(DecodeError::InvalidPayload));
    }

    #[test]
    fn a_missing_data_field_is_rejected() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // The data map is missing `total_lessons`.
        let data = map(&[(symbol("creator"), address_value(&creator))]);
        let input = encode_contract_event(course_created_topics(1), data);

        assert_eq!(decode_event(&env, &input), Err(DecodeError::InvalidPayload));
    }

    #[test]
    fn data_that_is_not_a_map_is_rejected() {
        let env = Env::default();

        let input = encode_contract_event(course_created_topics(1), ScVal::U32(1));

        assert_eq!(decode_event(&env, &input), Err(DecodeError::InvalidPayload));
    }

    #[test]
    fn extra_data_fields_are_ignored() {
        let env = Env::default();
        let publisher = Address::generate(&env);

        // An unknown data key must not break decoding: it may belong to a
        // newer contract version.
        let data = map(&[
            (symbol("extra_future_field"), ScVal::U32(99)),
            (symbol("publisher"), address_value(&publisher)),
        ]);
        let topics = vec![symbol("lms"), symbol("course_published"), ScVal::U32(3)];
        let input = encode_contract_event(topics, data);

        assert_eq!(
            decode_event(&env, &input),
            Ok(LmsEvent::CoursePublished(CoursePublished {
                course_id: 3,
                publisher,
            }))
        );
    }

    #[test]
    fn decode_event_from_accepts_a_matching_contract_id() {
        let (env, contract_id) = deploy();
        let creator = Address::generate(&env);
        env.as_contract(&contract_id, || {
            crate::events::course_created(&env, 1, &creator, 3)
        });
        let input = encoded_latest(&env);

        // A real, registered contract id (as `env.events().all()` reports it)
        // must decode when supplied as the expected emitter.
        let expected = match ScVal::from(&contract_id) {
            ScVal::Address(ScAddress::Contract(ContractId(hash))) => hash.0,
            _ => panic!("expected a contract address"),
        };

        assert_eq!(
            decode_event_from(&env, &input, &expected),
            Ok(LmsEvent::CourseCreated(CourseCreated {
                course_id: 1,
                creator,
                total_lessons: 3,
            }))
        );
    }

    #[test]
    fn decode_event_from_rejects_a_mismatching_contract_id() {
        let (env, contract_id) = deploy();
        let creator = Address::generate(&env);
        env.as_contract(&contract_id, || {
            crate::events::course_created(&env, 1, &creator, 3)
        });
        let input = encoded_latest(&env);

        let expected = match ScVal::from(&contract_id) {
            ScVal::Address(ScAddress::Contract(ContractId(hash))) => hash.0,
            _ => panic!("expected a contract address"),
        };
        // Flip a byte so the expected id differs from the real emitter.
        let mut other = expected;
        other[0] ^= 0xff;

        assert_eq!(
            decode_event_from(&env, &input, &other),
            Err(DecodeError::UnexpectedContractId)
        );
    }

    #[test]
    fn decode_event_from_rejects_an_absent_contract_id() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // No contract id means the emitter is unnamed; an LMS event must name
        // its emitter, so this is rejected (and not silently accepted).
        let input =
            encode_contract_event(course_created_topics(1), course_created_data(&creator, 2));
        let expected = [0u8; 32];

        assert_eq!(
            decode_event_from(&env, &input, &expected),
            Err(DecodeError::UnsupportedEvent)
        );
    }

    #[test]
    fn decode_event_from_rejects_a_lms_event_from_a_foreign_contract() {
        let (env, contract_id) = deploy();
        let creator = Address::generate(&env);
        // The event names a real but *different* contract than the one under
        // test, so it is a well-formed LMS event from a foreign emitter.
        let other_contract = Address::generate(&env);

        let input = encode_diagnostic(
            true,
            Some(match ScVal::from(&other_contract) {
                ScVal::Address(ScAddress::Contract(cid)) => cid,
                _ => panic!("expected a contract address"),
            }),
            ContractEventType::Contract,
            course_created_topics(1),
            course_created_data(&creator, 2),
        );
        let expected = match ScVal::from(&contract_id) {
            ScVal::Address(ScAddress::Contract(ContractId(hash))) => hash.0,
            _ => panic!("expected a contract address"),
        };

        assert_eq!(
            decode_event_from(&env, &input, &expected),
            Err(DecodeError::UnexpectedContractId)
        );
    }

    #[test]
    fn decode_event_is_unconstrained_about_the_emitter() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // `decode_event` (no source constraint) accepts both an unnamed
        // emitter and one with any contract id.
        let unnamed =
            encode_contract_event(course_created_topics(1), course_created_data(&creator, 2));
        assert!(decode_event(&env, &unnamed).is_ok());

        let foreign = encode_diagnostic(
            true,
            Some({
                let other = Address::generate(&env);
                match ScVal::from(&other) {
                    ScVal::Address(ScAddress::Contract(cid)) => cid,
                    _ => panic!("expected a contract address"),
                }
            }),
            ContractEventType::Contract,
            course_created_topics(1),
            course_created_data(&creator, 2),
        );
        assert!(decode_event(&env, &foreign).is_ok());
    }

    #[test]
    fn events_from_failed_calls_are_decoded_like_any_other() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // The decoder must not care about `in_successful_contract_call`; that
        // is the caller's decision.
        let input = encode_diagnostic(
            false,
            None,
            ContractEventType::Contract,
            course_created_topics(1),
            course_created_data(&creator, 2),
        );

        assert_eq!(
            decode_event(&env, &input),
            Ok(LmsEvent::CourseCreated(CourseCreated {
                course_id: 1,
                creator,
                total_lessons: 2,
            }))
        );
    }

    #[test]
    fn an_oversized_event_is_rejected() {
        let env = Env::default();

        // A payload far larger than MAX_EVENT_BYTES (16 KiB) must be refused
        // at the XDR layer.
        let big_data = ScVal::String(ScString(StringM::try_from(vec![b'x'; 20 * 1024]).unwrap()));
        let input = encode_contract_event(course_created_topics(1), big_data);

        assert_eq!(decode_event(&env, &input), Err(DecodeError::MalformedXdr));
    }

    proptest::proptest! {
        /// `decode_event` never panics: arbitrary bytes (base64-encoded to
        /// exercise the XDR parser) must always produce an `Ok` or an `Err`.
        #[test]
        fn decode_never_panics_on_arbitrary_bytes(
            bytes in proptest::collection::vec(proptest::prelude::any::<u8>(), 0..4096)
        ) {
            let env = Env::default();
            let input = base64::engine::general_purpose::STANDARD.encode(&bytes);
            let _ = decode_event(&env, &input);
        }

        /// `decode_event` never panics on arbitrary text either.
        #[test]
        fn decode_never_panics_on_arbitrary_strings(s in "\\PC*") {
            let env = Env::default();
            let _ = decode_event(&env, &s);
        }
    }
}
