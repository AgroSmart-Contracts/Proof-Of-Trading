# Demo video scripts (written before the event)

Wording rules: "customs-attested", never "verified"; "protected", never "guaranteed"; not a retail product.

## A. Backup video, Sunday evening (~90 s, rough is fine)
Its only job is to prove the core works if Monday's wifi or testnet fails.
1. Terminal: `npm run verify` → 12/12 PASS.
2. Terminal: `subscribe.ts SHP-0247 A 60000` and `B 40000` → tx links → `closed`.
3. Explorer: TM0247 holders show A 60,000 and B 40,000.
4. Terminal: unapproved subscribe → `Error(Contract, #11)`.
5. Dashboard: offering page shows Closed/Funded.

## B. Final video, Monday (2:30 target, 3:00 hard cap)
| Time | Screen | Voice-over (say roughly this) |
|---|---|---|
| 0:00–0:20 | Deck slide 3 (PMF numbers) | "Stellar holds over three billion dollars in real-world assets, but very little private trade credit reaches investors. TruMarket has financed about 247 insured agri-export shipments, around 22 million dollars. Those contracts are real receivables, yet they sit idle as collateral for 90 to 120 days." |
| 0:20–0:50 | `npm run attest -- --only SHP-0247 --force` → explorer memo → `npm run verify` | "Every consented shipment is customs-attested on Stellar: we hash its customs record, the insurance assignment and our risk band into a 32-byte memo. The data stays private; anyone we disclose it to can check it against the chain. Exporter and buyer IDs rotate every quarter." |
| 0:50–1:40 | `approve` ×2, `subscribe` 60/40, explorer holders, `closed`, `fund` | "Each financed shipment gets an SPV, and its shares are a Stellar asset only approved holders can hold. Two approved investors subscribe in USDC (test USDC here) and our Soroban offering contract mints their shares automatically, one token per dollar. When it's fully subscribed, it closes and funds the SPV." |
| 1:40–2:05 | `distribute 105000 1`, `redeem` A and B, payouts printed, shares gone | "The buyer pays. Each investor redeems at the deal's fixed 12% APY, so 60,000 becomes 62,367, and the shares are burned. The outcome is attested back to the proof layer." |
| 2:05–2:20 | `demo-failure.ts` output; unapproved `#11` | "If a shipment fails, the insurer pays the SPV, here 90%, and investors share it pro rata. An unapproved wallet can't subscribe at all; the asset itself refuses it." |
| 2:20–2:40 | README "Simulated vs real" table | "On testnet the SPV legal structure, KYB, insurance assignment, customs data and USDC are simulated. SCF funding makes them real: legal structure, audit and multisig first, then pilots with professional investors, a price feed and a Blend listing so these shares can back loans." |

If the Blend stretch shipped, replace 2:05–2:20 with: deposit TM0247 shares in the Blend pool → borrow TUSDC → "mock price feed" label visible.

Recording tips: terminal font ≥ 18 pt, a dark theme, and pre-typed commands in a `demo.sh` you step through. Record each section separately and stitch them. Keep explorer tabs pre-opened.
