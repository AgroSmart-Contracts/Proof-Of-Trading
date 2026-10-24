//! Throwaway spike: can a contract be the SAC admin of an AUTH_REQUIRED asset,
//! authorize + mint to an approved holder, be refused for an unapproved one,
//! let a holder burn, and hand the admin role back?
#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

#[contracttype]
enum DataKey {
    Admin,
}

#[contract]
pub struct ShareAdminSpike;

fn admin(env: &Env) -> Address {
    let a: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    a.require_auth();
    a
}

#[contractimpl]
impl ShareAdminSpike {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn approve(env: Env, token: Address, holder: Address) {
        admin(&env);
        StellarAssetClient::new(&env, &token).set_authorized(&holder, &true);
    }

    pub fn mint(env: Env, token: Address, to: Address, amount: i128) {
        admin(&env);
        StellarAssetClient::new(&env, &token).mint(&to, &amount);
    }

    pub fn burn_from_holder(env: Env, token: Address, holder: Address, amount: i128) {
        holder.require_auth();
        TokenClient::new(&env, &token).burn(&holder, &amount);
    }

    pub fn hand_over(env: Env, token: Address, new_admin: Address) {
        admin(&env);
        StellarAssetClient::new(&env, &token).set_admin(&new_admin);
    }
}

#[cfg(test)]
mod test;
