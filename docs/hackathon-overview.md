# Proof of Trading: HackMeridian 2026 overview

What we built, the proof that it works on Stellar testnet, how to demo it, the demo video transcript, and how it plugs into the existing TruMarket platform.

![Proof of Trading lifecycle](img/lifecycle.png)

---

## 1. In one paragraph

TruMarket finances insured agri-export shipments, mostly from Peru (~247 deals, ~$22M over 24 months). Exporters wait 90 to 120 days to be paid, and the insured shipment contracts behind those deals are real receivables that lenders still won't accept as collateral. Proof of Trading adds two layers on Stellar:

- **Proof layer.** Every consented shipment is **customs-attested**: a salted hash of its customs record (and, for financed shipments, the insurance assignment and CRAM risk band) goes on-chain. The data stays private.
- **Finance layer.** Each financed shipment gets an SPV whose shares are a Stellar asset that only approved investors can hold. Investors subscribe in USDC and shares are minted automatically. When the buyer (or, on failure, the insurer) pays, investors redeem at the deal's fixed APY, or pro rata if less was collected, and the shares burn.

---

## 2. What we built

### Before the event: v0.1 (Sat Oct 24, tag `v0.1` = commit `1756c75`)
| Piece | What it does |
|---|---|
| `packages/core` | Proof payload schema v1 (zod, strict), RFC 8785-style canonical JSON + sha256, per-quarter HMAC pseudonyms, Stellar RPC helpers, Arc reader (stubbed), JSON store. 17 unit tests |
| Synthetic samples | 14 shipments (5 financed, 7 consented but unfinanced, 2 not consented and skipped). No real names or declarations |
| Testnet accounts + TUSDC | 8 accounts; our own **test USDC** (`TUSDC`) with its SAC |
| Attestations | One `MEMO_HASH` transaction per consented shipment; `verify` recomputes and checks against the stored envelope and the live chain |
| Spike (GO) | Proved a Soroban contract can be SAC admin of an AUTH_REQUIRED asset: authorize, mint, refuse an unapproved wallet, burn, hand admin back |
| Share assets | `TM0247`, `TM0251`, `TM0258`, `TM0263`, `TM0270`: native assets with AUTH_REQUIRED, AUTH_REVOCABLE and AUTH_CLAWBACK_ENABLED, each with a SAC linked to its proof hash |
| Dashboard v0.1 | Read-only list of attestations and share assets |

The README, docs and v0.2 plan were first drafted Saturday night (no v0.2 code) and extended during the event. See [`prior-work.md`](prior-work.md).

### At the event: v0.2 (from Sun Oct 25, 11:06)
| Piece | What it does |
|---|---|
| **Offering contract** (`contracts/offering`) | One instance, one offering per financed shipment. SAC admin of each share asset: mints on `subscribe`, burns on `redeem`/`refund`, escrows USDC, pays `min(owed at APY, collected)` pro rata, sweeps the surplus to the SPV, hands the SAC admin back. **17 tests** with exact base-unit assertions; key tests were checked by temporarily breaking the contract |
| Fee-bump deploy | Contract uploads need ~620 XLM of resource fee on testnet, above the ~429 XLM `u32` fee cap, so `submitSoroban` sends them as a fee bump (`i64` fee) |
| Offering CLI + demo scripts | `npm run offering -- <cmd>`, `demo`, `demo:failure`, `demo:refund`; every step prints an explorer link and is logged |
| Outcome attestations | After redemptions, an `outcome` proof (outcome code, amounts, hash of the SPV redemption confirmation) closes the loop |
| Dashboard v0.2 | Offerings page, investor views ("You own 60,000 shares of TM0247 (60% of the SPV)"), per-shipment timeline |
| Docs | Architecture (state machine, auth model, money rules, SCF path), lifecycle diagram, runbook |

