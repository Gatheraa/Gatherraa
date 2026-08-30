use soroban_sdk::{contract, contractimpl, token, Address, Env};
use super::types::{Course, EnrollmentError, EnrollmentRecord};

#[contract]
pub struct CourseEnrollmentContract;

#[contractimpl]
impl CourseEnrollmentContract {
    /// Enroll a student in a course (Handles both free and paid logic atomically)
    pub fn enroll(
        env: Env,
        student: Address,
        course_id: u64,
        payment_amount: i128,
    ) -> Result<(), EnrollmentError> {
        student.require_auth();

        // 1. Fetch course details from storage (mocked lookup for illustration)
        let course = Self::get_course(env.clone(), course_id)?;

        // 2. Handle free vs paid logic
        if course.fee == 0 {
            if payment_amount > 0 {
                return Err(EnrollmentError::FreeCourseDoesNotRequirePayment);
            }
        } else {
            // Paid course constraints
            if payment_amount != course.fee {
                return Err(EnrollmentError::IncorrectPaymentAmount];
            }

            let token_addr = course.token_address.ok_or(EnrollmentError::PaymentFailed)?;
            let token_client = token::Client::new(&env, &token_addr);

            // Atomic Transfer: Student -> Contract Treasury / Instructor
            // This panics/reverts automatically on failure, ensuring atomicity
            token_client.transfer(&student, &course.instructor, &payment_amount);
        }

        // 3. Record enrollment state post-payment success
        let enrollment = EnrollmentRecord {
            student: student.clone(),
            course_id,
            paid_amount: payment_amount,
            timestamp: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&(&student, &course_id), &enrollment);

        Ok(())
    }

    fn get_course(_env: Env, course_id: u64) -> Result<Course, EnrollmentError> {
        // Placeholder lookup stub
        Ok(Course {
            id: course_id,
            instructor: Address::from_string(&soroban_sdk::String::from_str(
                &_env,
                "GD6WU64OEPX7SKXBG57VFRSFICMW2WGLUNQJYNCA7AKDVPIGTUWP7OMK",
            )),
            fee: 100_0000000, // 10 tokens with 7 decimals
            token_address: Some(Address::from_string(&soroban_sdk::String::from_str(
                &_env,
                "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
            ))),
        })
    }
}