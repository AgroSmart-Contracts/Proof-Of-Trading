# Sunday/Monday runbook

## Status, Sun Oct 25 ~12:00 (event work)
| Item | State |
|---|---|
| Offering contract | Deployed `CDY4E5QNPU4GEAQG6RI526DSUK3TTRI6ONGWVTBKUZQY5XTZFF3BFVK7` (fee bump; 17 tests) |
| SHP-0270 | Happy path done on testnet (rehearsal) |
| SHP-0251 | Insured failure done (90%, outcome 4, pro rata 32,400 / 21,600) |
| SHP-0258 | Refund demo done |
| **SHP-0247** | **Untouched; reserved for the recorded live run: `npm run demo -- SHP-0247`** |
| SHP-0263 | Unusable: SAC admin held by the first deployment `CBLX5…`, which had no hand-back function (fixed in the current contract) |
| Dashboard | Offerings, investor A/B, timeline views; `npm run export` then `npm run dev` |

_The plan below was written before the event (Sat Oct 24)._

## Timeline (from brief 2, adjusted)
| When | Work | Done when |
|---|---|---|
| Sun 09:00–09:15 | Pull, `npm install`, `npm test`, `cargo test`, `npm run verify` (testnet still alive?) | All green |
| 09:15–13:00 | `contracts/offering` + 12 tests (`v0.2-test-plan.md`) | `cargo test` green; revert-and-check on tests 3, 8, 10 |
| 13:00–15:00 | `deploy-offering.ts`, `handover.ts`, `create-offering.ts` | Contract ID in `contracts.json`; TM0247 SAC admin = contract |
| 15:00–18:00 | `trustlines.ts`, `approve.ts`, `subscribe.ts`, `fund.ts` | A 60k + B 40k on TM0247, offering `Closed`, then `Funded` |
| 18:00–20:00 | Dashboard offerings + investor view; **backup video** | Recording saved |
| Mon 07:00–08:30 | `distribute.ts`, `redeem.ts`, `demo-failure.ts`, outcome attestations, `refund-demo.ts` | Both endings on testnet |
| 08:30–09:30 | README v0.2, architecture, final video, tag `v0.2` | No new features after 08:30 |
| 09:30–10:00 | Submit | Confirmed |

## Who signs what (from the spike: make the signer the tx source and simulation fills the auth)
| Call | Tx source / signer | Helper |
|---|---|---|
| Deploy offering (`__constructor(admin = issuer)`) | `issuer` | `deployContract(issuer, wasm, [addr(issuer)])` |
| SAC `set_admin(offering)` for TM0247 / TM0251 / TM0258 | `issuer` (current SAC admin) | `invoke(issuer, sac, "set_admin", [addr(offering)])` |
| `create_offering`, `approve_investor`, `fund`, `start_refunds`, `sweep_surplus` | `issuer` (acts as TruMarket ops = contract admin) | `invoke(issuer, …)` |
| Share trustlines (`changeTrust`) | each investor / `unapproved` | `submitClassic(investor, [Operation.changeTrust({ asset })])` |
| `subscribe`, `refund`, `redeem` | **the investor** | `invoke(investorKp, offering, "subscribe", …)` |
| `deposit_distribution` | `spv_treasury` | `invoke(treasury, …)` |
| Outcome attestation | `attestor` | reuse the `attest.ts` flow with `event: "outcome"` |

**Ordering rule:** trustline → `approve_investor` → `subscribe`. `set_authorized` fails without a trustline.

## Order of operations on testnet
1. `stellar contract build` (in `contracts/`), then `deploy-offering.ts`. Save `{ offering_id, wasm_hash, deploy_tx }` to `data/store/contracts.json`.
2. `handover.ts SHP-0247` and `handover.ts SHP-0251` (also `SHP-0258` for the refund demo). Check with `view(sac, "admin")`.
3. `create-offering.ts SHP-0247`. id = shipment number (247). `cap_shares = 100_000e7`, `deadline = now + 2h`, `term_secs = 120 * 86_400`, `apy_bps = 1200`.
4. `trustlines.ts SHP-0247` (A, B, unapproved).
5. `approve.ts SHP-0247 A` and `approve.ts SHP-0247 B`. **Do not approve `unapproved`.**
6. `subscribe.ts SHP-0247 A 60000`, then `B 40000` → `closed` event.
7. `subscribe.ts SHP-0247 unapproved 1000` must fail. Capture the error (SAC `#11`, BalanceDeauthorized) for the video. **Run it before B's subscription** if you want it to fail on deauth rather than on `BadStatus`.
8. `fund.ts SHP-0247` → treasury +100k.
9. `distribute.ts SHP-0247 105000 1` → `redeem.ts SHP-0247 A` and `B` → `sweep_surplus` → outcome attestation (code 1, with the redemption-confirmation digest).
10. `demo-failure.ts`: same on SHP-0251 (A 36k, B 24k, deposit 54,000, outcome 4).
11. `refund-demo.ts`: SHP-0258, 5-minute deadline, A subscribes 10,000, wait, `start_refunds`, `refund`.

