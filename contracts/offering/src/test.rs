extern crate std;
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _, IssuerFlags, Ledger as _, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Env, Event as _, IntoVal,
};

const NOW: u64 = 1_000;
const DEADLINE: u64 = NOW + 7_200;

fn usd(n: i128) -> i128 {
    n * UNIT
}

struct T<'a> {
    env: Env,
    admin: Address,
    treasury: Address,
    a: Address,
    b: Address,
    stranger: Address,
    usdc: TokenClient<'a>,
    share: TokenClient<'a>,
    share_sac: StellarAssetClient<'a>,
    c: OfferingContractClient<'a>,
}

impl<'a> T<'a> {
    fn params(&self, cap_usd: i128, apy_bps: u32, term_days: u64) -> OfferingParams {
        OfferingParams {
            shipment_ref: String::from_str(&self.env, "SHP-0247"),
            proof_hash: BytesN::from_array(&self.env, &[7; 32]),
            share_token: self.share.address.clone(),
            usdc_token: self.usdc.address.clone(),
            treasury: self.treasury.clone(),
            unit_price: UNIT,
            cap_shares: usd(cap_usd),
            deadline: DEADLINE,
            term_secs: term_days * 86_400,
            apy_bps,
        }
    }
    fn hash(&self) -> BytesN<32> {
        BytesN::from_array(&self.env, &[9; 32])
    }
    /// Offering 1 created and investors A and B approved.
    fn open(&self, cap_usd: i128, apy_bps: u32, term_days: u64) {
        self.c.create_offering(&1, &self.params(cap_usd, apy_bps, term_days));
        self.c.approve_investor(&1, &self.a);
        self.c.approve_investor(&1, &self.b);
    }
    /// Open, subscribe a/b, fund, deposit `collected`.
    fn distributing(&self, cap_usd: i128, apy_bps: u32, term_days: u64, a_usd: i128, b_usd: i128, collected: i128, outcome: u32) {
        self.open(cap_usd, apy_bps, term_days);
        self.c.subscribe(&1, &self.a, &usd(a_usd), &self.hash());
        self.c.subscribe(&1, &self.b, &usd(b_usd), &self.hash());
        self.c.fund(&1);
        self.c.deposit_distribution(&1, &collected, &outcome);
    }
}

fn setup<'a>() -> T<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(NOW);
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let stranger = Address::generate(&env);

    let usdc = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let usdc_sac = StellarAssetClient::new(&env, &usdc.address());
    for (who, amt) in [(&a, 100_000), (&b, 100_000), (&stranger, 100_000), (&treasury, 200_000)] {
        usdc_sac.mint(who, &usd(amt));
    }

    let share = env.register_stellar_asset_contract_v2(Address::generate(&env));
    share.issuer().set_flag(IssuerFlags::RequiredFlag);
    share.issuer().set_flag(IssuerFlags::RevocableFlag);
    share.issuer().set_flag(IssuerFlags::ClawbackEnabledFlag);
    let share_sac = StellarAssetClient::new(&env, &share.address());

    let id = env.register(OfferingContract, (admin.clone(),));
    share_sac.set_admin(&id);
    T {
        usdc: TokenClient::new(&env, &usdc.address()),
        share: TokenClient::new(&env, &share.address()),
        share_sac,
        c: OfferingContractClient::new(&env, &id),
        env,
        admin,
        treasury,
        a,
        b,
        stranger,
    }
}

// 1
#[test]
fn create_requires_sac_admin() {
    let t = setup();
    let other = t.env.register_stellar_asset_contract_v2(Address::generate(&t.env));
    let mut p = t.params(100_000, 1200, 120);
    p.share_token = other.address();
    assert_eq!(t.c.try_create_offering(&1, &p), Err(Ok(Error::NotSacAdmin)));
    t.c.create_offering(&1, &t.params(100_000, 1200, 120));
    assert_eq!(t.c.get_offering(&1).status, Status::Open);
    assert_eq!(t.c.try_create_offering(&1, &t.params(100_000, 1200, 120)), Err(Ok(Error::AlreadyExists)));
}

