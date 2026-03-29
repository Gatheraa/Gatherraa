# Event Specification

## DonationEvent

| Field | Type | Description |
|------|------|------------|
| event_type | felt252 | "DONATION" |
| donor | ContractAddress | Sender address |
| project_id | felt252 | Target project |
| amount | u256 | Donation amount |
| asset | felt252 | Token symbol |
| tx_hash | felt252 | Transaction hash |
| timestamp | u64 | Block timestamp |