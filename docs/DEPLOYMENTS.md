# Deployments and evidence (Stellar testnet)

> Two records: **[v0.3 (Circle testnet USDC)](#v03-circle-testnet-usdc)**, one offering run end to end on the v0.3 contract, and the **[v0.2 per-shipment prototype (HackMeridian, TUSDC)](#v02-per-shipment-prototype-hackmeridian-tusdc)**, whose IDs and transactions don't change. Both use one offering and one share asset per shipment; the pilot uses one pool share, TRU3, with per-receivable attestations ([pool contract v1](pool-contract-v1.md)), which is not deployed yet.

Every Proof of Trading artifact deployed on **Stellar testnet**, what each one proves, and an explorer link to check it yourself. Nothing here is on mainnet. Shipments are synthetic, TUSDC is test USDC, and the SPV, KYB and insurance assignment are simulated (see [Simulated vs real](../README.md#simulated-vs-real)).

- **Repository:** https://github.com/AgroSmart-Contracts/Proof-Of-Trading
- **Demo app:** https://proof-of-trading.vercel.app
- **Network:** testnet (`Test SDF Network ; September 2015`), RPC `https://soroban-testnet.stellar.org`
- **Checked:** v0.2 on 2026-11-06 12:44 UTC (ledger 5589082); v0.3 on 2026-11-05 20:09 UTC (ledger 5577148)

## Summary

| Check | Result |
|---|---|
| v0.2 contracts exist on testnet (RPC `getLedgerEntries`) | **12/12** |
| Accounts exist on testnet (RPC `getLedgerEntries`) | **9/9** |
| v0.2 transactions confirmed successful | **72/72** |
| v0.3 contracts exist (offering v0.3, Circle USDC SAC, TM0280 SAC) | **3/3** |
| v0.3 transactions confirmed successful (run, USDC setup, home_domain) | **29/29** |
| `npm run verify` (proof hashes recomputed from payloads) | **20/20 PASS** (6 from offering storage, 1 from an outcome record in contract storage, 13 from Horizon) |
| v0.2 offering contract rebuilt from source matches the deployed WASM | **yes** (`2ee4cfceda8f…`) |
| v0.3 offering contract build matches the deployed WASM | **yes** (`3de0debc8fef…`) |
| Spike contract rebuilt from source matches the deployed WASM | **yes** (`493b4477041c…`) |

Nothing was missing. If a later check fails to find an artifact (for example after a testnet reset), it is marked ❌ here and stays in the list.

**How transactions were checked.** RPC keeps transactions for about 7 days, and these date from 24 and 25 Oct 2026, so RPC `getTransaction` no longer serves them. Each one was confirmed in Horizon's testnet history (`/transactions/<hash>`, `successful: true`) instead. For the 17 attestations, whose signed envelopes are stored, the envelope was also checked to hash to the recorded transaction ID ("envelope ✓"), and `npm run verify` recomputes each proof hash from its payload and matches it to the envelope's `MEMO_HASH`.

## Source code the deployments were made from

The deployments were made from the working tree during the build and committed afterwards, so the strongest evidence is a reproducible build: rebuilding from the committed source gives byte-for-byte the WASM that runs on testnet.

| Deployed | When (UTC) | Code | Evidence |
|---|---|---|---|
| Spike contract, SPIKE01 SAC, TUSDC, share assets TM0247 to TM0270, 12 shipment attestations | 24 Oct 2026, 22:22 to 22:35 | Tag [`v0.1`](https://github.com/AgroSmart-Contracts/Proof-Of-Trading/tree/v0.1) (`1756c75`) | `stellar contract build --package share-admin-spike` at `v0.1` gives SHA-256 `493b4477041cf14ba48b6157170a2f4db74b6223c50b6a2c93f041ef59721453`, the WASM deployed at `CCVDLSWF…` |
| Offering contract | 25 Oct 2026, 11:37 | Commit [`99e8da4`](https://github.com/AgroSmart-Contracts/Proof-Of-Trading/commit/99e8da4) (source unchanged up to `2e5a0cd`) | `stellar contract build --package offering` (stellar-cli 28.1.0) gives SHA-256 `2ee4cfceda8f5c0ee0bfe4d556df49df529ee025fc4b334db8173704d52897ed`, equal to the WASM hash read from the deployed instance |
| Offering lifecycles (SHP-0247, 0251, 0258, 0263, 0270), share assets TM0280 to TM0282 | 25 Oct 2026 | Commits [`7c841d8`](https://github.com/AgroSmart-Contracts/Proof-Of-Trading/commit/7c841d8) (scripts) and [`d13c6c8`](https://github.com/AgroSmart-Contracts/Proof-Of-Trading/commit/d13c6c8) (data) | Transactions below |

This document was written at `main` = [`2e5a0cd`](https://github.com/AgroSmart-Contracts/Proof-Of-Trading/commit/2e5a0cd). The v0.2 work has no tag of its own.

To reproduce a hash, build the commit the deployment came from (the contract source changed in v0.3, so building `main` gives a different WASM): `git checkout 99e8da4 && cd contracts && stellar contract build --package offering --out-dir /tmp/wasm && shasum -a 256 /tmp/wasm/offering.wasm`.

## v0.3 (Circle testnet USDC)

Checked 2026-11-05 20:09 UTC, against testnet ledger 5577148: **3/3** contracts exist, **29/29** transactions confirmed successful (RPC), and the deployed WASM hash matches the build.

| Contract | ID | What it is |
|---|---|---|
| Offering contract v0.3 | [`CAYNSQPZFYTH3WYW5SNKYXAQI7NL7SKLUDMJGQSRCFISUT3MUOFEMQ3B`](https://stellar.expert/explorer/testnet/contract/CAYNSQPZFYTH3WYW5SNKYXAQI7NL7SKLUDMJGQSRCFISUT3MUOFEMQ3B) | Outcome records in storage, settlement asset fixed at deploy. WASM SHA-256 `3de0debc8fefaa807fce8d15e20e5caf6a07e562f39eea3cb595c0edce4f1b23`. Admin = issuer, recorder = attestor. |
| Circle testnet USDC SAC | [`CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`](https://stellar.expert/explorer/testnet/contract/CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA) | Circle's USDC, issuer [`GBBD47IF…LFLA5`](https://stellar.expert/explorer/testnet/account/GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5) (home domain centre.io). |
| TM0280 SAC | [`CCQ4VJIEK2PNB2SS7LXD33ZDOPPGK7HA2ON7ZLDUHXNDE3EKTL65T2AQ`](https://stellar.expert/explorer/testnet/contract/CCQ4VJIEK2PNB2SS7LXD33ZDOPPGK7HA2ON7ZLDUHXNDE3EKTL65T2AQ) | The share asset used for this run (issued in v0.1, never used by a v0.2 offering). |

**Reproduce the WASM hash:** the contract source is unchanged since commit `11f4984`; `git checkout 11f4984 && cd contracts && stellar contract build --package offering --out-dir /tmp/wasm && shasum -a 256 /tmp/wasm/offering.wasm` (stellar-cli 28.1.0).

### SHP-0280: happy path on Circle testnet USDC

The accounts are the same as in v0.2 (below). Offering ID 280, share asset TM0280, cap USD 100 so it could run on small amounts of testnet USDC.

| Step | Transaction | What it proves | Status |
|---|---|---|---|
| Contract deployed | [`f6b9e114…9ea1`](https://stellar.expert/explorer/testnet/tx/f6b9e114f6c6621387f4e421af7b46c162a334c9001511d89ef408fe3e369ea1) | v0.3 offering contract, constructor (admin, recorder, Circle testnet USDC SAC). | ✅ ledger 5577069 |
| SAC admin handover | [`6383a9c5…3725`](https://stellar.expert/explorer/testnet/tx/6383a9c566b0ba38085cb0c7f994d8e82c1e7a5abe65c71875ddced2c5013725) | The v0.3 contract becomes TM0280's admin. | ✅ ledger 5577071 |
| Offering created | [`a63470e4…ccf1`](https://stellar.expert/explorer/testnet/tx/a63470e49cbc6207549ab8f95e4591af8fdeffa563321dd2213e28a62e55ccf1) | Cap 100 shares (a faucet-sized run); terms 12% for 120 days; settles in Circle testnet USDC. | ✅ ledger 5577074 |
| Investor approvals | [`9fcbf41c…b397`](https://stellar.expert/explorer/testnet/tx/9fcbf41cd81175e45a2b456f2ca9e04324914726f084fd2ed3bdd467ee2ab397) | Investor A authorized (investor B: [`5d064551…1ffc`](https://stellar.expert/explorer/testnet/tx/5d064551611221cb30e1a7ce2f071b6f14a6326f69eafe390668930bd6161ffc)). The unapproved wallet's subscription is rejected by the asset, with no transaction (`Error(Contract, #11)`). | ✅ ledger 5577086 |
| Subscription, investor A | [`f57ef4a1…5bbc`](https://stellar.expert/explorer/testnet/tx/f57ef4a19683e7a018d0c8ca5604f0959389f96e343a3d42a7cdbdd3b27a5bbc) | 60 USDC in, 60 TM0280 minted. | ✅ ledger 5577091 |
| Subscription, investor B | [`4c952fe6…d851`](https://stellar.expert/explorer/testnet/tx/4c952fe60d9ffa4cabdb61e0c33dc6b31aa77798ddbbb07388e7f1da1847d851) | 40 USDC in, 40 TM0280 minted; the offering closes at its cap. | ✅ ledger 5577095 |
| Funding | [`288ab247…03dc`](https://stellar.expert/explorer/testnet/tx/288ab24789e0c7bf11482bdaca9568693a3197745fe90d61bfd60ee3c51b03dc) | 100 USDC moves to the SPV treasury. | ✅ ledger 5577104 |
| Buyer payment | [`be995362…f1f7`](https://stellar.expert/explorer/testnet/tx/be9953620cb785d32ce50311aefef28adf4c7c840fc1233fd023ef14d3adf1f7) | 105 USDC deposited, outcome 1 (buyer paid). | ✅ ledger 5577107 |
| Redemption, investor A | [`db927af8…d7de`](https://stellar.expert/explorer/testnet/tx/db927af86dd2fd1677dd8e9c4ce012a817936a71a778433e81b7e37fadb8d7de) | 60 shares burned, 62.3671232 USDC paid (the investor amount fixed in the subscription agreement). | ✅ ledger 5577112 |
| Redemption, investor B | [`9fdb7777…bed7`](https://stellar.expert/explorer/testnet/tx/9fdb7777f311e904f0fded2164466a15434c053334a761ec4231711fff60bed7) | 40 shares burned, 41.5780821 USDC paid. | ✅ ledger 5577116 |
| Surplus sweep | [`f1fc03f7…1eb8`](https://stellar.expert/explorer/testnet/tx/f1fc03f7729bd3b821430d40737023cacf2850eb171437fe78df099974cc1eb8) | What is above the investor amount goes back to the SPV treasury. | ✅ ledger 5577119 |
| Outcome attestation | [`5a6dcc2a…7029`](https://stellar.expert/explorer/testnet/tx/5a6dcc2a9879c9cc04bdd120acab1871aa1ad060b8affe639918feb2ff0b7029) | Outcome (code 1) as a MEMO_HASH attestation. | ✅ ledger 5577125 |
| Outcome record in contract storage | [`4af30c25…9562`](https://stellar.expert/explorer/testnet/tx/4af30c254d0aefea6581304d0828c724b0e14b7d4637faadbae0d36a27119562) | `record_outcome`: the recorder writes `Repaid` and the proof hash, once (`get_record --id 280`). | ✅ ledger 5577129 |
| SAC admin handback | [`fa079af2…8429`](https://stellar.expert/explorer/testnet/tx/fa079af2507697d8e5575520ec8a9892b6dff2feaae2e0c9c577584a24878429) | TM0280's admin goes back to the issuer at close. | ✅ ledger 5577136 |

### Circle testnet USDC for the run

Each role trusts Circle's testnet USDC and buys a small amount on the testnet DEX with testnet XLM (`npm run setup:circle-usdc`): the same asset as faucet.circle.com, which needs a browser captcha.

| Role | Trustline | Bought | Status |
|---|---|---|---|
| investor_a | [`43daa218…054c`](https://stellar.expert/explorer/testnet/tx/43daa2188cf76d80229083edc70e55dc9bae2350d043d920c06c86a9dd36054c) | [`5decb8dc…6ecb`](https://stellar.expert/explorer/testnet/tx/5decb8dc3b68024ca48ff28bc8eda33953d0ba7439209e4313f646439a8f6ecb) (60 USDC) | ✅ |
| investor_b | [`309cf34d…3754`](https://stellar.expert/explorer/testnet/tx/309cf34df9a2492417688afd1813dcbbc70f615c59d957118c038ebd1cb93754) | [`c2d864ad…052d`](https://stellar.expert/explorer/testnet/tx/c2d864adb842e9f05d29867a1352bdfb8732255194d24a56834226b7fb28052d) (40 USDC) | ✅ |
| spv_treasury | [`776e28cd…f1b2`](https://stellar.expert/explorer/testnet/tx/776e28cd8a7112a9b2e16116d9f9eb4b491b1e66360629577094a584a5d8f1b2) | [`ba028315…e0f9`](https://stellar.expert/explorer/testnet/tx/ba028315265936f80e58ef344c97afb0ea681b8ff949d7fa88999c26dd65e0f9) (10 USDC) | ✅ |
| unapproved | [`f5d59883…0e45`](https://stellar.expert/explorer/testnet/tx/f5d598834a92a3c5c827b80a5904a3b9d752f29439e29c294b8396a3e37f0e45) | [`1ff86741…6c6f`](https://stellar.expert/explorer/testnet/tx/1ff86741d3e7053a80e92d2e7ef75e4e02be42172843397f8e15ecc2e6e06c6f) (10 USDC) | ✅ |

### SEP-1: stellar.toml and home_domain

The issuer's `home_domain` is set to `proof-of-trading.vercel.app` ([`e3bce326…203a`](https://stellar.expert/explorer/testnet/tx/e3bce3266a70c0db9fdcb4cf20f8c1d3ae837cbc3efc0a274406a8ce3d0a203a), ✅ ledger 5577141), which serves [`/.well-known/stellar.toml`](https://proof-of-trading.vercel.app/.well-known/stellar.toml) with a `[[CURRENCIES]]` entry per share asset (`npm run stellar-toml`, `npm run home-domain`).

## v0.2 per-shipment prototype (HackMeridian, TUSDC)

### Contracts (v0.2 per-shipment prototype, TUSDC)

| Artifact | Contract ID | What it proves | Status |
|---|---|---|---|
| Offering contract | [`CDY4E5QNPU4GEAQG6RI526DSUK3TTRI6ONGWVTBKUZQY5XTZFF3BFVK7`](https://stellar.expert/explorer/testnet/contract/CDY4E5QNPU4GEAQG6RI526DSUK3TTRI6ONGWVTBKUZQY5XTZFF3BFVK7) | One instance runs every shipment's offering. It is the SAC admin of each share asset, so it mints shares on `subscribe` and burns them on `redeem`/`refund`. Deploy tx [`c21b60a8…84ba`](https://stellar.expert/explorer/testnet/tx/c21b60a82b9c903375802078fad8e6cb401d17428812aceac4d7b93cdc4584ba). | ✅ exists |
| Spike contract | [`CCVDLSWF4A2OXWNLZZUE6PAN2IEWQASF7VQ7F5DKFIJAVL6R6OREV5QQ`](https://stellar.expert/explorer/testnet/contract/CCVDLSWF4A2OXWNLZZUE6PAN2IEWQASF7VQ7F5DKFIJAVL6R6OREV5QQ) | The feasibility spike (decision **GO**): a Soroban contract can be a SAC's admin, mint to an approved wallet, be refused for an unapproved one, burn, and hand admin back. See [spike report](spike-report.md). | ✅ exists |
| SPIKE01 SAC | [`CCTLVNQJZY65YDN5N5NCA3D7JKF6CYZSUPITNY4MVPBPYQE27WUTT2FI`](https://stellar.expert/explorer/testnet/contract/CCTLVNQJZY65YDN5N5NCA3D7JKF6CYZSUPITNY4MVPBPYQE27WUTT2FI) | The test asset the spike contract administered. | ✅ exists |
| TUSDC SAC | [`CC3GZE5HDQGVXAMGRSERDGQPQUQH64ZVRMXUZ7KQZ6M5DUVF2WTVT2D6`](https://stellar.expert/explorer/testnet/contract/CC3GZE5HDQGVXAMGRSERDGQPQUQH64ZVRMXUZ7KQZ6M5DUVF2WTVT2D6) | Test USDC as a Soroban token, the currency investors subscribe in and are repaid in. Asset [TUSDC](https://stellar.expert/explorer/testnet/asset/TUSDC-GBV6QFVVWJHJHZUWCZPGEZFEEE74YKLWESZ5QP353V2PDZM3OPB2SVZM). | ✅ exists |

### Share assets (v0.2 per-shipment prototype: one per financed shipment)

Each is a classic asset with AUTH_REQUIRED, AUTH_REVOCABLE and AUTH_CLAWBACK_ENABLED, plus a Stellar Asset Contract, linked to the shipment's proof hash. Issuer for all: the issuer account below.

| Shipment | Asset | SAC contract ID | SAC deploy | Linked proof hash | Status |
|---|---|---|---|---|---|
| SHP-0247 | [TM0247](https://stellar.expert/explorer/testnet/asset/TM0247-GCGN654QTVW22WCIUFF3CSGHHHPQQ2L4AG7LQHUZQ4FKB4BWSF4R3W3F) | [`CCUFHZ634GXOIDRDQVSL2OQCQBRQIGUFIBKHX5NA5P26N44COZSE5JVE`](https://stellar.expert/explorer/testnet/contract/CCUFHZ634GXOIDRDQVSL2OQCQBRQIGUFIBKHX5NA5P26N44COZSE5JVE) | [`f106cf55…8364`](https://stellar.expert/explorer/testnet/tx/f106cf550b490d85fdb5ed3890233d8c79b7ad27fc2af62bf44acbb3229b8364) | `64901e64eed6…` | ✅ exists |
| SHP-0251 | [TM0251](https://stellar.expert/explorer/testnet/asset/TM0251-GCGN654QTVW22WCIUFF3CSGHHHPQQ2L4AG7LQHUZQ4FKB4BWSF4R3W3F) | [`CDBZJSLOF4CSBIWN6WPV7B5KO5TQAPJT2OCBCEHUKOQVBQUUUU72OXJX`](https://stellar.expert/explorer/testnet/contract/CDBZJSLOF4CSBIWN6WPV7B5KO5TQAPJT2OCBCEHUKOQVBQUUUU72OXJX) | [`535dfebd…ce06`](https://stellar.expert/explorer/testnet/tx/535dfebdc097cfce2452c6f0de3744f815d06dcb8c8577f247d4abe47383ce06) | `9612fccc8f1d…` | ✅ exists |
| SHP-0258 | [TM0258](https://stellar.expert/explorer/testnet/asset/TM0258-GCGN654QTVW22WCIUFF3CSGHHHPQQ2L4AG7LQHUZQ4FKB4BWSF4R3W3F) | [`CA66HDEMZOSMNHPYQZ4CXLDYG7J4JFJ5VZTIA22SYU6GQ7IBIIRCC4C5`](https://stellar.expert/explorer/testnet/contract/CA66HDEMZOSMNHPYQZ4CXLDYG7J4JFJ5VZTIA22SYU6GQ7IBIIRCC4C5) | [`e7f39b5a…a87b`](https://stellar.expert/explorer/testnet/tx/e7f39b5a2bc8576f31dc82fee24c2f950a6b684cf81b9376a597f91b5e24a87b) | `e7baf5398b4b…` | ✅ exists |
| SHP-0263 | [TM0263](https://stellar.expert/explorer/testnet/asset/TM0263-GCGN654QTVW22WCIUFF3CSGHHHPQQ2L4AG7LQHUZQ4FKB4BWSF4R3W3F) | [`CB4G37UY7QMZQCHGC57JWE63K5A3OUTI33US6LA2JRQ43UMOM6RCSSG2`](https://stellar.expert/explorer/testnet/contract/CB4G37UY7QMZQCHGC57JWE63K5A3OUTI33US6LA2JRQ43UMOM6RCSSG2) | [`a6a9d3da…75f2`](https://stellar.expert/explorer/testnet/tx/a6a9d3da714bc9efc4649d2a24de4bfc080f8d215ef67032e5548328ed6a75f2) | `38a2a124bd18…` | ✅ exists |
| SHP-0270 | [TM0270](https://stellar.expert/explorer/testnet/asset/TM0270-GCGN654QTVW22WCIUFF3CSGHHHPQQ2L4AG7LQHUZQ4FKB4BWSF4R3W3F) | [`CCG2RER3UVIYLDUFAOARFS57RNJ2WQ4W2PEEJL7P6FIZJNEJCC7RJXHD`](https://stellar.expert/explorer/testnet/contract/CCG2RER3UVIYLDUFAOARFS57RNJ2WQ4W2PEEJL7P6FIZJNEJCC7RJXHD) | [`52cca40d…d4b1`](https://stellar.expert/explorer/testnet/tx/52cca40d734d0d7c97555724d1f0eb25ddad405c4103e056d2ad86e25464d4b1) | `539085193407…` | ✅ exists |
| SHP-0280 | [TM0280](https://stellar.expert/explorer/testnet/asset/TM0280-GCGN654QTVW22WCIUFF3CSGHHHPQQ2L4AG7LQHUZQ4FKB4BWSF4R3W3F) | [`CCQ4VJIEK2PNB2SS7LXD33ZDOPPGK7HA2ON7ZLDUHXNDE3EKTL65T2AQ`](https://stellar.expert/explorer/testnet/contract/CCQ4VJIEK2PNB2SS7LXD33ZDOPPGK7HA2ON7ZLDUHXNDE3EKTL65T2AQ) | [`e2b37d93…22be`](https://stellar.expert/explorer/testnet/tx/e2b37d93f916d1807d631259022efe097b70afaf91c6d92620d396ca872922be) | `efb88e9b8af4…` | ✅ exists |
| SHP-0281 | [TM0281](https://stellar.expert/explorer/testnet/asset/TM0281-GCGN654QTVW22WCIUFF3CSGHHHPQQ2L4AG7LQHUZQ4FKB4BWSF4R3W3F) | [`CAJIBZPY7DMDEUXDMU6FWBJRMDQDIOSSNCRWZFWIDMTGYSWDWJUZUR7Y`](https://stellar.expert/explorer/testnet/contract/CAJIBZPY7DMDEUXDMU6FWBJRMDQDIOSSNCRWZFWIDMTGYSWDWJUZUR7Y) | [`10743aef…3503`](https://stellar.expert/explorer/testnet/tx/10743aef9278d67e4181dbd469d3c921df58c6da290d396b9a413600802e3503) | `5d49d04e5457…` | ✅ exists |
| SHP-0282 | [TM0282](https://stellar.expert/explorer/testnet/asset/TM0282-GCGN654QTVW22WCIUFF3CSGHHHPQQ2L4AG7LQHUZQ4FKB4BWSF4R3W3F) | [`CCOERLKU7QFBN4TZASPYYJI6OZNHKDGHWL6RZ3MX3THAK77USTWABX3S`](https://stellar.expert/explorer/testnet/contract/CCOERLKU7QFBN4TZASPYYJI6OZNHKDGHWL6RZ3MX3THAK77USTWABX3S) | [`2006e711…7650`](https://stellar.expert/explorer/testnet/tx/2006e7110d4aabf16501db37496e07a378abf000f1b2998c57c678b64a7b7650) | `8ec9377371ce…` | ✅ exists |

### Accounts

Public keys only. The secret keys are in a local `.env` that is never committed.

| Role | Public key | What it does | Status |
|---|---|---|---|
| Issuer | [`GCGN654QTVW22WCIUFF3CSGHHHPQQ2L4AG7LQHUZQ4FKB4BWSF4R3W3F`](https://stellar.expert/explorer/testnet/account/GCGN654QTVW22WCIUFF3CSGHHHPQQ2L4AG7LQHUZQ4FKB4BWSF4R3W3F) | Issues every share asset (and was each SAC's admin before handing it to the offering contract); admin of the offering contract. | ✅ exists |
| SPV treasury | [`GBS4BAE2XCPTJHLVTT66TVOP4XR7I6IS5INBHNZ4WGJJJK5B5MNAXJ45`](https://stellar.expert/explorer/testnet/account/GBS4BAE2XCPTJHLVTT66TVOP4XR7I6IS5INBHNZ4WGJJJK5B5MNAXJ45) | Receives the raise when an offering is funded. | ✅ exists |
| Recorder (attestor) | [`GBI6NQWAPIYVQRHNBPPRPFNDTFOUEWFCI5SGZ3246CKDOJZVDOHTOVTQ`](https://stellar.expert/explorer/testnet/account/GBI6NQWAPIYVQRHNBPPRPFNDTFOUEWFCI5SGZ3246CKDOJZVDOHTOVTQ) | Signs the attestation transactions that put each shipment's proof hash on-chain (`MEMO_HASH`). | ✅ exists |
| Attestation sink | [`GA4KMOAFWX46JF6WJUBPB43YOG3NWZBXUW3AJR46TFN2AWVWIGNXDEDP`](https://stellar.expert/explorer/testnet/account/GA4KMOAFWX46JF6WJUBPB43YOG3NWZBXUW3AJR46TFN2AWVWIGNXDEDP) | Receives the 1-stroop payment each attestation transaction carries. | ✅ exists |
| Investor A | [`GDZ5RNHG2CAE3QWLN36ZBLU6AY6OTDLVZZDLXU5JTHYH5XV44G5CSCSG`](https://stellar.expert/explorer/testnet/account/GDZ5RNHG2CAE3QWLN36ZBLU6AY6OTDLVZZDLXU5JTHYH5XV44G5CSCSG) | Approved test investor. | ✅ exists |
| Investor B | [`GCOASYQOWWJI2HHHB3KNQABUAKVRWYIM2ZSH2LQSHB3Z6UL3KVKICSWD`](https://stellar.expert/explorer/testnet/account/GCOASYQOWWJI2HHHB3KNQABUAKVRWYIM2ZSH2LQSHB3Z6UL3KVKICSWD) | Approved test investor. | ✅ exists |
| Unapproved wallet | [`GBF5V63D2QN5QCOLVABLFOSAXNIZIOE6ZRQ5DEWIPYLPOLOTV3IT2HNT`](https://stellar.expert/explorer/testnet/account/GBF5V63D2QN5QCOLVABLFOSAXNIZIOE6ZRQ5DEWIPYLPOLOTV3IT2HNT) | Never approved; its subscriptions are rejected by the asset itself. | ✅ exists |
| TUSDC issuer | [`GBV6QFVVWJHJHZUWCZPGEZFEEE74YKLWESZ5QP353V2PDZM3OPB2SVZM`](https://stellar.expert/explorer/testnet/account/GBV6QFVVWJHJHZUWCZPGEZFEEE74YKLWESZ5QP353V2PDZM3OPB2SVZM) | Issues test USDC. | ✅ exists |
| Spike issuer | [`GCKEQM3ULIAWQB5LJDG4AFKIVPK5NWWQRYNKXZ6CGJ3GXRVDBMG2PWGL`](https://stellar.expert/explorer/testnet/account/GCKEQM3ULIAWQB5LJDG4AFKIVPK5NWWQRYNKXZ6CGJ3GXRVDBMG2PWGL) | Throwaway issuer used only by the spike. | ✅ exists |

### SHP-0247: happy path, buyer pays

Two approved investors subscribe 60/40, the buyer pays in full, both are paid the investor amount fixed in the subscription agreement (12% for 120 days) and the surplus goes back to the SPV. Offering ID 247, share asset TM0247.

| Step | Transaction | What it proves | Status |
|---|---|---|---|
| Shipment record (customs + financed attestation) | [`88cfe725…4aad`](https://stellar.expert/explorer/testnet/tx/88cfe725eb57da4d3d37c663e959e3b84d18e3448434d738d16e7ca763d84aad) | The shipment's proof hash is on-chain. | ✅ ledger 5371388, envelope ✓ |
| SAC admin handover | [`2e75d825…0858`](https://stellar.expert/explorer/testnet/tx/2e75d825535503709cd484f675eff29e91e6154db120e45aa254e6f666900858) | The offering contract becomes TM0247's admin, so it alone can mint and burn. | ✅ ledger 5382571 |
| Offering created | [`c86fdc7a…8bd7`](https://stellar.expert/explorer/testnet/tx/c86fdc7a69d72be136c94615eab62f1030f849447b750eaef997bfe455e38bd7) | Cap 100,000 shares; offering terms 12% for 120 days. | ✅ ledger 5382572 |
| Investor approvals and trustlines | [`cd837b5d…1ffa`](https://stellar.expert/explorer/testnet/tx/cd837b5d44d5bd395a78638fc42b8c044b372b1ca04ef1a296f8b6925a421ffa) | Investors A and B authorized ([B](https://stellar.expert/explorer/testnet/tx/a969da474f746a31c445dbafc718fc544813b03380613c7647f510d5b115164d)); the unapproved wallet gets a trustline but no authorization ([trustline](https://stellar.expert/explorer/testnet/tx/54dd82063b2acf7ec0ccff73dc72b63ddf11a0122f77a979ad4362f70232f6f5)). | ✅ ledger 5382576 |
| Subscription, investor A | [`e7ea02bb…ae99`](https://stellar.expert/explorer/testnet/tx/e7ea02bb2f8d66883694cc8c0fa2834a64fb803907518224bd1968409afdae99) | 60,000 TUSDC in, 60,000 TM0247 minted. | ✅ ledger 5382578 |
| Subscription, investor B | [`532e6b07…0ecb`](https://stellar.expert/explorer/testnet/tx/532e6b070f6fca891f46100550329f79df3e636789b187650d0e4b2039fc0ecb) | 40,000 TUSDC in, 40,000 TM0247 minted; the offering is fully subscribed. | ✅ ledger 5382579 |
| Funding | [`5fd00fa6…eaae`](https://stellar.expert/explorer/testnet/tx/5fd00fa661bc9782ec8bc7bf4952a658892c1cf751ce9ea1cb90ab15e8b0eaae) | 100,000 TUSDC moves to the SPV treasury. | ✅ ledger 5382580 |
| Buyer payment | [`127fafb6…c36d`](https://stellar.expert/explorer/testnet/tx/127fafb6262c1f6def0661eb077aa6a66e7a5de9472cd574adf9c11301b9c36d) | 105,000 TUSDC deposited, outcome 1 (buyer paid). | ✅ ledger 5382581 |
| Redemption, investor A | [`fbfcc984…00bc`](https://stellar.expert/explorer/testnet/tx/fbfcc98464208dc18a2aa0f2ff2aef817f1949f4a8dc65d954be9aa510f900bc) | 60,000 shares burned, 62,367.12 TUSDC paid (the investor amount fixed in the subscription agreement). | ✅ ledger 5382582 |
| Redemption, investor B | [`ccf1ad04…7a77`](https://stellar.expert/explorer/testnet/tx/ccf1ad042f9ed269cd2f1789ddb02c4f5f600f05b3232570968cb0d18b5a7a77) | 40,000 shares burned, 41,578.08 TUSDC paid. | ✅ ledger 5382583 |
| Surplus sweep | [`9b458a45…1362`](https://stellar.expert/explorer/testnet/tx/9b458a45bccc16d418713d962da9a1864a1edf961a9eb6d4b7c910db78ba1362) | 1,054.79 TUSDC above what investors are owed goes back to the SPV. | ✅ ledger 5382584 |
| Outcome record | [`784d4189…2030`](https://stellar.expert/explorer/testnet/tx/784d41899a776068e1023361e4dc792ea6fadc3151f9ca21860b36ab45432030) | The outcome (code 1) is attested on-chain. | ✅ ledger 5382585 |

### SHP-0251: insured failure, insurer pays 90%

The buyer defaults and the insurer pays 90%; investors share what was collected pro rata. Offering ID 251, share asset TM0251.

| Step | Transaction | What it proves | Status |
|---|---|---|---|
| Shipment record | [`38cc4ef0…1dde`](https://stellar.expert/explorer/testnet/tx/38cc4ef09771a616c6141d9cf418450d3fb166997b3f8ada17ccbe63c9a81dde) | The shipment's proof hash is on-chain. | ✅ ledger 5371389, envelope ✓ |
| SAC admin handover | [`344ef2c9…69f8`](https://stellar.expert/explorer/testnet/tx/344ef2c935de08ec9924d9de16d9c2b1010eec277e9fdc97e52e1b0b7e7c69f8) | The offering contract becomes TM0251's admin. | ✅ ledger 5380961 |
| Offering created | [`f0b4a048…535c`](https://stellar.expert/explorer/testnet/tx/f0b4a0480478f81b0f357938b98c61eec98edca84be483a0a247d24c364f535c) | Cap 60,000 shares; offering terms 11% for 90 days. | ✅ ledger 5380962 |
| Subscription, investor A | [`b2c83c02…a615`](https://stellar.expert/explorer/testnet/tx/b2c83c02df56d8760c7aeb5fd5a03e2f7fe18a2a79ca80e1d6bd9f2b088ba615) | 36,000 TM0251 minted. | ✅ ledger 5380968 |
| Subscription, investor B | [`46908996…f300`](https://stellar.expert/explorer/testnet/tx/46908996521405b43679c971664c9e307fe5baa797c4d7e957320181a4acf300) | 24,000 TM0251 minted. | ✅ ledger 5380969 |
| Funding | [`986093fb…9b06`](https://stellar.expert/explorer/testnet/tx/986093fb0a3e8ae8584ec270d770f8f902603d502d743edf54277adcbcd99b06) | 60,000 TUSDC to the SPV treasury. | ✅ ledger 5380970 |
| Insurer payment | [`1dc7c6ba…b6e5`](https://stellar.expert/explorer/testnet/tx/1dc7c6badea78ee57035f6cb8c9651e8d2924ae063f22d048eca142188b4b6e5) | 54,000 TUSDC (90%) deposited, outcome 4 (insurer paid). | ✅ ledger 5380971 |
| Pro-rata redemption, investor A | [`d565cacd…0cc6`](https://stellar.expert/explorer/testnet/tx/d565cacd2c76b83d8f6a0dc14997fa9a12c448b510adc4865b2ea63ee2840cc6) | 36,000 shares burned, 32,400 TUSDC paid (90%). | ✅ ledger 5380972 |
| Pro-rata redemption, investor B | [`b744cd9f…8f68`](https://stellar.expert/explorer/testnet/tx/b744cd9fc8babb21eee0edac4bbffb45879ef4d39edb457efce509553b228f68) | 24,000 shares burned, 21,600 TUSDC paid (90%). | ✅ ledger 5380973 |
| Outcome record | [`33246c5a…b0c6`](https://stellar.expert/explorer/testnet/tx/33246c5a3bdab4e257d43a8b3f2d88a0e4d79d3a1af6790f18280682cf0ab0c6) | The outcome (code 4) is attested on-chain. | ✅ ledger 5380974 |

### SHP-0258: under-subscribed, refunded

A short-deadline offering raises only 10,000 of 150,000; after the deadline, subscribers are refunded in full. Offering ID 258, share asset TM0258.

| Step | Transaction | What it proves | Status |
|---|---|---|---|
| Shipment record | [`25fe2ff8…c4b1`](https://stellar.expert/explorer/testnet/tx/25fe2ff823789f6d94f78b0b3c69576e30b024d94972f3d32712393f38b2c4b1) | The shipment's proof hash is on-chain. | ✅ ledger 5371390, envelope ✓ |
| SAC admin handover | [`2edc5509…c7a9`](https://stellar.expert/explorer/testnet/tx/2edc550969a0bd96656de22e4cb7fb7737970162426f0f07bf6b6d45ffd2c7a9) | The offering contract becomes TM0258's admin. | ✅ ledger 5380976 |
| Offering created | [`f87463ff…689a`](https://stellar.expert/explorer/testnet/tx/f87463ff8b978d9e82019444d3c849e53acda603d4d8512718c212cc813c689a) | Cap 150,000 shares; offering terms 13% for 120 days; 5-minute deadline. | ✅ ledger 5380977 |
| Subscription, investor A | [`202e3ef3…8ad5`](https://stellar.expert/explorer/testnet/tx/202e3ef3d22d2c4110ea5a26a6ee8adf950358e36968ee662c876ddd59778ad5) | 10,000 TM0258 minted. | ✅ ledger 5380980 |
| Start refunds | [`1a9b4a29…3286`](https://stellar.expert/explorer/testnet/tx/1a9b4a29f2113e5148b004911f8ddb3a9cac7228499a8cbc41ac7f8143f53286) | After the deadline, the under-subscribed offering switches to refunding. | ✅ ledger 5381044 |
| Refund, investor A | [`f5631fc1…cfa6`](https://stellar.expert/explorer/testnet/tx/f5631fc129e8ad998ddfafa606e975dc5de8e848763d4d21ea1f3493dd67cfa6) | Shares burned, 10,000 TUSDC returned. | ✅ ledger 5381045 |

### Spike transactions (24 Oct 2026)

| Step | Transaction | Status |
|---|---|---|
| 0a issuer flags AUTH_REQUIRED \| REVOCABLE \| CLAWBACK | [`1391c32a…620d`](https://stellar.expert/explorer/testnet/tx/1391c32a1a620845341ad4dd7f9e23ea9b36d46f8e2da06bf8b6e4e86a81620d) | ✅ ledger 5371515 |
| 0b deploy SPIKE01 SAC | [`0e47ff51…7160`](https://stellar.expert/explorer/testnet/tx/0e47ff51ad0c51b641893c3a757fd7243a634325170c366fae5ca5e3911a7160) | ✅ ledger 5371516 |
| 0c deploy spike contract (admin = throwaway issuer) | [`c80f2b2d…6a03`](https://stellar.expert/explorer/testnet/tx/c80f2b2d32113f05353b9fcc000790fe20b6b052661b598729ed18f608f86a03) | ✅ ledger 5371518 |
| 1 issuer: SAC set_admin(spike contract) | [`752d3682…8c01`](https://stellar.expert/explorer/testnet/tx/752d36820664824e1d665f9a7254770c77360d0e7d782c319221aeea73cb8c01) | ✅ ledger 5371519 |
| 2 investor_a trustline to SPIKE01 | [`0eba84c0…9b15`](https://stellar.expert/explorer/testnet/tx/0eba84c0f2577b2d59e4bd67bedff6069873a6dcbc9f898312277c2793089b15) | ✅ ledger 5371520 |
| 3 spike.approve(investor_a) | [`dcfd0ff8…7a5f`](https://stellar.expert/explorer/testnet/tx/dcfd0ff809e725608505d60b8adb51315d93cfc014689bc98069dddbc73b7a5f) | ✅ ledger 5371521 |
| 4 spike.mint(investor_a, 100) | [`f01d196e…8b50`](https://stellar.expert/explorer/testnet/tx/f01d196e58f81a18078a4d2a126353438652c7f1adabbf2ca6ed51c2ef8f8b50) | ✅ ledger 5371522 |
| 5a unapproved trustline to SPIKE01 (not authorized) | [`ca02284c…a052`](https://stellar.expert/explorer/testnet/tx/ca02284cedfdb92f79df22d99c7566a8950148dc54167e750e2ad138d390a052) | ✅ ledger 5371523 |
| 5b spike.mint(unapproved, 100) must FAIL | expected failure, no transaction (rejected with `Error(Contract, #11)`) | ✅ failed as intended |
| 6 investor_a burn_from_holder(10) | [`2f4634f8…e9d7`](https://stellar.expert/explorer/testnet/tx/2f4634f8a9500b62aa1dc1011df2ba29dd028c9fd14073332f951d410781e9d7) | ✅ ledger 5371524 |
| 7 spike.hand_over(issuer) | [`5b68a579…853b`](https://stellar.expert/explorer/testnet/tx/5b68a579e59153f320c81f8c20d007d10dacefcca675892047451a2d51cf853b) | ✅ ledger 5371525 |

Other offerings run on testnet (SHP-0263, SHP-0270, SHP-0282) and the remaining attestations are in the local records and in the [dashboard export](../apps/dashboard/public/public-store.json).

## Re-check it yourself

Every row above links to stellar.expert: open any contract, account, asset or transaction to see it on testnet. You can also query the IDs directly, for example a transaction on Horizon (`https://horizon-testnet.stellar.org/transactions/<hash>`) or a contract with `stellar contract info interface --id <contract ID> --network testnet`.

The proof-hash check (`npm run verify`, 19/19 PASS above) and the testnet lookups were run against the raw deployment records in `data/store/`. Those records are not committed, so `npm run verify` reports "no attestation records found" in a fresh clone; the public values from them are all listed here and in the dashboard's [public export](../apps/dashboard/public/public-store.json).