// 2
#[test]
fn approved_investor_subscribes() {
    let t = setup();
    t.open(100_000, 1200, 120);
    let shares = t.c.subscribe(&1, &t.a, &usd(25_000), &t.hash());
    let ev = Subscribed { id: 1, investor: t.a.clone(), usdc_amount: usd(25_000), shares: usd(25_000), agreement_hash: t.hash() };
    assert!(t.env.events().all().filter_by_contract(&t.c.address).events().contains(&ev.to_xdr(&t.env, &t.c.address)));
    assert_eq!(shares, usd(25_000));
    assert_eq!(t.usdc.balance(&t.a), usd(75_000));
    assert_eq!(t.usdc.balance(&t.c.address), usd(25_000));
    assert_eq!(t.share.balance(&t.a), usd(25_000));
    assert_eq!(t.c.get_offering(&1).sold_shares, usd(25_000));
}

// 3
#[test]
fn unapproved_cannot_subscribe() {
    let t = setup();
    t.open(100_000, 1200, 120);
    t.share_sac.set_authorized(&t.stranger, &false);
    assert!(t.c.try_subscribe(&1, &t.stranger, &usd(1_000), &t.hash()).is_err());
    assert_eq!(t.usdc.balance(&t.stranger), usd(100_000));
    assert_eq!(t.usdc.balance(&t.c.address), 0);
    assert_eq!(t.share.balance(&t.stranger), 0);
    assert_eq!(t.c.get_offering(&1).sold_shares, 0);
}

// 4
#[test]
fn cap_enforced_and_exact_cap_closes() {
    let t = setup();
    t.open(100_000, 1200, 120);
    t.c.subscribe(&1, &t.a, &usd(60_000), &t.hash());
    assert_eq!(t.c.try_subscribe(&1, &t.b, &usd(40_001), &t.hash()), Err(Ok(Error::CapExceeded)));
    t.c.subscribe(&1, &t.b, &usd(40_000), &t.hash());
    let o = t.c.get_offering(&1);
    assert_eq!(o.status, Status::Closed);
    assert_eq!(o.shares_at_close, usd(100_000));
    assert_eq!(t.c.try_subscribe(&1, &t.a, &usd(1), &t.hash()), Err(Ok(Error::BadStatus)));
}

// 5
#[test]
fn subscribe_after_deadline_fails() {
    let t = setup();
    t.open(100_000, 1200, 120);
    t.env.ledger().set_timestamp(DEADLINE);
    t.c.subscribe(&1, &t.a, &usd(1_000), &t.hash()); // boundary is inclusive
    t.env.ledger().set_timestamp(DEADLINE + 1);
    assert_eq!(t.c.try_subscribe(&1, &t.a, &usd(1_000), &t.hash()), Err(Ok(Error::DeadlinePassed)));
}

// 6
#[test]
fn fund_moves_escrow() {
    let t = setup();
    t.open(100_000, 1200, 120);
    t.c.subscribe(&1, &t.a, &usd(60_000), &t.hash());
    assert_eq!(t.c.try_fund(&1), Err(Ok(Error::BadStatus)));
    t.c.subscribe(&1, &t.b, &usd(40_000), &t.hash());
    t.env.ledger().set_timestamp(5_000);
    t.c.fund(&1);
    let o = t.c.get_offering(&1);
    assert_eq!(o.status, Status::Funded);
    assert_eq!(o.funded_at, 5_000);
    assert_eq!(t.usdc.balance(&t.treasury), usd(300_000));
    assert_eq!(t.usdc.balance(&t.c.address), 0);
}

#[test]
fn fund_only_moves_its_own_escrow() {
    let t = setup();
    t.open(100_000, 1200, 120);
    t.c.subscribe(&1, &t.a, &usd(60_000), &t.hash());
    t.c.subscribe(&1, &t.b, &usd(40_000), &t.hash());
    // A second, still-open offering's escrow sits in the same contract.
    let share2 = t.env.register_stellar_asset_contract_v2(Address::generate(&t.env));
    StellarAssetClient::new(&t.env, &share2.address()).set_admin(&t.c.address);
    let mut p2 = t.params(50_000, 1200, 120);
    p2.share_token = share2.address();
    t.c.create_offering(&2, &p2);
    t.c.subscribe(&2, &t.stranger, &usd(10_000), &t.hash());
    t.c.fund(&1);
    assert_eq!(t.usdc.balance(&t.c.address), usd(10_000));
}

