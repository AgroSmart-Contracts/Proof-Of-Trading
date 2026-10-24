import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, SampleShipment } from "@pot/core";

const raw = JSON.parse(readFileSync(path.join(REPO_ROOT, "data/samples/shipments.json"), "utf8"));
let bad = 0;
for (const s of raw.shipments) {
  const r = SampleShipment.safeParse(s);
  if (!r.success) {
    bad++;
    console.log(`INVALID ${s.shipment_ref}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  } else if (!r.data.consented) {
    console.log(`SKIP    ${r.data.shipment_ref}: not consented (will never be attested)`);
  } else {
    console.log(`OK      ${r.data.shipment_ref} ${r.data.financed ? "financed" : "unfinanced"} [${r.data.data_basis}]`);
  }
}
const ok = raw.shipments.length - bad;
console.log(`\n${ok}/${raw.shipments.length} valid`);
process.exit(bad ? 1 : 0);
