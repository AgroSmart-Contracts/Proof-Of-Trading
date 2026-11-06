# Governance

Who controls what, how keys are secured, and when the strongest powers (freeze and clawback) may be used. Today every key is a single testnet key in a local `.env`; this document is the plan for pilots and mainnet, with the setup script ready to apply it.

## Roles and powers

| Role | Account / address | Can do | Cannot do |
|---|---|---|---|
| **Admin** | Issuer account (also the offering contract's admin) | Create offerings, approve investors, fund, start refunds, sweep surplus, hand back SAC admin, replace the recorder | Move investors' escrowed USDC anywhere except to the SPV treasury (on `fund`) or back to them (on `refund`) |
| **Issuer** | Same issuer account, for classic operations | Issue share assets; freeze a holder (revoke trustline authorization); clawback | Mint while the offering contract is SAC admin (only the contract mints) |
| **SPV treasury** | Treasury account | Receive funding; deposit what was collected (`deposit_distribution`) | Take escrow before the cap is reached |
| **Recorder** | Attestor account | Sign attestation transactions; write each offering's outcome record once (`record_outcome`) | Change a record once written; touch funds or shares |
| **Investor** | Investor wallet | Subscribe, redeem, refund their own position | Hold shares without approval (the asset refuses) |

The offering contract enforces the admin, recorder, treasury and investor limits in code (tested in `contracts/offering/src/test.rs`, auth matrix tests). The issuer's classic powers are protocol features, controlled by the multisig below.

## Multisig

### Thresholds and signers (proposal)

| Account | Signers | Threshold | Master key |
|---|---|---|---|
| Issuer / admin (pool contract admin in the pilot) | 3 keys, weight 1 each | 2 for low, medium and high | weight 0 (locked) |
| SPV treasury (collection account in the pilot) | 3 keys, weight 1 each | 2 for low, medium and high | weight 0 (locked) |
| Recorder | 1 dedicated key | 1 | in use |

**Signers: 2-of-3: CTO, COO, security lead; final keys confirmed before mainnet.** One key each, held separately. No signer addresses are set yet, and none are listed here until they are confirmed. Keys live in hardware wallets or a KMS, never in `.env`.

In the pilot, the same 2-of-3 controls the pool contract's admin (and so TRU3 issuance) and the collection account, which receives buyers' payments ([pool contract v1](pool-contract-v1.md)).

Soroban checks a classic account's **medium** threshold when a contract calls `require_auth` on it, so 2 of 3 signers must authorize every admin call to the offering contract, as well as every classic operation from the issuer or treasury.

The recorder stays a single key on purpose: it can only append records that must match the offering's state, cannot touch funds, and can be replaced by the admin (`set_recorder`) if it is lost or compromised.

### Setup

[`scripts/governance-setup.ts`](../scripts/governance-setup.ts) applies the table above in **one transaction** per account: add the signers, set the thresholds, set the master weight to 0. It is a dry run unless `--submit` is passed, and it refuses any setup that could lock the account out (threshold above the number of signers, duplicates, the account's own key as a signer, a threshold of 1 with several signers).

```sh
GOV_SIGNERS=G...cto,G...coo,G...security GOV_THRESHOLD=2 npm run governance:setup -- issuer          # dry run
GOV_SIGNERS=G...cto,G...coo,G...security GOV_THRESHOLD=2 npm run governance:setup -- issuer --submit
GOV_SIGNERS=... npm run governance:setup -- spv_treasury --submit
```

Order for a new deployment:

1. Create the issuer and set AUTH_REQUIRED, AUTH_REVOCABLE and AUTH_CLAWBACK_ENABLED **before** any trustline exists.
2. Issue each share asset, deploy its SAC and hand the SAC admin to the offering contract.
3. Run `governance-setup.ts` for the issuer and the treasury. From then on every admin action needs 2 of 3 signatures.

It has **not** been run on the testnet demo accounts: the demo scripts sign with one key each, and would stop working. Multi-signature signing in the scripts and the TruMarket API comes first.

### Issuer lock

"Locking the issuer" means its master key weight is 0, so the original secret can never sign again. The account is **not** made unusable: the multisig signers still control it, because the asset has to stay administrable. Freeze, clawback and taking back the SAC admin at offering close all need the issuer. A lock with no remaining signers would make every share asset permanently unmanageable; the setup script cannot produce that state.

### Upgrades (pool contract)

- An upgrade needs 2 of 3 signers and is announced to holders **30 days** before it takes effect.
- Economic terms can't change by upgrade: the waterfall, the 90% advance, the concentration limits and the term stay as set in the subscription agreement.

## Freeze and clawback policy

Share assets have AUTH_REVOCABLE (freeze) and AUTH_CLAWBACK_ENABLED (recover shares). Both are classic operations signed by the issuer, so both need the 2-of-3 issuer multisig, and both are logged.

**When freeze (revoke authorization) may be used:**

- a sanctions or AML hit on the holder;
- a credible report that the holder's key is compromised, until it is resolved;
- a court or regulator order.

**When clawback may be used:**

- a court or regulator order;
- a provable operational error (shares minted or sent to the wrong account);
- reissuing shares to a holder who has lost their key, at their request, after KYB re-verification. The clawed-back amount is reissued to the holder's new, approved account.

**Never** to settle a commercial dispute, to change the terms of an offering or of the pool, or to move value between investors. `freeze`, `unfreeze`, `revoke` and `clawback` each take a reason code and need 2 of 3 compliance signers: [compliance-actions.md](compliance-actions.md).

**Process:**

1. Written record of the reason (order, report or error), approved by two of the three signers.
2. The holder is notified, unless an order forbids it.
3. The operation is signed by two of three signers; the transaction hash is added to the offering's record.
4. Shares clawed back under an order or error are held or burned as the order or the correction requires; supply and the SPV register are reconciled the same day.

## SAC admin handback at offering close

While an offering runs, the offering contract is each share asset's SAC admin, so it alone mints and burns. When the offering is finished (every share redeemed or refunded, the surplus swept and the outcome recorded), the admin calls

```text
transfer_share_admin(share_token, issuer)
```

which hands the SAC admin role back to the issuer multisig (`npm run offering -- hand-back <ref>` does this today). Without it the asset would stay tied to the contract forever. The handback is the last step of every offering, and is also how a share asset moves to a successor contract if the offering contract is ever upgraded or replaced.
