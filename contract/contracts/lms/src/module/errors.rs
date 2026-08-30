use soroban_sdk::contracterror;

/// Errors produced by module management operations.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ModuleError {
    ModuleAlreadyExists = 1,
    ModuleNotFound = 2,
    CourseNotFound = 3,
    Unauthorized = 4,
    UserNotRegistered = 5,
}
