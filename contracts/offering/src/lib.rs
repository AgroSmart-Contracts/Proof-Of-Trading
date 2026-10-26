//! Per-shipment SPV share offerings. One contract instance manages many offerings.
//! The contract is the SAC admin of each share asset: it mints shares on subscribe
//! and burns them (investor-authorized) on refund/redeem.
#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype,
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, String,
};

const UNIT: i128 = 10_000_000; // 7 decimals
const YEAR_SECS: i128 = 31_536_000;
const BPS: i128 = 10_000;
// ~5s ledgers. New persistent entries already get the network minimum (~7 days on testnet), so
// only top up when under ~1 day left, back to ~7 days. Rent dominates fees on testnet (an extension
// to ~120 days cost ~10k XLM for one offering), so this is sized for the hackathon. Production must
// extend to the deal term (funding to maturity) with keeper top-ups.
const TTL_THRESHOLD: u32 = 17_280;
const TTL_EXTEND: u32 = 120_960;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyExists = 1,
    NotFound = 2,
    BadStatus = 3,
    DeadlinePassed = 4,
    DeadlineNotPassed = 5,
    CapExceeded = 6,
    BadAmount = 7,
    NotSacAdmin = 8,
    AlreadyRedeemed = 9,
    NothingToSweep = 10,
    Overflow = 11,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Status {
    Open,
    Closed,
    Funded,
    Refunding,
    Distributing,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OfferingParams {
    pub shipment_ref: String,
    pub proof_hash: BytesN<32>,
    pub share_token: Address,
    pub usdc_token: Address,
    pub treasury: Address,
    pub unit_price: i128,
    pub cap_shares: i128,
    pub deadline: u64,
    pub term_secs: u64,
    pub apy_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Offering {
    pub p: OfferingParams,
    pub sold_shares: i128,
    pub shares_at_close: i128,
    pub funded_at: u64,
    pub total_collected: i128,
    pub outcome_code: u32,
    pub paid_out: i128,
    pub redeemed_shares: i128,
    pub status: Status,
}

#[contracttype]
enum DataKey {
    Admin,
    Offering(u32),
    Redeemed(u32, Address),
}

#[contractevent]
pub struct Created { #[topic] pub id: u32, pub shipment_ref: String, pub share_token: Address, pub cap_shares: i128 }
#[contractevent]
pub struct Approved { #[topic] pub id: u32, pub investor: Address }
#[contractevent]
pub struct Subscribed { #[topic] pub id: u32, pub investor: Address, pub usdc_amount: i128, pub shares: i128, pub agreement_hash: BytesN<32> }
#[contractevent]
pub struct Closed { #[topic] pub id: u32, pub shares_at_close: i128 }
#[contractevent]
pub struct Funded { #[topic] pub id: u32, pub amount: i128, pub funded_at: u64 }
#[contractevent]
pub struct Refunds { #[topic] pub id: u32, pub sold_shares: i128 }
#[contractevent]
pub struct Refunded { #[topic] pub id: u32, pub investor: Address, pub shares: i128, pub usdc_amount: i128 }
#[contractevent]
pub struct Distribution { #[topic] pub id: u32, pub amount: i128, pub outcome_code: u32 }
#[contractevent]
pub struct Redeemed { #[topic] pub id: u32, pub investor: Address, pub shares: i128, pub payout: i128 }
#[contractevent]
pub struct Swept { #[topic] pub id: u32, pub to: Address, pub amount: i128 }

fn admin(env: &Env) -> Address {
    let a: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    a.require_auth();
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
    a
}

fn load(env: &Env, id: u32) -> Result<Offering, Error> {
    env.storage().persistent().get(&DataKey::Offering(id)).ok_or(Error::NotFound)
}

fn save(env: &Env, id: u32, o: &Offering) {
    let key = DataKey::Offering(id);
    env.storage().persistent().set(&key, o);
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
}

fn mul_div(a: i128, b: i128, c: i128) -> Result<i128, Error> {
    a.checked_mul(b).and_then(|x| x.checked_div(c)).ok_or(Error::Overflow)
}

fn usdc_for(o: &Offering, shares: i128) -> Result<i128, Error> {
    mul_div(shares, o.p.unit_price, UNIT)
}

fn owed(o: &Offering) -> Result<i128, Error> {
    let principal = usdc_for(o, o.shares_at_close)?;
    let interest = principal
        .checked_mul(o.p.apy_bps as i128)
        .and_then(|x| x.checked_mul(o.p.term_secs as i128))
        .and_then(|x| x.checked_div(BPS * YEAR_SECS))
        .ok_or(Error::Overflow)?;
    principal.checked_add(interest).ok_or(Error::Overflow)
}

fn payout_for(o: &Offering, bal: i128) -> Result<i128, Error> {
    if bal == 0 || o.shares_at_close == 0 {
        return Ok(0);
    }
    let total = owed(o)?.min(o.total_collected);
    mul_div(bal, total, o.shares_at_close)
}

#[contract]
pub struct OfferingContract;

#[contractimpl]
impl OfferingContract {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn create_offering(env: Env, id: u32, p: OfferingParams) -> Result<(), Error> {
        admin(&env);
        if env.storage().persistent().has(&DataKey::Offering(id)) {
            return Err(Error::AlreadyExists);
        }
        if p.unit_price <= 0 || p.cap_shares <= 0 || p.term_secs == 0 || p.deadline <= env.ledger().timestamp() {
            return Err(Error::BadAmount);
        }
        if StellarAssetClient::new(&env, &p.share_token).admin() != env.current_contract_address() {
            return Err(Error::NotSacAdmin);
        }
        let o = Offering {
            p: p.clone(),
            sold_shares: 0,
            shares_at_close: 0,
            funded_at: 0,
            total_collected: 0,
            outcome_code: 0,
            paid_out: 0,
            redeemed_shares: 0,
            status: Status::Open,
        };
        save(&env, id, &o);
        Created { id, shipment_ref: p.shipment_ref, share_token: p.share_token, cap_shares: p.cap_shares }.publish(&env);
        Ok(())
    }

    /// Stands in for KYB approval. The investor must already have a trustline to the share asset.
    pub fn approve_investor(env: Env, id: u32, investor: Address) -> Result<(), Error> {
        admin(&env);
        let o = load(&env, id)?;
        if o.status != Status::Open {
            return Err(Error::BadStatus);
        }
        StellarAssetClient::new(&env, &o.p.share_token).set_authorized(&investor, &true);
        Approved { id, investor }.publish(&env);
        Ok(())
    }

    pub fn subscribe(env: Env, id: u32, investor: Address, usdc_amount: i128, agreement_hash: BytesN<32>) -> Result<i128, Error> {
        investor.require_auth();
        let mut o = load(&env, id)?;
        if o.status != Status::Open {
            return Err(Error::BadStatus);
        }
        if env.ledger().timestamp() > o.p.deadline {
            return Err(Error::DeadlinePassed);
        }
        let scaled = usdc_amount.checked_mul(UNIT).ok_or(Error::Overflow)?;
        if usdc_amount <= 0 || scaled % o.p.unit_price != 0 {
            return Err(Error::BadAmount);
        }
        let shares = scaled / o.p.unit_price;
        let sold = o.sold_shares.checked_add(shares).ok_or(Error::Overflow)?;
        if sold > o.p.cap_shares {
            return Err(Error::CapExceeded);
        }
        o.sold_shares = sold;
        let closed = sold == o.p.cap_shares;
        if closed {
            o.status = Status::Closed;
            o.shares_at_close = sold;
        }
        save(&env, id, &o);

        let me = env.current_contract_address();
        TokenClient::new(&env, &o.p.usdc_token).transfer(&investor, &me, &usdc_amount);
        // Traps (and reverts the whole tx, including the transfer) if the investor isn't authorized.
        StellarAssetClient::new(&env, &o.p.share_token).mint(&investor, &shares);

        Subscribed { id, investor, usdc_amount, shares, agreement_hash }.publish(&env);
        if closed {
            Closed { id, shares_at_close: sold }.publish(&env);
        }
        Ok(shares)
    }

    pub fn fund(env: Env, id: u32) -> Result<(), Error> {
        admin(&env);
        let mut o = load(&env, id)?;
        if o.status != Status::Closed {
            return Err(Error::BadStatus);
        }
        // This offering's escrow only: the contract holds escrow for several offerings.
        let amount = usdc_for(&o, o.shares_at_close)?;
        o.status = Status::Funded;
        o.funded_at = env.ledger().timestamp();
        save(&env, id, &o);
        TokenClient::new(&env, &o.p.usdc_token).transfer(&env.current_contract_address(), &o.p.treasury, &amount);
        Funded { id, amount, funded_at: o.funded_at }.publish(&env);
        Ok(())
    }

    pub fn start_refunds(env: Env, id: u32) -> Result<(), Error> {
        admin(&env);
        let mut o = load(&env, id)?;
        if o.status != Status::Open {
            return Err(Error::BadStatus);
        }
        if env.ledger().timestamp() <= o.p.deadline {
            return Err(Error::DeadlineNotPassed);
        }
        o.status = Status::Refunding;
        save(&env, id, &o);
        Refunds { id, sold_shares: o.sold_shares }.publish(&env);
        Ok(())
    }

    pub fn refund(env: Env, id: u32, investor: Address) -> Result<i128, Error> {
        investor.require_auth();
        let o = load(&env, id)?;
        if o.status != Status::Refunding {
            return Err(Error::BadStatus);
        }
        let bal = TokenClient::new(&env, &o.p.share_token).balance(&investor);
        if bal == 0 {
            return Ok(0);
        }
        let usdc_amount = usdc_for(&o, bal)?;
        TokenClient::new(&env, &o.p.share_token).burn(&investor, &bal);
        TokenClient::new(&env, &o.p.usdc_token).transfer(&env.current_contract_address(), &investor, &usdc_amount);
        Refunded { id, investor, shares: bal, usdc_amount }.publish(&env);
        Ok(usdc_amount)
    }

    /// Called by the SPV treasury with what it collected (buyer payment or insurance payout).
    pub fn deposit_distribution(env: Env, id: u32, amount: i128, outcome_code: u32) -> Result<(), Error> {
        let mut o = load(&env, id)?;
        o.p.treasury.require_auth();
        if o.status != Status::Funded {
            return Err(Error::BadStatus);
        }
        if amount <= 0 || !(1..=5).contains(&outcome_code) {
            return Err(Error::BadAmount);
        }
        o.total_collected = amount;
        o.outcome_code = outcome_code;
        o.status = Status::Distributing;
        save(&env, id, &o);
        TokenClient::new(&env, &o.p.usdc_token).transfer(&o.p.treasury, &env.current_contract_address(), &amount);
        Distribution { id, amount, outcome_code }.publish(&env);
        Ok(())
    }

    /// Pays min(owed at APY, collected) pro rata and burns the investor's shares. Returns (shares, payout).
    pub fn redeem(env: Env, id: u32, investor: Address) -> Result<(i128, i128), Error> {
        investor.require_auth();
        let mut o = load(&env, id)?;
        if o.status != Status::Distributing {
            return Err(Error::BadStatus);
        }
        let flag = DataKey::Redeemed(id, investor.clone());
        if env.storage().persistent().has(&flag) {
            return Err(Error::AlreadyRedeemed);
        }
        let share = TokenClient::new(&env, &o.p.share_token);
        let bal = share.balance(&investor);
        if bal == 0 {
            return Ok((0, 0));
        }
        let payout = payout_for(&o, bal)?;
        o.paid_out = o.paid_out.checked_add(payout).ok_or(Error::Overflow)?;
        o.redeemed_shares = o.redeemed_shares.checked_add(bal).ok_or(Error::Overflow)?;
        save(&env, id, &o);
        env.storage().persistent().set(&flag, &true);
        env.storage().persistent().extend_ttl(&flag, TTL_THRESHOLD, TTL_EXTEND);

        share.burn(&investor, &bal);
        TokenClient::new(&env, &o.p.usdc_token).transfer(&env.current_contract_address(), &investor, &payout);
        Redeemed { id, investor, shares: bal, payout }.publish(&env);
        Ok((bal, payout))
    }

    /// After every share is redeemed, returns what's left (surplus above owed + rounding dust) to `to`.
    pub fn sweep_surplus(env: Env, id: u32, to: Address) -> Result<i128, Error> {
        admin(&env);
        let mut o = load(&env, id)?;
        if o.status != Status::Distributing || o.redeemed_shares != o.shares_at_close {
            return Err(Error::BadStatus);
        }
        let rest = o.total_collected.checked_sub(o.paid_out).ok_or(Error::Overflow)?;
        if rest == 0 {
            return Err(Error::NothingToSweep);
        }
        o.paid_out = o.total_collected;
        save(&env, id, &o);
        TokenClient::new(&env, &o.p.usdc_token).transfer(&env.current_contract_address(), &to, &rest);
        Swept { id, to, amount: rest }.publish(&env);
        Ok(rest)
    }

    /// Hands a share asset's SAC admin role to `new_admin` (e.g. back to the issuer, or to a
    /// successor contract). Without this the asset would be stuck with this contract forever.
    pub fn transfer_share_admin(env: Env, share_token: Address, new_admin: Address) {
        admin(&env);
        StellarAssetClient::new(&env, &share_token).set_admin(&new_admin);
    }

    pub fn get_offering(env: Env, id: u32) -> Result<Offering, Error> {
        load(&env, id)
    }

    pub fn owed_total(env: Env, id: u32) -> Result<i128, Error> {
        owed(&load(&env, id)?)
    }

    pub fn preview_redeem(env: Env, id: u32, investor: Address) -> Result<(i128, i128), Error> {
        let o = load(&env, id)?;
        if env.storage().persistent().has(&DataKey::Redeemed(id, investor.clone())) {
            return Ok((0, 0));
        }
        let bal = TokenClient::new(&env, &o.p.share_token).balance(&investor);
        if o.status != Status::Distributing {
            return Ok((bal, 0));
        }
        Ok((bal, payout_for(&o, bal)?))
    }
}

#[cfg(test)]
mod test;
