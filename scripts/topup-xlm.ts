// Testnet rent is expensive. Tops up an account with XLM by friendbot-funding throwaway accounts
// and merging them into it (~10,000 XLM each). Usage: npm run topup -- [role=issuer] [count=1]
import { Keypair, Operation, xdr } from "@stellar/stellar-sdk";
import { friendbot, server, submitClassic } from "@pot/core";
import { kp } from "./lib.js";

const [roleName = "issuer", countArg = "1"] = process.argv.slice(2);
const target = kp(roleName).publicKey();
const xlm = async () => {
  const key = xdr.LedgerKey.account(new xdr.LedgerKeyAccount({ accountId: Keypair.fromPublicKey(target).xdrAccountId() }));
  return Number((await server().getLedgerEntries(key)).entries[0].val.account().balance().toString()) / 1e7;
};
console.log(`${roleName} before: ${await xlm()} XLM`);
for (let i = 0; i < Number(countArg); i++) {
  const tmp = Keypair.random();
  await friendbot(tmp.publicKey());
  await submitClassic(tmp, [Operation.accountMerge({ destination: target })]);
}
console.log(`${roleName} after:  ${await xlm()} XLM`);