### Stellar components used
| Track | Components |
|---|---|
| **Stellar Unlocked (core features, all in use)** | Native classic assets · issuer flags (auth required, revocable, clawback enabled) · trustlines + trustline authorization as the KYB gate · Stellar Asset Contract (`mint`, `burn`, `transfer`, `set_authorized`, `set_admin`) · SAC admin handover to a contract · Soroban contract (constructor, auth, persistent storage with TTL, events, errors) · `MEMO_HASH` attestations · Stellar RPC (no Horizon) · fee-bump transactions |
| **Stellar Composed (other protocols)** | Not yet: Blend borrowing is the stretch goal; USDC (Circle), price feed (SEP-40), DeFindex and CCTP are SCF roadmap |

**Recommended track: Stellar Unlocked** (switch to Composed only if the Blend stretch ships).

---

## 3. Evidence on Stellar testnet

Explorer: `https://stellar.expert/explorer/testnet/tx/<hash>`

| Item | ID |
|---|---|
| Offering contract | [`CDY4E5QNPU4GEAQG6RI526DSUK3TTRI6ONGWVTBKUZQY5XTZFF3BFVK7`](https://stellar.expert/explorer/testnet/contract/CDY4E5QNPU4GEAQG6RI526DSUK3TTRI6ONGWVTBKUZQY5XTZFF3BFVK7) (deploy tx `c21b60a8…84ba`) |
| TUSDC (test USDC) SAC | `CC3GZE5HDQGVXAMGRSERDGQPQUQH64ZVRMXUZ7KQZ6M5DUVF2WTVT2D6` |
| TM0247 share SAC | `CCUFHZ634GXOIDRDQVSL2OQCQBRQIGUFIBKHX5NA5P26N44COZSE5JVE` |
| Spike contract | `CCVDLSWF4A2OXWNLZZUE6PAN2IEWQASF7VQ7F5DKFIJAVL6R6OREV5QQ` |

### Happy path: SHP-0247 ($100,000, 12% APY, 120 days; buyer pays $105,000)
| Step | Result | Tx |
|---|---|---|
| Customs + financed attestation | Proof hash on-chain | [`88cfe725…`](https://stellar.expert/explorer/testnet/tx/88cfe725eb57da4d3d37c663e959e3b84d18e3448434d738d16e7ca763d84aad) |
| SAC admin → offering contract | Contract can mint/burn TM0247 | [`2e75d825…`](https://stellar.expert/explorer/testnet/tx/2e75d825535503709cd484f675eff29e91e6154db120e45aa254e6f666900858) |
| Offering created | Cap 100,000 shares | [`c86fdc7a…`](https://stellar.expert/explorer/testnet/tx/c86fdc7a69d72be136c94615eab62f1030f849447b750eaef997bfe455e38bd7) |
| Investor A subscribes 60,000 | 60,000 TM0247 minted | [`e7ea02bb…`](https://stellar.expert/explorer/testnet/tx/e7ea02bb2f8d66883694cc8c0fa2834a64fb803907518224bd1968409afdae99) |
| Investor B subscribes 40,000 | Offering closes | [`532e6b07…`](https://stellar.expert/explorer/testnet/tx/532e6b070f6fca891f46100550329f79df3e636789b187650d0e4b2039fc0ecb) |
| Fund | 100,000 TUSDC to SPV treasury | [`5fd00fa6…`](https://stellar.expert/explorer/testnet/tx/5fd00fa661bc9782ec8bc7bf4952a658892c1cf751ce9ea1cb90ab15e8b0eaae) |
| Buyer pays 105,000 (outcome 1) | Distributing | [`127fafb6…`](https://stellar.expert/explorer/testnet/tx/127fafb6262c1f6def0661eb077aa6a66e7a5de9472cd574adf9c11301b9c36d) |
| A redeems | **62,367.1232876** TUSDC, 60,000 shares burned | [`fbfcc984…`](https://stellar.expert/explorer/testnet/tx/fbfcc98464208dc18a2aa0f2ff2aef817f1949f4a8dc65d954be9aa510f900bc) |
| B redeems | **41,578.0821917** TUSDC, 40,000 shares burned | [`ccf1ad04…`](https://stellar.expert/explorer/testnet/tx/ccf1ad042f9ed269cd2f1789ddb02c4f5f600f05b3232570968cb0d18b5a7a77) |
| Surplus to SPV | 1,054.7945207 TUSDC | [`9b458a45…`](https://stellar.expert/explorer/testnet/tx/9b458a45bccc16d418713d962da9a1864a1edf961a9eb6d4b7c910db78ba1362) |
| Outcome attested | Code 1, redemption-confirmation hash | [`784d4189…`](https://stellar.expert/explorer/testnet/tx/784d41899a776068e1023361e4dc792ea6fadc3151f9ca21860b36ab45432030) |

The payouts match the values computed before the event (`docs/plan/v0.2-design.md`) to the last base unit.

### Insured failure: SHP-0251 ($60,000, 11% APY, 90 days; insurer pays 90%)
| Step | Result | Tx |
|---|---|---|
| Unapproved wallet subscribes | **Rejected**: SAC `BalanceDeauthorizedError` | (failed in simulation; nothing submitted) |
| Insurer pays 54,000 (outcome 4) | Distributing | [`1dc7c6ba…`](https://stellar.expert/explorer/testnet/tx/1dc7c6badea78ee57035f6cb8c9651e8d2924ae063f22d048eca142188b4b6e5) |
| A redeems 36,000 shares | **32,400** TUSDC (pro rata) | [`d565cacd…`](https://stellar.expert/explorer/testnet/tx/d565cacd2c76b83d8f6a0dc14997fa9a12c448b510adc4865b2ea63ee2840cc6) |
| B redeems 24,000 shares | **21,600** TUSDC | [`b744cd9f…`](https://stellar.expert/explorer/testnet/tx/b744cd9fc8babb21eee0edac4bbffb45879ef4d39edb457efce509553b228f68) |
| Sweep | `NothingToSweep`: investors received everything collected | (expected rejection) |
| Outcome attested | Code 4 | [`33246c5a…`](https://stellar.expert/explorer/testnet/tx/33246c5a3bdab4e257d43a8b3f2d88a0e4d79d3a1af6790f18280682cf0ab0c6) |

### Under-subscribed refund: SHP-0258 (5-minute deadline)
| Step | Result | Tx |
|---|---|---|
| A subscribes 10,000 of 150,000 | Deadline passes under cap | [`202e3ef3…`](https://stellar.expert/explorer/testnet/tx/202e3ef3d22d2c4110ea5a26a6ee8adf950358e36968ee662c876ddd59778ad5) |
| Start refunds | Refunding | [`1a9b4a29…`](https://stellar.expert/explorer/testnet/tx/1a9b4a29f2113e5148b004911f8ddb3a9cac7228499a8cbc41ac7f8143f53286) |
| A refunds | 10,000 TUSDC back, shares burned | [`f5631fc1…`](https://stellar.expert/explorer/testnet/tx/f5631fc129e8ad998ddfafa606e975dc5de8e848763d4d21ea1f3493dd67cfa6) |

Also on testnet: a full rehearsal on SHP-0270, a full investor-app test on SHP-0282 (with share certificates anchored on-chain), and 19 verified attestations (15 shipment proofs + 4 outcomes); `npm run verify` reports all PASS.

### What we learned on testnet
- **Upload fees follow the parsed module, not the byte count.** Padding a tiny contract to 14 KB cost 163 XLM; our 18 KB contract cost ~620 XLM. Solved with a fee bump.
- **Rent dominates.** Testnet state is above its target size, so extending one offering record to 120 days quoted ~10,000 XLM. The demo keeps entries at the ~7-day network minimum; production needs a keeper extending them to maturity.
- **The SAC admin must be returnable.** Our first deployment lacked a hand-back function and kept TM0263's admin role; the current contract has `transfer_share_admin`.

---

## 4. Running the demo

From the repo root (`proof-of-trading/`):
```sh
npm install
npm test && (cd contracts && cargo test)        # 17 TS + 17 contract + 2 spike tests
npm run verify                                    # every attestation PASS
npm run offering -- status SHP-0247               # on-chain state of an offering
(cd apps/dashboard && npm run dev)                # investor app (live mode: buttons sign testnet transactions)
```

### The investor app (dashboard)
`npm run dev` in `apps/dashboard` starts the app in **live mode**: a local API inside the dev server runs the same actions as the CLI, so every button signs a real testnet transaction. Signing keys stay in `.env` on your machine and never reach the browser. The hosted build (Vercel) has no API and is a **read-only snapshot**.

Switch personas with **"Viewing as"** (top right):
| Persona | Pages | What they can do |
|---|---|---|
| **Investor A / Investor B** | Invest, My portfolio, Proof explorer | Browse deals; read due diligence (customs attestation with in-browser **Verify on Stellar**, CRAM band, insurance, exporter/buyer track record); complete KYB (simulated); sign the subscription agreement; pay and receive shares; view the **off-chain SPV share certificate** issued in their name and verify its hash on Stellar; redeem or claim a refund |
| **Unapproved wallet** | Invest | Try to subscribe: the share asset refuses it (`BalanceDeauthorizedError`), and no TUSDC moves |
| **TruMarket ops (SPV)** | SPV operations, Proof explorer | Open offerings, approve investors, fund the SPV, record the buyer's or insurer's payment, return surplus, attest the outcome. Each deal shows only its next valid action |

What the investor holds after subscribing:
1. **The legal share, off-chain, in their name:** an SPV share certificate with a register entry (e.g. `SHP-0280-001`).
2. **Proof of it on Stellar:** the certificate's sha256 anchored as a `MEMO_HASH` by the SPV's registrar account, and the signed subscription agreement's sha256 recorded in their subscription transaction.
3. **An on-chain receipt:** `TM0280` tokens, minted when they paid and burned when they're repaid.

The **Verify on Stellar** buttons recompute the document hash in the browser and read the memo directly from Stellar RPC, without trusting TruMarket's server.

### Click-through for the video (live mode, on SHP-0280)
1. **TruMarket ops** → SPV operations → SHP-0280 → **Open offering**.
2. **Investor A** → Invest → SHP-0280: read the due diligence, click **Verify on Stellar** → **Complete KYB** → enter 60,000, tick the agreement → **Pay & subscribe**.
3. **Unapproved wallet** → the same deal → tick the agreement → **Pay & subscribe** → rejected by the asset.
4. **Investor B** → KYB → subscribe 40,000 → the offering closes.
5. **Investor A** → My portfolio → the certificate → **View certificate** → **Verify on Stellar**.
6. **Ops** → **Send escrow to SPV treasury** → **Buyer paid (on time)** with 105,000.
7. **Investor A** → My portfolio → **Redeem $62,367.12** (shares burned, certificate cancelled). Same for **Investor B**.
8. **Ops** → **Return surplus** → **Attest outcome** → Proof explorer → the SHP-0280 timeline.

Each click takes 5 to 15 seconds (testnet confirmation); the activity panel (bottom right) shows progress and explorer links. The dashboard flow was tested end to end on SHP-0282.

To run the full cycle on a fresh financed shipment (each shipment can only be run once):
```sh
npm run demo -- SHP-xxxx           # happy path
npm run demo:failure -- SHP-xxxx   # insurer pays 90%
npm run demo:refund -- SHP-xxxx    # under-subscribed refund
```
**For the recorded video: `npm run demo -- SHP-0280`.** SHP-0280 and its spare SHP-0281 were added on Sun Oct 25 with the same terms as SHP-0247 ($100,000, 12% APY, 120 days), so a live run reproduces the transcript's numbers. Both are attested and have share assets (`TM0280`, `TM0281`), with no offering yet. Every other sample has been used. To add more: append a row to `scripts/dev/gen-samples.ts`, run it, then `npm run attest -- --only SHP-xxxx` and `npm run issue:shares`.

---

## 5. Demo video transcript (target 2:30, hard cap 3:00)

Wording rules: records are **verifiable** (anyone can check them on Stellar) and shipments are **customs-attested**, but never say "verified" (that would claim the shipment itself was confirmed genuine); "protected", never "guaranteed"; not a retail product. Lead with **trade receivables**: the Stellar ecosystem knows the term.

**[0:00–0:20] The gap.** *Screen: deck, PMF slide.*
> Stellar holds over three billion dollars in real-world assets, but very little private trade credit reaches investors. TruMarket has financed about 247 insured agri-export shipments, around 22 million dollars. Each one is a real, insured trade receivable, yet the capital behind it sits locked for 90 to 120 days, because lenders won't take these receivables as collateral and the customs proof behind them can't be made public.

**[0:20–0:50] Proof layer.** *Screen: `npm run verify`, then the explorer showing the memo hash on the SHP-0247 attestation, then the dashboard shipment page.*
> First, the proof layer: verifiable shipment records. Every consented shipment is customs-attested on Stellar: we seal a fingerprint of its customs record, and for financed deals the insurance assignment and our risk band. The raw data never leaves TruMarket and exporter and buyer IDs rotate every quarter, but anyone can verify a record hasn't changed, straight from Stellar, in one click.

**[0:50–1:40] Finance layer, as an investor.** *Screen: investor app, click-through steps 1 to 5 above.*
> Now I'm an investor. This deal is one insured trade receivable, an avocado shipment: 12% fixed, 120 days, risk band B, and I can verify its customs record on Stellar myself. After KYB, I sign the subscription agreement and pay sixty thousand in USDC, test USDC here. In one transaction my money goes into escrow and the SPV's share tokens are minted to me. An unapproved wallet tries the same and the asset itself refuses it. What I actually own is a share of the SPV that holds this receivable, registered off-chain in my name. Here's my certificate, and it's verifiable on Stellar: one click proves it's the one on record. The token is my on-chain receipt.

**[1:40–2:05] Buyer pays.** *Screen: click-through steps 6 to 8: ops records the buyer payment, Investor A redeems, Proof explorer timeline.*
> The offering fills and funds the shipment. At maturity the buyer pays the SPV, and I redeem at the fixed 12% APY: sixty thousand becomes 62,367. My tokens are burned, my certificate is cancelled, and the outcome is attested back to the proof layer, adding to the exporter's and buyer's track record.

**[2:05–2:20] Shipment fails.** *Screen: dashboard SHP-0251 timeline.*
> If a shipment fails, the insurer pays the SPV, here 90%, and investors share what was collected pro rata: 32,400 and 21,600. We also handle offerings that don't fill: investors are refunded in full.

**[2:20–2:40] What's next.** *Screen: README "Simulated vs real" table, then the lifecycle diagram.*
> On testnet, the SPV legal structure, KYB, insurance assignment, customs data and USDC are simulated. SCF funding makes them real: legal structure, audit and multisig first, then pilots with professional investors, a price feed and a lending listing so these shares can back loans. Proof of Trading: verifiable, insured trade receivables on Stellar.

**Recording tips:** record the investor app in live mode (`cd apps/dashboard && npm run dev`) at 1280px or wider, browser zoom 110 to 125%. Record each section separately and stitch them; speed up the 5 to 15 second confirmations in editing. Use **SHP-0280** (same terms and numbers as SHP-0247). If a take goes wrong partway, don't re-run SHP-0280: switch to the spare, **SHP-0281**. The terminal alternative for the same flow is `npm run demo -- SHP-0280`.

---

## 6. How this integrates into the existing TruMarket platform

Proof of Trading is a **separate repository** today, by design: a clean before/during split for judging, no changes to production systems, testnet only. Its only link to TruMarket is a read-only Arc deal lookup, stubbed for the demo. The integration below is the plan for the SCF milestones; none of it is built yet.

### The deal lifecycle mapped to Stellar
| Stage in TruMarket | Stellar action | Demo equivalent |
|---|---|---|
| Exporter consents to sharing (new consent flag) | Shipment eligible for attestation | `consented: true` |
| Customs documents uploaded (the drawback pipeline already extracts DAM/customs records) | Shipment attestation | `attest.ts` |
| Deal financed: Arc DealsManager deal, CRAM band, insurance assigned | Financed attestation with the real Arc ID → share asset → offering | `issue-share-assets`, `create` |
| Investor passes KYB | `approve_investor` | `approve` |
| Investor invests in the investor app | `subscribe` from their Stellar wallet | `subscribe` |
| Deal fully funded | `fund` → SPV treasury → **existing** OSN/AgroPay payout to the supplier | `fund` |
| Buyer pays or insurance claim pays | `deposit_distribution` with outcome code | `distribute` |
| Investor withdraws | `redeem` + outcome attestation | `redeem`, `attest-outcome` |

### Changes per TruMarket app
| App | Change |
|---|---|
| **`api/` (NestJS)** | New `stellar` module (next to the existing Arc `blockchain` module) containing the `packages/core` and offering logic; deal-status triggers that enqueue Stellar actions; MongoDB collections replacing the JSON store (attestations with private salts, offerings, subscriptions, redemptions); an event indexer; a keeper job extending offering TTLs to maturity |
| **`admin-dashboard`** | KYB approval also calls `approve_investor`; ops actions for fund / record buyer payment / record insurance payout; offering status views |
| **Investor app (`trumarket-finance`)** | Stellar wallet connect (Freighter or passkeys); offering list with each shipment's proof; subscribe and redeem; holdings view (what the demo dashboard previews) |
| **Arc DealsManager** | Read only: real deal IDs in proof payloads instead of stubs |
| **Unchanged** | Lagoon vault on Base, supplier payout and escrow flow, the drawback product |

### Data boundary
On-chain: hashes, pseudonyms, share balances, USDC movements. Private in TruMarket's MongoDB: payloads, salts, the pseudonym secret, customs records, KYB files, investor identities.

### Decisions the integration depends on
1. **Money movement.** Investors pay USDC on Stellar, but payouts and Lagoon live on Base/Arc: bridge (CCTP) or convert off-chain at the SPV treasury.
2. **Source of truth.** Arc stays the deal record and Stellar the investor register; MongoDB links deal ID ↔ offering ID.
3. **Keys.** Issuer, admin, treasury and attestor keys move from `.env` to multisig + KMS.
4. **Counsel's answers**, especially **transferability**. Today, two approved investors *can* transfer shares between themselves (and trade them on the Stellar DEX). If counsel forbids that, transfers need an issuer-approval flow (SEP-8). The answer also decides whether shares can be posted as Blend collateral.

### Milestones
- **M1:** `stellar` module in the API, MongoDB store, admin hooks, multisig keys, audit, mainnet contract, legal structure.
- **M2:** investor-app wallet flow, pilot offerings with real USDC and independent professional investors, real Arc IDs and customs consent, price feed and Blend listing.
- **M3:** full lifecycle on mainnet, including an insured failure if one occurs; optional pool or vault token across shipments.

---

## 7. Simulated vs real

| Real-world dependency | On testnet | Becomes real in |
|---|---|---|
| SPV legal structure, securities basis | Treasury account + share asset; under counsel review | SCF M1 |
| Investor KYB | `approve_investor` stands in | SCF M1 |
| Insurance assignment to the SPV | sha256 of a placeholder | SCF M1 |
| Customs records, exporter consent | Synthetic files | SCF M1/M2 |
| Arc deal data | Labelled stubs | SCF M2 |
| CRAM risk scores | Precomputed bands | SCF M2 |
| USDC | TUSDC (our test asset) | SCF M1 |
| Audit, multisig, issuer lock | Documented only | SCF M1 |
| Price feed, Blend, vault | Roadmap | SCF M2/M3 |
