import { randomBytes } from "node:crypto";
import {
  Account,
  Address,
  Asset,
  AuthClawbackEnabledFlag,
  FeeBumpTransaction,
  AuthRequiredFlag,
  AuthRevocableFlag,
  BASE_FEE,
  Keypair,
  Memo,
  Operation,
  Transaction,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
  type AuthFlag,
} from "@stellar/stellar-sdk";
import { PASSPHRASE, RPC_URL } from "./env.js";

let _server: rpc.Server | undefined;
export const server = () => (_server ??= new rpc.Server(RPC_URL()));

export type Submitted = { hash: string; ledger: number; envelopeXdr: string; returnValue?: xdr.ScVal };

async function sendAndPoll(tx: Transaction | FeeBumpTransaction): Promise<Submitted> {
  const sent = await server().sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new Error(`sendTransaction ERROR: ${sent.errorResult?.toXDR("base64") ?? "unknown"}`);
  }
  for (let i = 0; i < 60; i++) {
    const res = await server().getTransaction(sent.hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { hash: sent.hash, ledger: res.ledger, envelopeXdr: tx.toEnvelope().toXDR("base64"), returnValue: res.returnValue };
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

const U32_MAX = 4_294_967_295n;

/**
 * Build, simulate (fills footprint + auth for source-account auth), sign and submit one Soroban op.
 * A classic tx fee is a u32 (~429 XLM). Wasm uploads can need more on testnet, because the fee
 * scales with the module's parsed size. Those go out as a fee bump, whose fee is an i64.
 */
export async function submitSoroban(source: Keypair, op: xdr.Operation): Promise<Submitted> {
  const account = await server().getAccount(source.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE() })
    .addOperation(op)
    .setTimeout(60)
    .build();
  const sim = await server().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  const resourceFee = BigInt(sim.minResourceFee);
  if (resourceFee + BigInt(BASE_FEE) <= U32_MAX) {
    const prepared = rpc.assembleTransaction(tx, sim).build();
    prepared.sign(source);
    return sendAndPoll(prepared);
  }
  if (sim.result?.auth.length) op.body().invokeHostFunctionOp().auth(sim.result.auth);
  // The builder would fold the resource fee into the inner u32 fee, so attach sorobanData at the XDR level.
  const plain = new TransactionBuilder(await server().getAccount(source.publicKey()), {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE(),
  })
    .addOperation(op)
    .setTimeout(60)
    .build();
  const envelope = plain.toEnvelope();
  envelope.v1().tx().ext(new xdr.TransactionExt(1, sim.transactionData.build()));
  const inner = new Transaction(envelope, PASSPHRASE());
  inner.sign(source);
  // Outer fee = baseFee * (ops + 1) and must cover the resource fee plus inclusion.
  const baseFee = ((resourceFee + 2n * BigInt(BASE_FEE)) / 2n + 1n).toString();
  const bump = TransactionBuilder.buildFeeBumpTransaction(source, baseFee, inner, PASSPHRASE());
  bump.sign(source);
  return sendAndPoll(bump);
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

/** Trustline state for (account, asset), or null when no trustline exists. Balance in base units (7 decimals). */
export async function trustline(address: string, asset: Asset): Promise<{ balance: bigint; authorized: boolean } | null> {
  const key = xdr.LedgerKey.trustline(
    new xdr.LedgerKeyTrustLine({
      accountId: Keypair.fromPublicKey(address).xdrAccountId(),
      asset: asset.toTrustLineXDRObject(),
    }),
  );
  const res = await server().getLedgerEntries(key);
  const tl = res.entries[0]?.val.trustLine();
  if (!tl) return null;
  return { balance: BigInt(tl.balance().toString()), authorized: (tl.flags() & 1) !== 0 };
}

/** Upload a wasm and create a contract instance with constructor args. Returns the new contract ID. */
export async function deployContract(
  source: Keypair,
  wasm: Buffer,
  constructorArgs: xdr.ScVal[] = [],
): Promise<{ contractId: string; wasmHash: string; tx: Submitted }> {
  const upload = await submitSoroban(source, Operation.uploadContractWasm({ wasm }));
  const wasmHash = Buffer.from(upload.returnValue!.bytes());
  const tx = await submitSoroban(
    source,
    Operation.createCustomContract({
      address: new Address(source.publicKey()),
      wasmHash,
      constructorArgs,
      salt: randomBytes(32),
    }),
  );
  return { contractId: Address.fromScVal(tx.returnValue!).toString(), wasmHash: wasmHash.toString("hex"), tx };
}

/** Invoke a contract function; the source account signs and covers any source-account auth. */
export const invoke = (source: Keypair, contractId: string, fn: string, args: xdr.ScVal[] = []) =>
  submitSoroban(source, Operation.invokeContractFunction({ contract: contractId, function: fn, args }));

/** Read-only call via simulation. */
export async function view(contractId: string, fn: string, args: xdr.ScVal[] = []): Promise<unknown> {
  const src = await server().getAccount(Keypair.random().publicKey()).catch(() => null);
  const account = src ?? new Account(Keypair.random().publicKey(), "0");
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE() })
    .addOperation(Operation.invokeContractFunction({ contract: contractId, function: fn, args }))
    .setTimeout(30)
    .build();
  const sim = await server().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return sim.result ? scValToNative(sim.result.retval) : undefined;
}
