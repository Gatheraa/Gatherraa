use soroban_sdk::{contract, contractimpl, Address, Env};
use super::types::{ProgressError, ModuleProgressRecord};

#[contract]
pub struct ModuleProgressContract;

#[contractimpl]
impl ModuleProgressContract {
    /// Calculate module progress percentage (Returns value from 0 to 100)
    pub fn get_module_progress(
        env: Env,
        student: Address,
        module_id: u64,
    ) -> Result<u32, ProgressError> {
        let record = Self::fetch_progress_record(&env, &student, module_id)?;

        if record.total_required_lessons == 0 {
            return Ok(0);
        }

        let progress = (record.completed_lessons * 100) / record.total_required_lessons;
        Ok(progress)
    }

    /// Check whether a module is fully completed (100%)
    pub fn is_module_completed(
        env: Env,
        student: Address,
        module_id: u64,
    ) -> Result<bool, ProgressError> {
        let record = Self::fetch_progress_record(&env, &student, module_id)?;
        
        Ok(record.completed_lessons >= record.total_required_lessons && record.total_required_lessons > 0)
    }

    fn fetch_progress_record(env: &Env, student: &Address, module_id: u64) -> Result<ModuleProgressRecord, ProgressError> {
        let key = (student, module_id);
        env.storage().persistent().get(&key).ok_or(ProgressError::ModuleNotFound)
    }
}