# Compliance actions

How TruMarket freezes, unfreezes, revokes and claws back pool shares: when each may be used, who signs, and what goes on the record. The structure follows the [authline MiCA authorization model](https://github.com/theahaco/authline/blob/main/docs/mica-authorization-model.md).

- **Status:** in the v0.3 offering contract (`contracts/offering`, 3 tests); the pool contract v1 uses the same functions ([pool-contract-v1.md](pool-contract-v1.md)).
- **Related:** [governance.md](governance.md) (signers, multisig, freeze and clawback policy)

## Context

Pool shares are a regulated instrument held only by approved legal entities. The issuer must be able to act on sanctions, lapsed KYB, court orders and transfers to wallets that aren't approved, and every such action must be visible afterwards. The share asset has AUTH_REQUIRED, AUTH_REVOCABLE and AUTH_CLAWBACK_ENABLED; the contract is its SAC admin, so these powers run through the contract, where they can be limited and logged.

## The model in one page

| Role | Can do |
|---|---|
| Admin (2-of-3 multisig) | Set the compliance signers and their threshold (`set_compliance_signers`) |
| Compliance signers (3 keys: CTO, COO, security lead) | Approve `freeze`, `unfreeze`, `revoke` and `clawback`; at least 2 must sign each one |
| Holder | Nothing here; a frozen or revoked holder can't receive or send shares |

| Action | Effect | Triggers |
|---|---|---|
| `freeze(id, holder, reason, approvers)` | Deauthorizes the holder's trustline | SANCTIONS, COURT_ORDER, UNAPPROVED_TRANSFER |
| `unfreeze(id, holder, reason, approvers)` | Authorizes it again | The reason the freeze was taken for, once resolved |
| `revoke(id, holder, reason, approvers)` | Deauthorizes the holder after their approval ends | KYB_LAPSE |
| `clawback(id, holder, amount, reason, approvers)` | Recovers shares from the holder (SAC clawback) | COURT_ORDER, UNAPPROVED_TRANSFER, or a lost key reissued at the holder's request |

The contract refuses an action unless compliance signers are configured, and unless at least `threshold` distinct configured signers approve and sign it. A threshold below 2, above the number of signers, or a duplicate signer is rejected.

## What is recorded on-chain

Each action emits one `ComplianceAction` event:

| Field | Content |
|---|---|
| `id` (topic) | The offering (the pool, in v1) |
| `action` (topic) | `frozen`, `unfrozen`, `revoked` or `clawback` |
| `holder` | The wallet address |
| `amount` | Shares clawed back (0 for the other actions) |
| `reason` | One code: `Sanctions`, `KybLapse`, `CourtOrder`, `UnapprovedTransfer` |
| `approvers` | The signers who approved |

The reason is a closed set of codes, so no free text reaches the chain.

## Why no personal data is involved

The chain holds wallet addresses, reason codes and signer addresses only. Who a wallet belongs to, the sanctions match, the court order and the KYB file stay with TruMarket and the SPV. The public compliance log on the dashboard (`#/compliance`, from `npm run report`) shows the same fields as the events.

## Logging

1. A written case: the reason, the evidence, and the two approving signers.
2. The holder is notified, unless an order forbids it.
3. The transaction is signed by 2 of 3 compliance signers and sent; its hash is added to the case.
4. The event appears in the public compliance log, and the SPV register is reconciled the same day.

## Obligation and mechanism

| Need | Mechanism |
|---|---|
| Only approved holders | AUTH_REQUIRED; authorization after KYB |
| Act on sanctions or court orders | `freeze`, `clawback` with SANCTIONS or COURT_ORDER |
| End access when KYB lapses | `revoke` with KYB_LAPSE |
| Undo a transfer to an unapproved wallet | `freeze` or `clawback` with UNAPPROVED_TRANSFER |
| No single person can act | 2 of 3 compliance signers per action, enforced in the contract |
| Audit trail | One event per action, public compliance log |
| Data minimization | Reason codes only, no personal data |

## Residual considerations

- Wallet addresses are pseudonymous, not anonymous: anyone who links a wallet to an entity can read its compliance history.
- RPC keeps events for about 7 days, so the log is kept by the exporter of the records and an indexer or history archive (for example Mercury), and checked against the chain.
- Freezing doesn't move value. Clawback does, and is limited to the cases above ([governance.md](governance.md)).