// 7
#[test]
fn undersubscribed_refunds_exactly() {
    let t = setup();
    t.open(100_000, 1200, 120);
    t.c.subscribe(&1, &t.a, &usd(30_000), &t.hash());
    assert_eq!(t.c.try_start_refunds(&1), Err(Ok(Error::DeadlineNotPassed)));
    t.env.ledger().set_timestamp(DEADLINE + 1);
    t.c.start_refunds(&1);
    assert_eq!(t.c.get_offering(&1).status, Status::Refunding);
    assert_eq!(t.c.refund(&1, &t.a), usd(30_000));
    assert_eq!(t.usdc.balance(&t.a), usd(100_000));
    assert_eq!(t.share.balance(&t.a), 0);
    assert_eq!(t.c.refund(&1, &t.a), 0);
}

// 8
#[test]
fn full_repayment_pays_apy_and_sweeps() {
    let t = setup();
    t.distributing(100_000, 1200, 120, 60_000, 40_000, usd(105_000), 1);
    assert_eq!(t.c.preview_redeem(&1, &t.a), (usd(60_000), 623_671_232_876));
    assert_eq!(t.c.redeem(&1, &t.a), (usd(60_000), 623_671_232_876));
    assert_eq!(t.c.try_sweep_surplus(&1, &t.treasury), Err(Ok(Error::BadStatus)));
    assert_eq!(t.c.redeem(&1, &t.b), (usd(40_000), 415_780_821_917));
    assert_eq!(t.usdc.balance(&t.a), usd(40_000) + 623_671_232_876);
    assert_eq!(t.usdc.balance(&t.b), usd(60_000) + 415_780_821_917);
    assert_eq!(t.share.balance(&t.a), 0);
    assert_eq!(t.share.balance(&t.b), 0);
    let before = t.usdc.balance(&t.treasury);
    assert_eq!(t.c.sweep_surplus(&1, &t.treasury), 10_547_945_207);
    assert_eq!(t.usdc.balance(&t.treasury), before + 10_547_945_207);
    assert_eq!(t.usdc.balance(&t.c.address), 0);
}

// 9
#[test]
fn insured_failure_pro_rata() {
    let t = setup();
    t.distributing(60_000, 1100, 90, 36_000, 24_000, usd(54_000), 4);
    assert_eq!(t.c.owed_total(&1), 616_273_972_602);
    assert_eq!(t.c.redeem(&1, &t.a).1, 324_000_000_000);
    assert_eq!(t.c.redeem(&1, &t.b).1, 216_000_000_000);
    assert_eq!(t.c.try_sweep_surplus(&1, &t.treasury), Err(Ok(Error::NothingToSweep)));
    assert_eq!(t.usdc.balance(&t.c.address), 0);
}

// 10
#[test]
fn double_redeem_and_zero_balance() {
    let t = setup();
    t.distributing(100_000, 1200, 120, 60_000, 40_000, usd(105_000), 1);
    t.c.redeem(&1, &t.a);
    assert_eq!(t.c.try_redeem(&1, &t.a), Err(Ok(Error::AlreadyRedeemed)));
    assert_eq!(t.c.redeem(&1, &t.stranger), (0, 0));
    assert_eq!(t.c.redeem(&1, &t.stranger), (0, 0)); // not marked
}

// 11
#[test]
fn auth_matrix_positive() {
    let t = setup();
    let signer = |t: &T| t.env.auths()[0].0.clone();
    t.c.create_offering(&1, &t.params(100_000, 1200, 120));
    assert_eq!(signer(&t), t.admin);
    t.c.approve_investor(&1, &t.a);
    assert_eq!(signer(&t), t.admin);
    t.c.approve_investor(&1, &t.b);
    t.c.subscribe(&1, &t.a, &usd(60_000), &t.hash());
    assert_eq!(signer(&t), t.a);
    t.c.subscribe(&1, &t.b, &usd(40_000), &t.hash());
    t.c.fund(&1);
    assert_eq!(signer(&t), t.admin);
    t.c.deposit_distribution(&1, &usd(105_000), &1);
    assert_eq!(signer(&t), t.treasury);
    t.c.redeem(&1, &t.a);
    assert_eq!(signer(&t), t.a);
    t.c.redeem(&1, &t.b);
    t.c.sweep_surplus(&1, &t.treasury);
    assert_eq!(signer(&t), t.admin);
}

