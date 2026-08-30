use soroban_sdk::{contracttype, Address, Env};

/// A student's result for one assessment attempt, as exposed to the frontend.
///
/// Mirrors the result shape the assessment module (#651/#652) persists, so
/// the frontend can integrate against a stable response today and the query
/// can be switched to the real storage read when that module lands.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssessmentResultView {
    /// The student the result belongs to.
    pub student: Address,

    /// The assessment the result is for.
    pub assessment_id: u64,

    /// The submitted score.
    pub score: u32,

    /// Whether the score met the assessment's passing threshold.
    pub passed: bool,

    /// Which attempt this result is (1-based).
    pub attempt: u32,

    /// Ledger timestamp of the submission.
    pub submitted_at: u64,
}

/// Read-only assessment queries (#656).
pub struct AssessmentQueries;

impl AssessmentQueries {
    /// Fetch a student's result for an assessment, if one exists.
    ///
    /// Returns `None` today: assessment storage is not wired into the
    /// contract yet (the assessment module is tracked in #651/#652). When it
    /// lands this will read `StorageKey::AssessmentResult(student,
    /// assessment_id, attempt)` and return the stored result.
    pub fn get_assessment_result(
        env: &Env,
        student: &Address,
        assessment_id: u64,
    ) -> Option<AssessmentResultView> {
        let _ = (env, student, assessment_id);
        None
    }
}
