import {
  Asset,
  AuthClawbackEnabledFlag,
  AuthRequiredFlag,
  AuthRevocableFlag,
  BASE_FEE,
  Keypair,
  Memo,
  Operation,
  Transaction,
  TransactionBuilder,
  rpc,
  xdr,
  type AuthFlag,
} from "@stellar/stellar-sdk";
import { PASSPHRASE, RPC_URL } from "./env.js";

let _server: rpc.Server | undefined;
export const server = () => (_server ??= new rpc.Server(RPC_URL()));

export type Submitted = { hash: string; ledger: number; envelopeXdr: string };

async function sendAndPoll(tx: Transaction): Promise<Submitted> {
  const sent = await server().sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new Error(`sendTransaction ERROR: ${sent.errorResult?.toXDR("base64") ?? "unknown"}`);
  }
  for (let i = 0; i < 60; i++) {
    const res = await server().getTransaction(sent.hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { hash: sent.hash, ledger: res.ledger, envelopeXdr: tx.toEnvelope().toXDR("base64") };
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`transaction ${sent.hash} FAILED: ${res.resultXdr?.toXDR("base64")}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`transaction ${sent.hash} not confirmed after 60s`);
}

/** Build, sign and submit a classic transaction. `signers` defaults to the source. */
export async function submitClassic(
  source: Keypair,
  ops: xdr.Operation[],
  opts: { memo?: Memo; signers?: Keypair[] } = {},
): Promise<Submitted> {
  const account = await server().getAccount(source.publicKey());
  const b = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE() }).setTimeout(60);
  ops.forEach((op) => b.addOperation(op));
  if (opts.memo) b.addMemo(opts.memo);
  const tx = b.build();
  tx.sign(...(opts.signers ?? [source]));
  return sendAndPoll(tx);
}

/** Build, simulate (fills footprint + auth for source-account auth), sign and submit one Soroban op. */
export async function submitSoroban(source: Keypair, op: xdr.Operation): Promise<Submitted> {
  const account = await server().getAccount(source.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE() })
    .addOperation(op)
    .setTimeout(60)
    .build();
  const prepared = await server().prepareTransaction(tx);
  prepared.sign(source);
  return sendAndPoll(prepared);
}

export const deriveSacId = (code: string, issuer: string): string =>
  new Asset(code, issuer).contractId(PASSPHRASE());

export async function contractExists(contractId: string): Promise<boolean> {
  try {
    await server().getContractData(contractId, xdr.ScVal.scvLedgerKeyContractInstance(), rpc.Durability.Persistent);
    return true;
  } catch {
    return false;
  }
}

/** Deploy the Stellar Asset Contract for a classic asset. Idempotent. */
export async function deploySac(asset: Asset, payer: Keypair): Promise<{ sacId: string; tx?: Submitted }> {
  const sacId = asset.contractId(PASSPHRASE());
  if (await contractExists(sacId)) return { sacId };
  const tx = await submitSoroban(payer, Operation.createStellarAssetContract({ asset }));
  return { sacId, tx };
}

const SHARE_FLAGS = (AuthRequiredFlag | AuthRevocableFlag | AuthClawbackEnabledFlag) as AuthFlag;

/** AUTH_REQUIRED + AUTH_REVOCABLE + AUTH_CLAWBACK_ENABLED. Must run before any trustline exists. */
export async function setIssuerFlags(issuer: Keypair): Promise<Submitted | undefined> {
  const acct = await accountFlags(issuer.publicKey());
  if (acct.auth_required && acct.auth_revocable && acct.auth_clawback_enabled) return undefined;
  return submitClassic(issuer, [Operation.setOptions({ setFlags: SHARE_FLAGS })]);
}

export async function accountFlags(address: string) {
  const entry = await server().getLedgerEntries(
    xdr.LedgerKey.account(new xdr.LedgerKeyAccount({ accountId: Keypair.fromPublicKey(address).xdrAccountId() })),
  );
  const flags = entry.entries[0]?.val.account().flags() ?? 0;
  return {
    auth_required: (flags & AuthRequiredFlag) !== 0,
    auth_revocable: (flags & AuthRevocableFlag) !== 0,
    auth_clawback_enabled: (flags & AuthClawbackEnabledFlag) !== 0,
  };
}

export async function accountExists(address: string): Promise<boolean> {
  try {
    await server().getAccount(address);
    return true;
  } catch {
    return false;
  }
}

export async function friendbot(address: string): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`);
  if (!res.ok && !(await accountExists(address))) throw new Error(`friendbot failed for ${address}: ${res.status}`);
}

/** Decode the MEMO_HASH of a base64 transaction envelope, as lowercase hex (or null). */
export function memoHashFromEnvelope(envelopeXdr: string): string | null {
  const tx = TransactionBuilder.fromXDR(envelopeXdr, PASSPHRASE()) as Transaction;
  if (tx.memo.type !== "hash" || !tx.memo.value) return null;
  return Buffer.from(tx.memo.value as Buffer).toString("hex");
}
