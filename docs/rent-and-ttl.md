# Rent and TTL

Soroban storage is rented. Every persistent entry has a time to live (TTL) in ledgers; when it runs out the entry is **archived**. It still exists and can be read in simulation, but it must be restored (a `RestoreFootprint` transaction) before a transaction can use it again. Anyone can pay to extend or restore any entry; no contract authorization is needed.

## What the offering contract stores

| Entry | Size (measured) | One per |
|---|---|---|
| Contract WASM | 18,828 bytes | contract (shared by every offering) |
| Contract instance (admin, recorder, settlement token) | 220 bytes | contract |
| `Offering(id)` | 956 bytes | offering |
| `Redeemed(id, investor)` | ~200 bytes | investor who redeemed |
| `Record(id)` (v0.3 outcome record) | ~150 bytes | offering |
| Share asset SAC instance | ~500 bytes | offering |

The contract tops each entry up to ~7 days (`TTL_EXTEND = 120_960` ledgers) when it is touched and has under ~1 day left. That keeps an active offering alive, but an idle one archives after a week. Funding to maturity is 90 to 120 days, so production needs a keeper.

### State of the v0.2 deployment (checked 5 Nov 2026)

The v0.2 contract's instance, WASM, offerings and the share SAC instances were last written on 25 Oct and are now **archived**. They still exist and still read correctly in simulation (`npm run verify` reads the offerings' proof hashes from them), but the next transaction that uses the contract restores them first. Simulated restore cost: **1.58 XLM** for the contract instance and WASM, **0.02 XLM** per offering.

## Cost estimates

Measured on testnet on 5 Nov 2026 by simulating an extension of a live persistent entry: **about 0.0015 XLM per KB per day** of TTL added. Rent depends on how full the network's state is, so this moves; during the hackathon (25 Oct), testnet state was above its target size and extending one offering record to ~120 days was quoted at **~10,000 XLM**. Re-measure before relying on a figure: `npm run ttl:keeper -- --days 120` prints the simulated cost for the current deployment.

| Item | Size | 120 days at 0.0015 XLM/KB/day |
|---|---|---|
| Contract (WASM + instance), once | ~19 KB | ~3.4 XLM |
| One offering (`Offering`, `Record`, two `Redeemed`, share SAC instance) | ~2 KB | ~0.36 XLM |
| 20 offerings a year, each kept 120 days, plus the contract all year | | ~7 XLM + ~10 XLM |

On mainnet the same formula applies with mainnet's rent parameters; measure there the same way before launch.

## The keeper

[`scripts/ttl-keeper.ts`](../scripts/ttl-keeper.ts) (`npm run ttl:keeper`):

- lists, per offering, the contract instance and WASM, `Offering(id)`, `Record(id)` (v0.3), `Redeemed(id, investor)` and the share SAC instance, each with its state: live (days left), archived or missing;
- **by default only simulates** and prints the restore and extension cost;
- with `--submit`, restores archived entries and extends everything to `--days` (default 120), paying from the issuer account.

```sh
npm run ttl:keeper -- --days 120                 # dry run: states and simulated cost
npm run ttl:keeper -- --days 120 --ref SHP-0247  # one offering
npm run ttl:keeper -- --days 120 --submit        # restore + extend, pays rent
```

Suggested schedule: daily from cron, extending each live offering to its maturity date plus a margin.

```cron
0 6 * * *  cd /srv/proof-of-trading && npx tsx scripts/ttl-keeper.ts --days 120 --submit >> /var/log/pot-ttl.log 2>&1
```

In the TruMarket integration this becomes a job in the API's `stellar` module, alerting when any entry drops under 14 days.

## Policy

1. Extend an offering's entries to at least its maturity date plus 30 days when it is funded.
2. Keep the contract instance and WASM extended for as long as any offering is open or unredeemed.
3. After every share is redeemed and the outcome is recorded, entries may archive. They stay restorable and the outcome stays readable, and the attestation transactions remain on the ledger.
