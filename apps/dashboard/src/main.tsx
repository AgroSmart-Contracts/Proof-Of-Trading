import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Att = {
  shipment_ref: string;
  event: string;
  payload: Record<string, any>;
  proof_hash: string;
  tx_hash: string;
  ledger: number;
  arc_stub: boolean;
  created_at: string;
  verified: boolean;
};
type Share = { shipment_ref: string; code: string; issuer: string; sac_id: string; proof_hash: string; attestation_tx: string };
type Store = { attestations: Att[]; shares: Share[]; tusdc: { code: string; issuer: string; sac_id: string } | null; spike_decision: string | null };

const X = "https://stellar.expert/explorer/testnet";
const short = (s: string, n = 8) => (s.length > n * 2 ? `${s.slice(0, n)}…${s.slice(-4)}` : s);
const useHash = () => {
  const [h, setH] = useState(location.hash);
  useEffect(() => {
    const f = () => setH(location.hash);
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  return h;
};

function Shipments({ store }: { store: Store }) {
  return (
    <>
      <h2>Attested shipments</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Ref</th><th>Financed</th><th>Epoch</th><th>Exporter</th><th>Buyer</th><th>Proof hash</th><th>Tx</th><th>Check</th>
            </tr>
          </thead>
          <tbody>
            {store.attestations.map((a) => (
              <tr key={a.tx_hash}>
                <td><a href={`#/shipment/${a.shipment_ref}`}>{a.shipment_ref}</a></td>
                <td>{a.event === "financed_attested" ? <span className="tag gold">financed</span> : <span className="tag">no</span>}</td>
                <td>{a.payload.epoch}</td>
                <td className="mono">{short(a.payload.exporter_pseudonym, 6)}</td>
                <td className="mono">{short(a.payload.buyer_pseudonym, 6)}</td>
                <td className="mono">{short(a.proof_hash)}</td>
                <td><a href={`${X}/tx/${a.tx_hash}`} target="_blank" rel="noreferrer" className="mono">{short(a.tx_hash, 6)}</a></td>
                <td>{a.verified ? <span className="ok">PASS</span> : <span className="bad">FAIL</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>SPV share assets</h2>
      <div className="scroll">
        <table>
          <thead><tr><th>Asset</th><th>Shipment</th><th>SAC contract</th><th>Linked proof</th></tr></thead>
          <tbody>
            {store.shares.map((s) => (
              <tr key={s.code}>
                <td><a href={`${X}/asset/${s.code}-${s.issuer}`} target="_blank" rel="noreferrer">{s.code}</a></td>
                <td><a href={`#/shipment/${s.shipment_ref}`}>{s.shipment_ref}</a></td>
                <td><a href={`${X}/contract/${s.sac_id}`} target="_blank" rel="noreferrer" className="mono">{short(s.sac_id)}</a></td>
                <td className="mono">{short(s.proof_hash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {store.tusdc && (
        <p className="muted">
          Settlement asset: <a href={`${X}/asset/TUSDC-${store.tusdc.issuer}`} target="_blank" rel="noreferrer">TUSDC</a> (test USDC
          issued by us on testnet, not Circle USDC).
        </p>
      )}
    </>
  );
}

function Detail({ store, ref_ }: { store: Store; ref_: string }) {
  const atts = store.attestations.filter((a) => a.shipment_ref === ref_);
  const share = store.shares.find((s) => s.shipment_ref === ref_);
  if (!atts.length) return <p>Unknown or unattested shipment. <a href="#/">Back</a></p>;
  return (
    <>
      <p><a href="#/">← All shipments</a></p>
      <h2>{ref_}</h2>
      {atts.map((a) => (
        <section key={a.tx_hash} className="card">
          <h3>{a.event} {a.verified ? <span className="ok">PASS</span> : <span className="bad">FAIL</span>}</h3>
          <dl>
            <dt>Proof hash</dt><dd className="mono">{a.proof_hash}</dd>
            <dt>Transaction</dt><dd><a href={`${X}/tx/${a.tx_hash}`} target="_blank" rel="noreferrer" className="mono">{a.tx_hash}</a> (ledger {a.ledger})</dd>
            {a.arc_stub && <><dt>Arc deal</dt><dd><span className="tag">stub</span> Arc deal data is stubbed in this demo</dd></>}
          </dl>
          <p className="muted">Public payload (the salt and raw customs file stay with TruMarket):</p>
          <pre>{JSON.stringify(a.payload, null, 2)}</pre>
        </section>
      ))}
      {share && (
        <section className="card">
          <h3>SPV share asset</h3>
          <dl>
            <dt>Asset</dt><dd><a href={`${X}/asset/${share.code}-${share.issuer}`} target="_blank" rel="noreferrer">{share.code}</a> (AUTH_REQUIRED, REVOCABLE, CLAWBACK)</dd>
            <dt>SAC contract</dt><dd><a href={`${X}/contract/${share.sac_id}`} target="_blank" rel="noreferrer" className="mono">{share.sac_id}</a></dd>
            <dt>Issuer</dt><dd className="mono">{share.issuer}</dd>
          </dl>
        </section>
      )}
    </>
  );
}

function App() {
  const [store, setStore] = useState<Store | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const hash = useHash();
  useEffect(() => {
    fetch("/public-store.json").then((r) => r.json()).then(setStore).catch((e) => setErr(String(e)));
  }, []);
  const m = hash.match(/^#\/shipment\/(SHP-\d{4})$/);
  return (
    <>
      <header>
        <div className="wrap">
          <h1>Proof of <span>Trading</span></h1>
          <p className="banner">Testnet demo. Sample data is synthetic or authorized. Raw customs data never leaves TruMarket.</p>
        </div>
      </header>
      <main className="wrap">
        {err && <p className="bad">Could not load store: {err}. Run <code>npm run export</code>.</p>}
        {store && (m ? <Detail store={store} ref_={m[1]} /> : <Shipments store={store} />)}
      </main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
