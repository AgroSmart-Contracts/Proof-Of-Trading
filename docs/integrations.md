# Integrations (design)

The pilot uses five building blocks: **Stellar Wallets Kit, Freighter Connect, Privy, Bridge and Koywe**. Circle USDC on Stellar is the USD rail between them; nothing is bridged from another chain. Wallets are Tranche 1; Bridge and Koywe are Tranche 2. None of them is integrated yet.

Contract calls named here are from [pool-contract-v1.md](pool-contract-v1.md). The flow end to end: [money flow](figures/money-flow.svg).

| Building block | Role | Tranche |
|---|---|---|
| Stellar Wallets Kit | One wallet picker and signing interface for the investor app | 1 |
| Freighter Connect | Browser wallet for investors who hold their own keys | 1 |
| Privy | Embedded wallets for investor staff who don't run a Stellar wallet | 1 |
| Bridge | Buyer's USD in, as USDC on Stellar | 2 |
| Koywe | Exporter payouts: USDC to PEN or CLP | 2 |

## Stellar Wallets Kit

- **Role.** The investor interface talks to every wallet through one kit, so adding a wallet doesn't change the app.
- **Flow.** Connect → read the address → check the pool-share trustline and its authorization (KYB) → build `subscribe` or `redeem` → the kit asks the chosen wallet to sign → submit through Stellar RPC.
- **SDK.** `@creit.tech/stellar-wallets-kit`, with `@stellar/stellar-sdk` for building and simulating transactions.
- **Signing.** The investor signs their own `subscribe` and `redeem` calls (the contract calls `require_auth` on the investor). The app never holds investor keys.
- **Webhook.** None; the app reads results from RPC.
- **Reconciliation.** The app shows the transaction hash and the contract event (`subscribed`, `redeemed`); the indexer stores both against the investor's account.

## Freighter Connect

- **Role.** The default self-custody wallet, offered through the Wallets Kit.
- **Flow.** Same as above. On first use, the investor opens a trustline to the pool share; TruMarket then authorizes it after KYB.
- **SDK.** `@stellar/freighter-api`, used through the Wallets Kit module.
- **Signing.** In Freighter, by the investor. Network passphrase checked before signing, so a testnet transaction can't be signed for mainnet or the reverse.
- **Webhook.** None.
- **Reconciliation.** As for the Wallets Kit.

## Privy

- **Role.** Embedded wallets for investor staff who don't run a Stellar wallet: login by email, key managed by Privy.
- **Flow.** Login → Privy creates the Stellar wallet → TruMarket **sponsors the reserves** for the account and its pool-share trustline (sponsored reserves, so the investor needs no XLM) → KYB → subscribe.
- **SDK.** Privy's React SDK for login and the embedded wallet; transactions built with `@stellar/stellar-sdk`.
- **Signing.** The investor's embedded wallet signs the inner transaction; TruMarket wraps it in a **fee-bump** and pays the fee. The fee-bump can't change what the investor signed.
- **Webhook.** Privy user events (wallet created) start the KYB case.
- **Reconciliation.** Each sponsorship and fee-bump is logged with the investor, the inner and outer hashes, and the XLM spent, so sponsorship costs are reported per investor.

## Bridge

- **Role.** Collects the buyer's payment: USD in, USDC on Stellar out, into the collection account.
- **Flow.** One **USD virtual account per buyer** → the buyer pays the invoice by bank transfer → Bridge converts to USDC and sends it to the collection account with a memo → TruMarket matches the memo to the receivable → `settle(key, amount)`.
- **API.** Bridge API: customers, virtual accounts, transfers and webhooks.
- **Signing.** Bridge signs its Stellar payment. `settle` is an admin call: the webhook handler builds it, and it is submitted once 2 of 3 signers approve.
- **Webhook.** Bridge's deposit webhook, checked with its **HMAC** signature before anything is done. The handler then builds the `settle()` call for the matched receivable. A replayed or unsigned webhook is rejected.
- **Reconciliation.** Each deposit is matched three ways: the buyer's virtual account, the memo (receivable key), and the USDC amount received on Stellar. A deposit that doesn't match all three is held for review, not settled.

## Koywe

- **Role.** Pays exporters in local currency: USDC to PEN (Peru) or CLP (Chile).
- **Flow.** `release(key)` sends 90% of face in USDC to the payout account → **quote** (rate and amount in PEN or CLP) → **payout** order to the exporter's bank account → **webhook** when the bank transfer completes.
- **API.** Koywe API: quotes, orders and webhooks.
- **Signing.** `release` is signed by 2 of 3 admin signers. The payout account sends USDC to Koywe for the order.
- **Webhook.** Koywe's order status webhook (completed or failed), verified before use. A failed payout is retried or returned to the pool; it is never left unrecorded.
- **Reconciliation.** Each payout is tied to the `release` transaction on Stellar, the Koywe order ID and quote, and the exporter's bank reference, so every PEN or CLP payment traces back to one attested receivable.

## Fallbacks

- **Sandbox access delayed.** Build against a **recorded mock** of the partner's published API (the same requests, responses and webhook payloads), and switch to the sandbox when access arrives. The mock is labelled as a mock in the app and in reports.
- **Production access late.** Settle on mainnet over the **Circle USDC rail** directly: buyers and exporters use USDC, and the pool contract works unchanged. Bridge and Koywe are added when production access is granted.
