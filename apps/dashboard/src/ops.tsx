import { useState } from "react";
import { useApp } from "./ctx";
import { COMMODITY, OUTCOMES, isApproved, money, num, offeringFor, outcomeAttested, offeringStatus, units, usd, type Deal } from "./lib";

function DealOps({ d }: { d: Deal }) {
  const { store, interactive, busy, run } = useApp();
  const o = offeringFor(store, d.shipment_ref);
  const c = o?.on_chain;
  const ref = d.shipment_ref;
  const [deadline, setDeadline] = useState("120");
  const [paid, setPaid] = useState(String(Math.ceil(d.face_value_usd * 1.05)));
  const [insured, setInsured] = useState(String(Math.round(d.face_value_usd * 0.9)));
  const off = !interactive || busy;
  const [label, tone] = offeringStatus(o);
  const deadlinePassed = c ? Date.now() / 1000 > Number(c.p.deadline) : false;
  const allRedeemed = c ? c.redeemed_shares === c.shares_at_close && c.shares_at_close !== "0" : false;
  const surplus = c ? BigInt(c.total_collected) - BigInt(c.paid_out) : 0n;

  let next: React.ReactNode = null;
  if (!o || !c)
    next = (
      <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
        <button disabled={off} onClick={() => run(`Open offering ${ref}`, { action: "create", ref, deadlineMins: deadline })}>Open offering</button>
        <span className="small muted">for</span>
        <input type="number" min={2} value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mini" aria-label="Subscription window in minutes" />
        <span className="small muted">min</span>
      </div>
    );
  else if (c.status === "Open")
    next = (
      <div className="row">
        {(["A", "B"] as const).map((p) =>
          isApproved(o, p)
            ? <span key={p} className="chip green">Investor {p} approved</span>
            : <button key={p} className="secondary" disabled={off} onClick={() => run(`KYB approval: Investor ${p} on ${ref}`, { action: "approve", ref, who: p.toLowerCase() })}>Approve investor {p}</button>,
        )}
        {deadlinePassed && <button className="danger" disabled={off} onClick={() => run(`Start refunds ${ref}`, { action: "start-refunds", ref })}>Start refunds</button>}
        {!deadlinePassed && <span className="small muted">Waiting for subscriptions</span>}
      </div>
    );
  else if (c.status === "Closed")
    next = <button disabled={off} onClick={() => run(`Fund SPV ${ref}`, { action: "fund", ref })}>Send {usd(c.sold_shares, 0)} escrow to SPV treasury</button>;
  else if (c.status === "Funded")
    next = (
      <div className="stack" style={{ gap: 8 }}>
        <div className="row">
          <input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} className="money-in" aria-label="Buyer payment" />
          <button disabled={off} onClick={() => run(`Buyer pays ${ref}`, { action: "distribute", ref, usd: paid, outcome: "1" })}>Buyer paid (on time)</button>
        </div>
        <div className="row">
          <input type="number" value={insured} onChange={(e) => setInsured(e.target.value)} className="money-in" aria-label="Insurance payout" />
          <button className="gold" disabled={off} onClick={() => run(`Insurer pays ${ref}`, { action: "distribute", ref, usd: insured, outcome: "4" })}>Shipment failed: insurer paid</button>
        </div>
        <span className="tiny muted">Owed to investors at APY: {usd(c.owed)}</span>
      </div>
    );
  else if (c.status === "Distributing" && !(allRedeemed && surplus === 0n && outcomeAttested(store, ref)))
    next = (
      <div className="row">
        {!allRedeemed && <span className="small muted">Waiting for investors to redeem ({num(c.redeemed_shares)} / {num(c.shares_at_close)} shares)</span>}
        {allRedeemed && surplus > 0n && <button className="secondary" disabled={off} onClick={() => run(`Sweep surplus ${ref}`, { action: "sweep", ref })}>Return {usd(surplus.toString())} surplus to SPV</button>}
        {allRedeemed && !outcomeAttested(store, ref) && <button disabled={off} onClick={() => run(`Record outcome ${ref}`, { action: "attest-outcome", ref })}>Record outcome on Stellar</button>}
      </div>
    );
  else if (c.status === "Refunding" && o.tokens?.outstanding !== "0") next = <span className="small muted">Waiting for investors to claim refunds</span>;

  return (
    <tr>
      <td>
        <a href={`#/deal/${ref}`}><b>{ref}</b></a>
        <div className="tiny muted">{COMMODITY[d.commodity]} → {d.destination_region} · {money(d.face_value_usd, 0)} · {(d.apy_bps / 100).toFixed(1)}% · {d.term_days} d</div>
      </td>
      <td><span className={`chip ${tone}`}>{label}</span></td>
      <td className="small num">
        {o?.tokens ? `${num(o.tokens.minted)} / ${num(o.tokens.outstanding)} / ${num(o.tokens.burned)}` : "–"}
      </td>
      <td className="small num">{c && c.total_collected !== "0" ? <>{usd(c.total_collected)}<div className="tiny muted">{OUTCOMES[String(c.outcome_code)]}</div></> : "–"}</td>
      <td style={{ whiteSpace: "normal", minWidth: 300 }}>{next ?? <span className="muted">–</span>}</td>
    </tr>
  );
}

export function Ops() {
  const { store } = useApp();
  const t = store.accounts.treasury;
  return (
    <div className="stack-lg">
      <div className="stack" style={{ gap: 6 }}>
        <h1>SPV operations</h1>
        <p className="muted">Run each deal's SPV, step by step. Every button signs a real testnet transaction.</p>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="v">{money(units(t.tusdc))}</div><div className="l">SPV treasury (TUSDC)</div></div>
        <div className="kpi"><div className="v">{store.deals.filter((d) => d.has_offering).length}</div><div className="l">Offerings opened</div></div>
        <div className="kpi"><div className="v">{store.attestations.filter((a) => a.event !== "outcome").length}</div><div className="l">Verifiable shipments</div></div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="scroll">
          <table className="ops-table">
            <thead><tr><th>Deal</th><th>Status</th><th>Shares issued / held / cancelled</th><th>Collected</th><th>Next action</th></tr></thead>
            <tbody>{store.deals.filter((d) => !d.stuck).map((d) => <DealOps key={d.shipment_ref} d={d} />)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
