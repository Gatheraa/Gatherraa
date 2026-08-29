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

    /// The course title is empty.
    InvalidTitle = 5,

    /// The course description URI is empty.
    InvalidDescriptionUri = 6,

    /// The course price is negative.
    InvalidPrice = 7,
    CourseAlreadyPublished = 5,
}
