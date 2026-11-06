import { Asset } from "@stellar/stellar-sdk";
import { PASSPHRASE, optionalEnv } from "./env.js";

/**
 * Circle's USDC on Stellar testnet (issuer home domain centre.io). Its Stellar Asset Contract on
 * testnet is CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA. Test funds come from
 * https://faucet.circle.com (Stellar testnet); nobody else can mint it.
 */
export const CIRCLE_TESTNET_USDC = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
} as const;

export type SettlementAsset = { code: string; issuer: string; sac_id: string };

/**
 * The asset offerings settle in, set by SETTLEMENT_ASSET="CODE:ISSUER" (default: Circle testnet
 * USDC). The offering contract pins it at deploy time, so changing the variable later only
 * affects a new deployment. TUSDC (our own test asset) is kept for the v0.2 record only.
 */
export function settlementAsset(): SettlementAsset {
  const raw = optionalEnv("SETTLEMENT_ASSET");
  const [code, issuer] = raw ? raw.split(":") : [CIRCLE_TESTNET_USDC.code, CIRCLE_TESTNET_USDC.issuer];
  if (!code || !issuer) throw new Error(`SETTLEMENT_ASSET must be CODE:ISSUER, got "${raw}"`);
  return { code, issuer, sac_id: new Asset(code, issuer).contractId(PASSPHRASE()) };
}
