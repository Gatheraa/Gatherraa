use soroban_sdk::contracterror;

/// Errors produced by enrollment operations.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum EnrollmentError {
    /// The caller is not registered with the Student role.
    StudentNotRegistered = 1,
    /// No course exists under the given identifier.
    CourseNotFound = 2,
    /// The course has not been published yet.
    CourseNotPublished = 3,
    /// The student already holds an enrollment record for the course.
    AlreadyEnrolled = 4,
    /// The student has no active enrollment in the course.
    NotEnrolled = 5,
}