## TUSDC budget (balances funded on Sat)
| Account | Start | After happy path | After failure path | After refund demo |
|---|---|---|---|---|
| investor_a | 100,000 | 102,367.12 | 98,767.12 | 98,767.12 |
| investor_b | 100,000 | 101,578.08 | 99,178.08 | 99,178.08 |
| spv_treasury | 50,000 | 46,054.79 (−105,000 deposit + 100,000 fund + 1,054.79 sweep) | 52,054.79 | 52,054.79 |
| unapproved | 100,000 | 100,000 (its failed tx reverts) | | |

Everything fits; no extra minting needed. If something goes wrong, `tusdc_issuer` can pay more TUSDC (it isn't flag-restricted).

## Encoding gotchas (JS)
- `i128`: `nativeToScVal(BigInt(x), { type: "i128" })`. `u32`: `{ type: "u32" }`. `u64`: `{ type: "u64" }`.
- `BytesN<32>`: `xdr.ScVal.scvBytes(Buffer.from(hex, "hex"))`.
- `Address`: `new Address(g).toScVal()` (the spike's `addr()` helper).
- `OfferingParams` struct is an `scvMap` with **symbol keys sorted by name**. Check that `nativeToScVal(obj, { type: { field: ["symbol", "<type>"] } })` sorts the keys; if it doesn't, build `xdr.ScVal.scvMap([...])` manually in sorted order. If this eats more than 20 minutes, generate bindings: `stellar contract bindings typescript --help` first (flags change between CLI versions), output to `packages/offering-client`.
- Reading results: `scValToNative(returnValue)`; i128 comes back as `bigint`.
- Contract errors arrive as `HostError: Error(Contract, #N)`. Map N through our `Error` enum, and note *which* contract raised it (diagnostic events show the contract ID).

## If testnet is reset overnight
Run `setup:accounts` → `setup:tusdc` → `attest` → `issue:shares` → `spike.ts`. All are idempotent, about 3 minutes in total. Update the README IDs afterwards.

## Cut order (brief 2 §9)
1. Dashboard polish/timeline (keep the investor-view text)
2. `refund-demo.ts` (keep unit test 7)
3. `demo-failure.ts` on-chain (keep unit test 9; describe it in the video)

**Never cut:** contract + tests, one real subscription with minted shares, one distribution + redemption on testnet, README simulated-vs-real + prior work, the video, submitting by 10:00.

## Stretch (only if all of the above is done by Mon 08:30)
Blend borrowing against TM0247 via `blend-utils` mock-example (3h cap), then treasury multisig.

## Stretch 1 notes (Blend borrowing), from Sunday research
- `blend-utils`: `npm i && npm run build`, `.env` from `.env.example` (`ADMIN`, `WHALE` keys + RPC/passphrase), `testnet.contracts.json` present, then `node ./lib/testing-scripts/mock-example.js testnet` (deploys tokens, mock oracle with prices, pool, backstop).
- Adding TM0247 as collateral: add it to `reserves` + a `ReserveConfig` (`c_factor` 0.25 to 0.40 → `2_500_000` to `4_000_000`) + `ReserveEmissionMetadata` in `lib/v2/user-scripts/deploy-pool.js`, register its SAC in `testnet.contracts.json`, set its mock price to $1 × haircut.
- **Blocker to plan for:** share assets are AUTH_REQUIRED, so the **pool contract must be authorized** to hold shares. `approve_investor` only works while an offering is `Open`. Needs a small admin fn `authorize_holder(share_token, holder)` → contract redeploy (~620 XLM via fee bump) → `transfer_share_admin` the used SACs from the current contract to the new one first.
- 3-hour cap. If it slips, describe it in the README instead (cut-order rule).
