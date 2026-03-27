use soroban_sdk::{Env, BytesN, Vec};

pub fn verify(
    env: &Env,
    root: BytesN<32>,
    leaf: BytesN<32>,
    proof: Vec<BytesN<32>>,
) -> bool {
    let mut computed_hash = leaf;

    for node in proof.iter() {
        let mut data = [0u8; 64];
        if computed_hash.to_array() < node.to_array() {
            data[..32].copy_from_slice(&computed_hash.to_array());
            data[32..].copy_from_slice(&node.to_array());
        } else {
            data[..32].copy_from_slice(&node.to_array());
            data[32..].copy_from_slice(&computed_hash.to_array());
        }
        computed_hash = env.crypto().sha256(&data.into());
    }

    computed_hash == root
}
