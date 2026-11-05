# Spike note: SEP-57 (T-REX) and SEP-8 (regulated assets)

**Status:** design note only. No production code; not part of tranche 1.
**Question:** if counsel requires restrictions on transfers between approved investors, or ERC-3643-style identity claims, which standard should the share asset move to, and what would change?

Context: [ADR 0001](../adr/0001-share-asset-structure.md). Today each share is a classic asset with AUTH_REQUIRED, AUTH_REVOCABLE and AUTH_CLAWBACK_ENABLED, and its SAC admin is the offering contract. Holding requires approval, but **two approved investors can transfer shares to each other** (and trade them on the Stellar DEX) without TruMarket's involvement.

## The two standards

### SEP-8: Regulated Assets
A classic asset whose issuer must approve **every transaction** that moves it. Wallets send the transaction to the issuer's approval server (advertised in `stellar.toml` with `regulated = true` and `approval_server`). The server checks it against its rules and, if it passes, returns it with the issuer's signature and authorization operations around the payment (authorize, pay, deauthorize). Trustlines otherwise stay unauthorized, so nothing moves without approval.

- **Fits:** keeps the classic asset, its flags and its SAC; the rules (for example "recipient must be KYB-approved and within the investor cap", "no transfers before maturity") live in TruMarket's server and can change without a contract upgrade.
- **Doesn't fit as-is:** the offering contract authorizes each investor's trustline once (`approve_investor`) and mints into it. Under SEP-8 trustlines are unauthorized at rest, so `subscribe` and `redeem` would have to authorize, act and deauthorize inside the contract call (the contract is SAC admin, so it can call `set_authorized` on both sides). That changes the contract.
- **Cost:** an approval server to run and secure (it signs as the issuer); every investor wallet must support SEP-8; DEX trading effectively stops, which may be the point.

### SEP-57: T-REX (Token for Regulated EXchanges)
Draft, v0.4.0, authored by OpenZeppelin ([SEP-0057](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0057.md)). A Soroban token suite adapted from ERC-3643: the token extends SEP-41 and adds `forced_transfer`, `mint`, `burn`, `recover_balance`, address and partial freezing, and pause. Compliance and identity are separate contracts: a Compliance contract with modules on `transferred`, `created` and `destroyed` hooks (a module blocks an operation by panicking, reverting the transaction), and an Identity Verifier (`verify_identity`, `recovery_target`). Every sender and receiver must pass identity verification.

- **Fits:** transfer rules and identity claims are enforced on-chain on every operation, including transfers between investors; recovery to a registered wallet is built in.
- **Doesn't fit as-is:** the share becomes a contract token instead of a classic asset with a SAC. The SEP does not mention the Stellar Asset Contract, so the protocol's native authorization flags, clawback and Horizon/wallet display are replaced by contract logic to audit. Our offering contract would call the token's `mint`/`burn` as an authorized operator instead of acting as SAC admin.
- **Cost:** three or more contracts to deploy, audit and keep alive (rent), and an identity-claims setup to operate.

## Comparison

| | Today (classic + SAC admin) | SEP-8 | SEP-57 (T-REX) |
|---|---|---|---|
| Who may hold | Approved trustlines (AUTH_REQUIRED) | Approved per transaction | Verified identities |
| Transfers between approved investors | Allowed | Each one approved by the issuer's server | Checked by compliance modules on-chain |
| Freeze / recover | Protocol flags (revoke, clawback) | Same, plus approval refusal | Contract functions (`set_address_frozen`, `forced_transfer`, `recover_balance`) |
| Asset type | Classic asset + SAC | Classic asset + SAC | Soroban token (SEP-41) |
| Where rules live | Contract + issuer | Off-chain approval server | On-chain modules |
| Contract change for us | None | `subscribe`/`redeem`/`refund` authorize and deauthorize around each move | Token address and mint/burn calls; issuance flow rewritten |
| New infrastructure | None | Approval server (signs as issuer) | Compliance and identity contracts, claim issuers |
| Maturity | In use | Final SEP, few wallets support it | Draft |

## Recommendation

1. **Stay on the current structure for tranche 1.** It already restricts holding to approved investors, and freeze and clawback are protocol-level.
2. **Ask counsel the deciding question:** must transfers between approved investors be blocked or approved one by one, or is approval to hold enough?
3. **If transfers must be controlled, prefer SEP-8 first.** It keeps the classic asset and SAC, needs the smallest contract change (authorize and deauthorize around each move) and keeps the rules in TruMarket's systems, where KYB already lives.
4. **Revisit SEP-57 when it is final** and if counsel requires on-chain identity claims (ERC-3643 parity), for example for distribution to institutional investors that already use T-REX elsewhere.

## If the spike is approved later

A time-boxed prototype on testnet, without touching the deployed contract:

- SEP-8: a minimal approval server (one rule: recipient is approved), a test share asset, and a branch of the offering contract that authorizes and deauthorizes around `subscribe` and `redeem`; measure the extra fees.
- SEP-57: deploy the OpenZeppelin reference token with one compliance module (recipient allow-list) and run one subscribe → redeem cycle through it.
