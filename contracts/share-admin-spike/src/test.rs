extern crate std;
use super::*;
use soroban_sdk::{
    testutils::{Address as _, IssuerFlags},
    token::{StellarAssetClient, TokenClient},
    Env,
};

struct Setup<'a> {
    env: Env,
    issuer: Address,
    token: Address,
    sac: StellarAssetClient<'a>,
    spike: ShareAdminSpikeClient<'a>,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    let issuer = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(issuer.clone());
    asset.issuer().set_flag(IssuerFlags::RequiredFlag);
    asset.issuer().set_flag(IssuerFlags::RevocableFlag);
    asset.issuer().set_flag(IssuerFlags::ClawbackEnabledFlag);
    let token = asset.address();
    let ops = Address::generate(&env);
    let spike_id = env.register(ShareAdminSpike, (ops.clone(),));
    let sac = StellarAssetClient::new(&env, &token);
    sac.set_admin(&spike_id);
    let spike = ShareAdminSpikeClient::new(&env, &spike_id);
    Setup { env, issuer, token, sac, spike }
}

#[test]
fn full_spike_chain() {
    let s = setup();
    assert_eq!(s.sac.admin(), s.spike.address);
    let investor = Address::generate(&s.env);
    s.spike.approve(&s.token, &investor);
    s.spike.mint(&s.token, &investor, &1_000_000_000);
    let tc = TokenClient::new(&s.env, &s.token);
    assert_eq!(tc.balance(&investor), 1_000_000_000);
    s.spike.burn_from_holder(&s.token, &investor, &100_000_000);
    assert_eq!(tc.balance(&investor), 900_000_000);
    s.spike.hand_over(&s.token, &s.issuer);
    assert_eq!(s.sac.admin(), s.issuer);
}

#[test]
fn mint_to_unapproved_fails() {
    let s = setup();
    let unapproved = Address::generate(&s.env);
    s.sac.set_authorized(&unapproved, &false); // admin is the spike; mock_all_auths covers its auth
    assert!(s.spike.try_mint(&s.token, &unapproved, &1_000_000_000).is_err());
    assert_eq!(TokenClient::new(&s.env, &s.token).balance(&unapproved), 0);
}
