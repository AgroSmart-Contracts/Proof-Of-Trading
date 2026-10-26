# Spike report: SAC admin handover and authorization

**Decision: GO (contract-minted shares).** The v0.2 offering contract will be the SAC admin of each share asset and mint/burn shares itself.

Run: Sat Oct 24, 2026, Stellar testnet, `scripts/spike.ts` (results in `data/store/spike.json`, gitignored).

## Versions
| Tool | Version |
|---|---|
| Stellar CLI | 28.1.0 |
| soroban-sdk | 28.0.0 |
| Rust | 1.99.1, target `wasm32v1-none` |
| @stellar/stellar-sdk (JS) | 14.6.1 |

## Setup
- Throwaway issuer `GCKEQM3ULIAWQB5LJDG4AFKIVPK5NWWQRYNKXZ6CGJ3GXRVDBMG2PWGL` (not the real `issuer`), asset `SPIKE01`
- SPIKE01 SAC `CCTLVNQJZY65YDN5N5NCA3D7JKF6CYZSUPITNY4MVPBPYQE27WUTT2FI`
- Spike contract `CCVDLSWF4A2OXWNLZZUE6PAN2IEWQASF7VQ7F5DKFIJAVL6R6OREV5QQ` (`contracts/share-admin-spike`)

## Steps
| # | Step | Result | Tx |
|---|---|---|---|
| 0a | Issuer flags AUTH_REQUIRED, AUTH_REVOCABLE, AUTH_CLAWBACK_ENABLED (before any trustline) | OK | `1391c32a…620d` |
| 0b | Deploy SPIKE01 SAC | OK | `0e47ff51…7160` |
| 0c | Deploy spike contract (constructor admin = throwaway issuer) | OK | `c80f2b2d…6a03` |
| 1 | Issuer: SAC `set_admin(spike contract)` | OK | `752d3682…8c01` |
| 2 | investor_a trustline to SPIKE01 | OK | `0eba84c0…9b15` |
| 3 | `approve(investor_a)` → SAC `set_authorized(true)` | OK | `dcfd0ff8…7a5f` |
| 4 | `mint(investor_a, 100)` | OK | `f01d196e…8b50` |
| 5a | unapproved trustline to SPIKE01 (not authorized) | OK | `ca02284c…a052` |
| 5b | `mint(unapproved, 100)` | **Failed as required**: `HostError: Error(Contract, #11)` = SAC `BalanceDeauthorizedError` (fails in simulation, never submitted) | n/a |
| 6 | investor_a `burn_from_holder(10)` | OK; balance 90 | `2f4634f8…e9d7` |
| 7 | `hand_over(issuer)` → SAC `set_admin(issuer)` | OK; admin back to issuer | `5b68a579…853b` |

Full hashes: `https://stellar.expert/explorer/testnet/tx/<hash>`; complete values in `data/store/spike.json`.

The same chain runs in the sandbox (`cargo test` in `contracts/`). The unapproved-mint test was checked against a sabotaged version (authorizing the wallet makes it fail), so it is not passing by accident.

## Notes and surprises
- **Auth was easy when each signer is the transaction source.** Admin-gated calls (`approve`, `mint`, `hand_over`) and the holder-gated `burn_from_holder` all used source-account auth, so `prepareTransaction` simulation filled the auth tree with no manual auth-entry signing. **For v0.2:** `subscribe`, `redeem` and `refund` are submitted by the investor (source = investor), so the same simple path works. Admin-only calls are submitted by the issuer/ops account.
- The SAC's inner `mint`/`set_authorized` calls need the SAC admin's auth. When the admin is the calling contract, that auth is implicit (direct caller), so no extra signatures are needed.
- An unauthorized trustline makes `mint` fail with `#11`. This is exactly the "unapproved wallet cannot subscribe" demo.
- Holders need a trustline before any mint (classic asset rule). v0.2 `trustlines.ts` must run before `approve`.
- Fees: every Soroban tx cost well under 1 XLM on testnet. Friendbot balances are ample.

## OpenZeppelin Stellar contracts check (input for Sunday)
Checked `OpenZeppelin/stellar-contracts` (crates pinned at `=0.8.0` in the README install section) and its docs.
- **Vault (`stellar-tokens` vault, ERC-4626):** share price = assets/supply, which floats with the vault's assets. It has an optional `Capped` extension, but no deadline, refund, fixed term or fixed-APY payout, and the share is a custom contract token, not a SAC. **Does not fit.**
- **RWA (`stellar-tokens` RWA, T-REX / ERC-3643):** custom token plus separate identity-verifier and compliance contracts. It has freezing, forced transfers and recovery, but no offering, subscription, distribution or redemption logic. It also replaces the classic-asset model (native auth flags, clawback, SAC composability with Blend). **Does not fit for the event**; worth discussing with SDF mentors as an SCF-phase alternative if counsel needs ERC-3643-style identity claims.
- **Conclusion:** write the small custom offering contract (brief 2, section 2). `stellar-access` (Ownable/roles) is optional; a stored admin address is enough for the demo.
