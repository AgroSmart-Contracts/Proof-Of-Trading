# ADR 0001: Share asset structure

- **Status:** Accepted (v0.1 assets, v0.2 contract). **Revised 2026-11-05:** the pilot uses one pool share, TRU3, with per-receivable attestations (decision 3). Decisions 1 and 2 stand.
- **Date:** 2026-10-24, revised 2026-11-05
- **Evidence:** [spike report](../spike-report.md), [DEPLOYMENTS.md](../DEPLOYMENTS.md), [pool contract v1](../pool-contract-v1.md)

## Context

In the v0.2 prototype, each financed shipment is held by an SPV, and investors buy ordinary shares in that SPV. For the pilot, one vehicle holds a pool of export receivables, and investors buy shares in the pool. Either way, investors are paid from what is collected: the buyer's payment, or the credit insurer's payout if the buyer defaults, up to the investor amount fixed in the subscription agreement. These are trade receivables, with no lending involved.

The share token has to:

1. reach only investors TruMarket has approved (KYB), and keep everyone else out;
2. let the SPV act on a court order or an error (freeze, recover);
3. mint exactly when an investor pays and burn exactly when they are paid out, without a person in the loop;
4. stay tied to the receivables behind it, their proof hashes and the insurance;
5. be readable by standard Stellar tooling (wallets, explorers, SEP-1).

## Decision

### 1. A classic Stellar asset with AUTH_REQUIRED, AUTH_REVOCABLE and AUTH_CLAWBACK_ENABLED

- **AUTH_REQUIRED.** A trustline holds nothing until the issuer authorizes it. Authorization is the KYB gate: an unapproved wallet's subscription is rejected by the asset itself (`BalanceDeauthorizedError`, SAC error 11). This is shown on testnet in the spike (step 5b) and in every offering run.
- **AUTH_REVOCABLE.** The SPV can freeze a holder, for example on a sanctions hit or a lost key, without needing the holder's signature.
- **AUTH_CLAWBACK_ENABLED.** The SPV can recover shares when a court order or a provable error requires it. When it may be used, and who signs, is set out in [governance.md](../governance.md).
- The flags are set on the issuer **before** any trustline exists, as clawback only applies to trustlines opened after it is enabled (spike step 0a).

The controls are native to the protocol, so wallets, explorers and Horizon show and enforce them without custom code.

### 2. The SAC admin is handed to the offering contract

Each share asset has a Stellar Asset Contract (SAC). The issuer calls `set_admin` to make the contract (the v0.2 offering contract; the pool contract in the pilot) the SAC admin. The contract then:

- authorizes approved investors (`set_authorized`);
- mints shares inside the same transaction that takes the investor's USDC (`subscribe`), so payment and issuance cannot drift apart;
- burns shares inside the same transaction that pays the investor out (`redeem`, `refund`).

No operator can mint without payment, and the share supply always equals what was paid in, less what was redeemed. The spike confirmed a contract can hold this role: approve, mint, be refused for an unapproved wallet, burn, and hand the role back.

The handover is reversible. `transfer_share_admin` hands the role back to the issuer (or a successor contract) at offering close; see [governance.md](../governance.md).

### 3. One pool share, with an attestation per receivable (revised 2026-11-05)

The pilot has **one share asset, TRU3**, issued by the receivables-portfolio SPV (1 TRU3 = USD 1), with the pool contract as SAC admin. Each receivable the pool funds is **attested** in the pool contract under a key built from the export declaration number, the invoice number and the buyer's tax ID, and its status (paid, overdue, claim, loss, revoked) is appended over time. Design: [pool-contract-v1.md](../pool-contract-v1.md).

- **One trustline, one asset.** Investors open one trustline and hold one asset, however many receivables the pool funds. `stellar.toml` lists one currency.
- **Diversification by rule.** Concentration limits (20% per receivable, 25% per buyer, 30% per exporter, 50% per product) and a fixed loss waterfall replace per-shipment isolation.
- **Audit per receivable.** Each receivable still has its own on-chain record (key, document hash, status history), and no receivable is financed twice within the pool; the same invoice can't be attested twice.

This answers the review point that per-shipment assets fragment liquidity and reporting: an investor would have held dozens of small assets, each with its own trustline, `stellar.toml` entry and redemption.

#### v0.2 history: one asset per shipment

In the v0.2 prototype (deployed on testnet, see [DEPLOYMENTS.md](../DEPLOYMENTS.md)), each financed shipment got its own asset (`TM` + 4 digits, for example `TM0247`), linked to that shipment's proof hash.

- **Isolation.** A holder's exposure is exactly one shipment's receivable and insurance. Losses on one shipment cannot reach another.
- **Clear redemption.** Payout is pro rata on that asset's supply at close, against that shipment's collections.
- **Audit.** The asset code, its SAC, the offering and the proof hash map one to one, which is what [DEPLOYMENTS.md](../DEPLOYMENTS.md) lists.

The cost was one trustline per shipment for each investor, and one asset to publish in `stellar.toml` per shipment. That cost is why decision 3 was revised for the pilot.

## Alternatives considered

### A pure Soroban token (custom contract token)

A token written entirely as a contract, for example an OpenZeppelin `stellar-tokens` token, a vault (ERC-4626 style) or the RWA (T-REX / ERC-3643 style) token.

- **For:** any transfer rule can be coded; identity claims and compliance modules exist in the RWA variant.
- **Against:** authorization, freezing and clawback become custom code to audit, instead of protocol features. Wallets, explorers and Horizon don't show them natively. The vault's floating share price does not fit a fixed amount per share, and neither variant has offering, deadline, refund or distribution logic, so a custom contract is needed anyway.
- **Decision:** not now. The RWA token stays an option if counsel requires ERC-3643-style identity claims.

### SEP-57 and SEP-8, later

- **SEP-8 (regulated assets):** every transfer is approved by the issuer's approval server. It would enforce transfer rules between investors (today, two approved investors can transfer shares to each other).
- **SEP-57 (tokenized securities):** a standard interface for security tokens on Soroban.
- **Decision:** out of scope for tranche 1. The current structure (AUTH_REQUIRED, SAC admin in a contract) does not block either. The design note is [spikes/sep57-sep8.md](../spikes/sep57-sep8.md).

## Consequences

- KYB, freezing and recovery use protocol features that existing tooling enforces and displays.
- The offering contract is a critical component: it is the only minter. It needs an audit before mainnet, and its admin should be a multisig ([governance.md](../governance.md)).
- With one pool share, an investor needs one trustline. The v0.2 per-shipment assets stay on testnet as the prototype record.
- Losses are shared across the pool by the waterfall and NAV write-down, so the limits and the attestation records carry the per-receivable transparency.
- Transfers between approved investors are allowed at the protocol level. If counsel requires transfer restrictions, SEP-8 is the path.
