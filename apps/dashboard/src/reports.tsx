import { useEffect, useState } from "react";

type Metrics = {
  network: string;
  launch_at: string;
  gate: { met: boolean; largestInstitutionUsd: number; receivablesRepaid: number };
  target: { met: boolean; usdWithin60Days: number; institutionalWallets: number };
};
type ComplianceLog = {
  network: string;
  actions: { shipment_ref: string; action: string; holder: string; reason: string; amount: string | null; tx: string; at: string }[];
};

function useJson<T>(file: string) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    fetch("/" + file)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [file]);
  return data;
}
const usd0 = (n: number) => "$" + n.toLocaleString("en-US");
const Chip = ({ met }: { met: boolean }) => <span className={met ? "chip green" : "chip"}>{met ? "Met" : "Not met"}</span>;

/** SCF #46 Tranche 3: the gate and the 60-day target, reported separately. */
export function PilotMetrics() {
  const m = useJson<Metrics>("metrics.json");
  if (!m) return null;
  return (
    <div className="stack">
      <div className="grid g2">
        <div className="card stack">
          <div className="row between"><h3>T3 gate</h3><Chip met={m.gate.met} /></div>
          <p className="small muted">At least $50,000 from 1 institution, and at least 1 receivable repaid.</p>
          <p className="small">Largest institution: <b>{usd0(m.gate.largestInstitutionUsd)}</b> · Receivables repaid: <b>{m.gate.receivablesRepaid}</b></p>
        </div>
        <div className="card stack">
          <div className="row between"><h3>60-day target</h3><Chip met={m.target.met} /></div>
          <p className="small muted">At least $250,000 in USDC from at least 3 independent institutional wallets within 60 days of mainnet launch.</p>
          <p className="small">Raised in the window: <b>{usd0(m.target.usdWithin60Days)}</b> · Institutional wallets: <b>{m.target.institutionalWallets}</b></p>
        </div>
      </div>
      <p className="tiny muted">
        {m.network === "testnet" ? "Testnet demo runs on Circle testnet USDC, so these numbers are illustrative. " : ""}
        <a href={"/" + "metrics.csv"}>Download CSV</a>
      </p>
    </div>
  );
}

/** Public compliance log: every freeze, unfreeze, revoke and clawback, with its reason code and transaction. */
export function Compliance() {
  const log = useJson<ComplianceLog>("compliance-log.json");
  return (
    <div className="stack-lg">
      <div className="stack" style={{ gap: 6 }}>
        <h1>Compliance log</h1>
        <p className="muted">
          Every freeze, unfreeze, revoke and clawback needs 2 of 3 compliance signers and carries one reason code: SANCTIONS,
          KYB_LAPSE, COURT_ORDER or UNAPPROVED_TRANSFER. Only the wallet address, the reason and the transaction are public.
        </p>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {log && log.actions.length ? (
          <div className="scroll">
            <table className="ops-table">
              <thead><tr><th>When</th><th>Deal</th><th>Action</th><th>Wallet</th><th>Reason</th><th>Transaction</th></tr></thead>
              <tbody>
                {log.actions.map((a) => (
                  <tr key={a.tx}>
                    <td className="small">{a.at.slice(0, 10)}</td>
                    <td>{a.shipment_ref}</td>
                    <td>{a.action}{a.amount ? " " + a.amount : ""}</td>
                    <td className="small">{a.holder.slice(0, 6)}…{a.holder.slice(-4)}</td>
                    <td>{a.reason}</td>
                    <td><a className="small" href={"https://stellar.expert/explorer/testnet/tx/" + a.tx}>{a.tx.slice(0, 8)}…</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted" style={{ padding: 16 }}>No compliance actions recorded{log ? " on " + log.network : ""}.</p>
        )}
      </div>
    </div>
  );
}
