use soroban_sdk::{contracterror, contracttype, Address};

#[contracterror]
#[Copy]
#[clone]
#[derive(Debug, PartialEq, Eq)]
pub enum ProgressError {
    ModuleNotFound = 1,
    NoLessonsFound = 2,
    Unauthorized = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ModuleProgressRecord {
    pub student: Address,
    pub module_id: u64,
    pub completed_lessons: u32,
    pub total_required_lessons: u32,
}