#[test]
fn auth_matrix_start_refunds_and_refund() {
    let t = setup();
    t.open(100_000, 1200, 120);
    t.c.subscribe(&1, &t.a, &usd(10_000), &t.hash());
    t.env.ledger().set_timestamp(DEADLINE + 1);
    t.c.start_refunds(&1);
    assert_eq!(t.env.auths()[0].0, t.admin);
    t.c.refund(&1, &t.a);
    assert_eq!(t.env.auths()[0].0, t.a);
}

#[test]
fn auth_matrix_negative() {
    let t = setup();
    t.open(100_000, 1200, 120);
    t.c.subscribe(&1, &t.a, &usd(60_000), &t.hash());
    t.c.subscribe(&1, &t.b, &usd(40_000), &t.hash());
    // A stranger cannot fund (admin-only).
    t.env.mock_auths(&[MockAuth {
        address: &t.stranger,
        invoke: &MockAuthInvoke { contract: &t.c.address, fn_name: "fund", args: (1u32,).into_val(&t.env), sub_invokes: &[] },
    }]);
    assert!(t.c.try_fund(&1).is_err());
    t.env.mock_all_auths();
    t.c.fund(&1);
    // A stranger cannot deposit a distribution (treasury-only).
    t.env.mock_auths(&[MockAuth {
        address: &t.stranger,
        invoke: &MockAuthInvoke {
            contract: &t.c.address,
            fn_name: "deposit_distribution",
            args: (1u32, usd(105_000), 1u32).into_val(&t.env),
            sub_invokes: &[],
        },
    }]);
    assert!(t.c.try_deposit_distribution(&1, &usd(105_000), &1).is_err());
}

// 12
#[test]
fn apy_math_reference() {
    let t = setup();
    t.open(100_000, 1200, 120);
    t.c.subscribe(&1, &t.a, &usd(60_000), &t.hash());
    t.c.subscribe(&1, &t.b, &usd(40_000), &t.hash());
    assert_eq!(t.c.owed_total(&1), 1_039_452_054_794);
}

#[test]
fn bad_inputs() {
    let t = setup();
    t.open(100_000, 1200, 120);
    assert_eq!(t.c.try_subscribe(&1, &t.a, &0, &t.hash()), Err(Ok(Error::BadAmount)));
    let mut p = t.params(100, 1200, 120);
    p.unit_price = 3 * UNIT; // $3/share: 1 TUSDC isn't a whole number of shares
    let share2 = t.env.register_stellar_asset_contract_v2(Address::generate(&t.env));
    StellarAssetClient::new(&t.env, &share2.address()).set_admin(&t.c.address);
    p.share_token = share2.address();
    t.c.create_offering(&2, &p);
    assert_eq!(t.c.try_subscribe(&2, &t.a, &usd(1), &t.hash()), Err(Ok(Error::BadAmount)));
    t.c.subscribe(&1, &t.a, &usd(60_000), &t.hash());
    t.c.subscribe(&1, &t.b, &usd(40_000), &t.hash());
    t.c.fund(&1);
    assert_eq!(t.c.try_deposit_distribution(&1, &usd(1), &9), Err(Ok(Error::BadAmount)));
    assert_eq!(t.c.try_get_offering(&99), Err(Ok(Error::NotFound)));
}

#[test]
fn share_admin_can_be_handed_back() {
    let t = setup();
    let issuer = Address::generate(&t.env);
    t.c.transfer_share_admin(&t.share.address, &issuer);
    assert_eq!(t.env.auths()[0].0, t.admin);
    assert_eq!(t.share_sac.admin(), issuer);
    // The contract is no longer SAC admin, so it can't open offerings on this asset.
    assert_eq!(t.c.try_create_offering(&1, &t.params(100_000, 1200, 120)), Err(Ok(Error::NotSacAdmin)));
}
