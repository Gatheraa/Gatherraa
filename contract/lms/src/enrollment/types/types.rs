use soroban_sdk::{contracterror, contracttype, Address};

#[contracterror]
#[Copy]
#[clone]
#[derive(Debug, PartialEq, Eq)]
pub enum EnrollmentError {
    AlreadyEnrolled = 1,
    CourseNotFound = 2,
    IncorrectPaymentAmount = 3,
    PaymentFailed = 4,
    FreeCourseDoesNotRequirePayment = 5,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Course {
    pub id: u64,
    pub instructor: Address,
    pub fee: i128, // 0 if free, token amount if paid
    pub token_address: Option<Address>, // None if free
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EnrollmentRecord {
    pub student: Address,
    pub course_id: u64,
    pub paid_amount: i128,
    pub timestamp: u64,
}