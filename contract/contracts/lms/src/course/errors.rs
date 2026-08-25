use soroban_sdk::contracterror;

/// Errors produced by course management operations.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum CourseError {
    CourseAlreadyExists = 1,
    CourseNotFound = 2,
    Unauthorized = 3,
    UserNotRegistered = 4,
    CourseAlreadyPublished = 5,
}
