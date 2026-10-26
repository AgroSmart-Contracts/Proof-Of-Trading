import { useState } from "react";
import { useApp } from "./ctx";
import { Badge, ProgressBar } from "./ui";
import {
  COMMODITY, CRAM, OUTCOMES, amount, PERSONAS, REGION, X, accruedValue, date, dateS, dealFor, isApproved, memoHashOf, money, num,
  offeringFor, previewPayout, sha256Hex, short, offeringStatus, stepLabel, units, usd, who,
  type Deal, type Doc, type Offering, type Persona, type Store,
} from "./lib";

// ---------- shared pieces ----------

export function Tx({ hash, label }: { hash: string; label?: string }) {
  return (
    <a href={`${X}/tx/${hash}`} target="_blank" rel="noreferrer" className="mono">
      {label ?? short(hash, 8)}
    </a>
  );
}

/** Checks, in the browser, that a document's sha256 matches the hash anchored in a transaction memo on Stellar. */
export function VerifyOnChain({ tx, expected, text, label = "Verify on Stellar" }: { tx: string; expected: string; text?: string | null; label?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [lines, setLines] = useState<{ ok: boolean; msg: string }[]>([]);
  const check = async () => {
    setState("busy");
    const out: { ok: boolean; msg: string }[] = [];
    if (text) {
      const h = await sha256Hex(text);
      out.push({ ok: h === expected, msg: h === expected ? "This document is unchanged: its fingerprint matches the record" : "This document has been changed since it was recorded" });
    }
    try {
      const r = await memoHashOf(tx);
      if (r.memo) out.push({ ok: r.memo === expected, msg: r.memo === expected ? `The Stellar network holds the same fingerprint (block ${r.ledger}), read directly, not via TruMarket` : "The fingerprint on Stellar doesn't match" });
      else out.push({ ok: false, msg: `Couldn't read it from Stellar right now: ${r.note}` });
    } catch (e) {
      out.push({ ok: false, msg: `Couldn't reach the Stellar network: ${String(e)}` });
    }
    setLines(out);
    setState("done");
  };
  return (
    <div className="stack" style={{ gap: 4 }}>
      <button className="secondary" onClick={check} disabled={state === "busy"}>
        {state === "busy" ? <span className="spin" /> : "🔍"} {label}
      </button>
      {lines.map((l) => (
        <span key={l.msg} className={`small ${l.ok ? "ok" : "bad"}`}>{l.ok ? "✓" : "✗"} {l.msg}</span>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal stack" onClick={(e) => e.stopPropagation()}>
        <div className="row between"><h3>{title}</h3><button className="secondary" onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  );
}

const dealTitle = (d: Deal) => `${COMMODITY[d.commodity] ?? d.commodity} shipment · Peru → ${REGION[d.destination_region] ?? d.destination_region}`;

export function TrackRecord({ store, pseudonym, field, label }: { store: Store; pseudonym: string; field: string; label: string }) {
  const theirs = store.attestations.filter((a) => a.payload[field] === pseudonym);
  const shipments = theirs.filter((a) => a.event !== "outcome").length;
  const outcomes = theirs.filter((a) => a.event === "outcome");
  const onTime = outcomes.filter((a) => String(a.payload.outcome?.code) === "1").length;
  const claims = outcomes.filter((a) => String(a.payload.outcome?.code) === "4").length;
  return (
    <div className="stack" style={{ gap: 2 }}>
      <span className="small"><b>{label}</b> <span className="muted tiny">anonymous ID {short(pseudonym, 4)}</span></span>
      <span className="small">
        {shipments} shipment{shipments === 1 ? "" : "s"} on record · {onTime} paid on time · {claims} insurance claim{claims === 1 ? "" : "s"}
      </span>
    </div>
  );
}

// ---------- marketplace ----------

const shortTitle = (d: Deal) => `${COMMODITY[d.commodity] ?? d.commodity} → ${REGION[d.destination_region] ?? d.destination_region}`;

function DealCard({ d, o }: { d: Deal; o?: Offering }) {
  const c = o?.on_chain;
  const open = c?.status === "Open";
  const pct = c ? (Number(c.sold_shares) / Number(c.p.cap_shares)) * 100 : 0;
  return (
    <a href={`#/deal/${d.shipment_ref}`} className="card deal">
      <div className="deal-top">
        <span className="deal-title">{shortTitle(d)}</span>
        <span className={`band ${d.cram_band}`} title={`Risk band ${d.cram_band}`}>{d.cram_band}</span>
      </div>
      <div className="deal-apy">
        <span className="big-apy">{(d.apy_bps / 100).toFixed(1)}%</span>
        <span className="muted small">APY · {d.term_days} days</span>
      </div>
      {open ? (
        <div className="stack" style={{ gap: 6 }}>
          <ProgressBar value={pct} label="Subscribed" />
          <div className="row between small">
            <span><b>{usd(c!.sold_shares, 0)}</b> <span className="muted">of {money(d.face_value_usd, 0)}</span></span>
            <span className="muted">Closes {dateS(c!.p.deadline)}</span>
          </div>
        </div>
      ) : (
        <span className="small muted">{money(d.face_value_usd, 0)} raise</span>
      )}
    </a>
  );
}

export function Marketplace() {
  const { store } = useApp();
  const deals = store.deals.filter((d) => !d.stuck);
  const status = (d: Deal) => offeringFor(store, d.shipment_ref)?.on_chain?.status;
  const open = deals.filter((d) => status(d) === "Open");
  const soon = deals.filter((d) => !d.has_offering);
  const past = deals.filter((d) => d.has_offering && status(d) !== "Open");
  const result = (d: Deal): [string, "primary" | "accent" | "danger" | "info"] => {
    const out = store.attestations.find((a) => a.shipment_ref === d.shipment_ref && a.event === "outcome");
    if (out) {
      const code = String(out.payload.outcome?.code);
      return [OUTCOMES[code], code === "1" ? "primary" : code === "4" ? "info" : "accent"];
    }
    return [offeringStatus(offeringFor(store, d.shipment_ref))[0], "info"];
  };
  return (
    <div className="stack-lg">
      <div className="stack" style={{ gap: 10 }}>
        <h1>Invest in insured trade receivables</h1>
        <p className="muted">Each deal is one agri-export shipment: you fund it, and you're repaid when the buyer pays.</p>
        <div className="row" style={{ gap: 8 }}>
          <span className="chip green">🛡️ Insured up to 90%</span>
          <span className="chip green">✓ Verifiable on Stellar</span>
          <span className="chip green">Fixed APY, paid at maturity</span>
          <span className="chip">Shares registered in your name</span>
        </div>
      </div>

      <section className="stack">
        <h2>Open now</h2>
        {open.length ? (
          <div className="grid g3">{open.map((d) => <DealCard key={d.shipment_ref} d={d} o={offeringFor(store, d.shipment_ref)} />)}</div>
        ) : (
          <p className="muted small">No deal is open right now.{soon.length ? " The next ones are below." : ""}</p>
        )}
      </section>

      {!!soon.length && (
        <section className="stack">
          <h2>Opening soon</h2>
          <div className="grid g3">{soon.map((d) => <DealCard key={d.shipment_ref} d={d} />)}</div>
        </section>
      )}

      {!!past.length && (
        <section className="stack">
          <h2>Past deals</h2>
          <div className="card" style={{ padding: 0 }}>
            <div className="scroll">
              <table>
                <thead><tr><th>Deal</th><th>APY</th><th>Term</th><th>Raise</th><th>Result</th></tr></thead>
                <tbody>
                  {past.map((d) => {
                    const [label, tone] = result(d);
                    return (
                      <tr key={d.shipment_ref}>
                        <td><a href={`#/deal/${d.shipment_ref}`}><b>{shortTitle(d)}</b></a></td>
                        <td>{(d.apy_bps / 100).toFixed(1)}%</td>
                        <td>{d.term_days} days</td>
                        <td>{money(d.face_value_usd, 0)}</td>
                        <td><Badge tone={tone}>{label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ---------- deal page ----------

function InvestPanel({ d, o }: { d: Deal; o?: Offering }) {
  const { persona, interactive, busy, run, store } = useApp();
  const c = o?.on_chain;
  const cap = c ? units(c.p.cap_shares) : d.face_value_usd;
  const sold = c ? units(c.sold_shares) : 0;
  const remaining = cap - sold;
  const suggested = persona === "A" ? Math.round(cap * 0.6) : persona === "B" ? Math.round(cap * 0.4) : 1000;
  const [amount, setAmount] = useState(String(Math.min(suggested, remaining) || ""));
  const [agreed, setAgreed] = useState(false);
  const [declined, setDeclined] = useState(false);
  const approved = isApproved(o, persona);
  const position = persona === "A" || persona === "B" ? o?.investors[persona] : undefined;
  const balance = units(store.accounts[persona]?.tusdc ?? 0);

  if (persona === "ops") return <div className="card"><p>Switch to an investor persona to invest, or manage this deal in <a href="#/ops">SPV operations</a>.</p></div>;
  if (!o || !c) {
    return (
      <div className="card stack">
        <h3>Offering not open yet</h3>
        <p className="muted small">The shipment is customs-attested and its share asset exists, but the SPV hasn't opened the offering. In the demo, switch to <b>TruMarket ops</b> and click <b>Open offering</b>.</p>
      </div>
    );
  }
  if (c.status !== "Open") {
    const [label] = offeringStatus(o);
    return (
      <div className="card stack">
        <h3>{label}</h3>
        {position ? (
          <p className="small">You subscribed {money(position.subscribed_usd, 0)}. {c.status === "Distributing" && Number(position.shares_held) > 0 ? <a href="#/portfolio">Redeem in your portfolio →</a> : <a href="#/portfolio">See your position →</a>}</p>
        ) : (
          <p className="muted small">This offering is no longer accepting subscriptions.</p>
        )}
      </div>
    );
  }
  const amt = Number(amount);
  const amountOk = Number.isFinite(amt) && amt > 0 && amt <= remaining && Number.isInteger(amt) && amt <= balance;
  const canKyb = (persona === "A" || persona === "B") && !approved;
  const subscribe = async () => {
    const ok = await run(`${PERSONAS[persona]} subscribes ${money(amt, 0)}`, { action: "subscribe", ref: d.shipment_ref, who: who(persona), usd: String(amt) });
    if (ok) setAgreed(false);
    else if (persona === "U") setDeclined(true);
  };
  return (
    <div className="card stack">
      <div className="row between">
        <h3>Invest</h3>
        <span className="small muted">Wallet: <b>{money(balance)}</b> TUSDC</span>
      </div>
      {position && <div className="chip green">You hold {num(position.shares_held)} shares · <a href="#/portfolio">view certificate</a></div>}
      <div className="steps">
        <div className="step">
          <div className={`dot ${approved ? "done" : "now"}`}>1</div>
          <div className="stack" style={{ gap: 6 }}>
            <h4>Eligibility (KYB)</h4>
            {approved ? (
              <p className="small ok">✓ Approved to hold {d.share?.code}. Your trustline is authorized by the issuer.</p>
            ) : persona === "U" ? (
              <p className="small">This wallet hasn't passed KYB, so the share asset won't accept it. You can still try: the asset itself will refuse to mint, and your TUSDC never leaves your wallet.</p>
            ) : (
              <>
                <p className="small muted">Professional investors only. TruMarket approves your wallet after KYB (simulated here).</p>
                <div><button className="secondary" disabled={!interactive || busy || !canKyb} onClick={() => run(`KYB approval for ${PERSONAS[persona]}`, { action: "approve", ref: d.shipment_ref, who: who(persona) })}>Complete KYB (simulated)</button></div>
              </>
            )}
          </div>
        </div>
        <div className="step">
          <div className={`dot ${agreed ? "done" : approved || persona === "U" ? "now" : ""}`}>2</div>
          <div className="stack" style={{ gap: 8 }}>
            <h4>Subscription agreement</h4>
            <div className="row" style={{ alignItems: "stretch" }}>
              <input type="number" min={1} max={remaining} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} style={{ maxWidth: 180 }} aria-label="Amount in USD" />
              <span className="small muted" style={{ alignSelf: "center" }}>USD → {amountOk ? amt.toLocaleString("en-US") : "–"} shares · {money(remaining, 0)} left</span>
            </div>
            <div className="doc">{`SUBSCRIPTION AGREEMENT (preview: testnet demo, not a legal document)
SPV: Proof of Trading SPV ${d.shipment_ref}
Subscription: ${amountOk ? amt.toLocaleString("en-US") : "…"} USD for ${amountOk ? amt.toLocaleString("en-US") : "…"} ordinary shares at 1.00 USD
Return: fixed ${(d.apy_bps / 100).toFixed(1)}% APY over ${d.term_days} days, paid from collections;
        pro rata if less is collected (insurance covers up to 90%)
Your share is registered off-chain in your name; you receive a share
certificate whose hash is anchored on Stellar. ${d.share?.code} tokens are your
on-chain receipt. The signed agreement's sha256 is recorded in your
subscription transaction.`}</div>
            <label className="check"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> I have read the agreement and sign it with my wallet</label>
          </div>
        </div>
        <div className="step">
          <div className="dot">3</div>
          <div className="stack" style={{ gap: 8 }}>
            <h4>Pay and receive your shares</h4>
            <p className="small muted">One transaction: your TUSDC goes into escrow and {d.share?.code} shares are minted to you. The SPV then issues your share certificate.</p>
            <div>
              <button disabled={!interactive || busy || !agreed || !amountOk || (!approved && persona !== "U")} onClick={subscribe}>
                Pay {amountOk ? money(amt, 0) : ""} TUSDC & subscribe
              </button>
            </div>
            {!interactive && <p className="tiny muted">Read-only snapshot. Run the dashboard locally (`npm run dev`) to sign testnet transactions.</p>}
            {declined && <p className="small bad">✗ Rejected by the share asset (BalanceDeauthorizedError): this wallet isn't approved. No TUSDC moved.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function DueDiligence({ d, o }: { d: Deal; o?: Offering }) {
  const { store } = useApp();
  const proof = store.attestations.find((a) => a.shipment_ref === d.shipment_ref && a.event === "financed_attested");
  return (
    <div className="stack">
      <div className="card dark stack">
        <h3>What you're buying</h3>
        <p className="small">
          A share of this shipment's <b>trade receivable</b>: the buyer's obligation to pay, held by a dedicated SPV that is also the
          beneficiary of the insurance. Your shares are registered <b>off-chain, in your name</b>, with a share certificate that's
          verifiable on Stellar. <b>{d.share?.code}</b> tokens are your on-chain receipt, minted when you pay and burned when you're repaid.
        </p>
      </div>
      <div className="card stack">
        <div className="row between"><h3>Customs record</h3>{proof?.verified && <span className="chip green">✓ Verifiable</span>}</div>
        {proof ? (
          <>
            <p className="small">
              This shipment's customs declaration, insurance assignment and risk rating were sealed on Stellar on{" "}
              <b>{date(proof.created_at)}</b>. Anyone can verify the record hasn't changed since; the details stay private.
            </p>
            <VerifyOnChain tx={proof.tx_hash} expected={proof.proof_hash} />
            <a className="small" href={`#/shipment/${d.shipment_ref}`}>What this proves, and the full record →</a>
          </>
        ) : <p className="small muted">No record yet.</p>}
      </div>
      <div className="card stack">
        <h3>Risk and protection</h3>
        <div className="row"><span className={`band ${d.cram_band}`}>{d.cram_band}</span><span className="small"><b>CRAM band {d.cram_band}</b>: {CRAM[d.cram_band]}</span></div>
        <p className="small">🛡️ <b>Insured up to 90%</b>; the insurance is assigned to the SPV (simulated: assignment digest only). Exclusions apply; "protected", never "guaranteed".</p>
      </div>
      {proof && (
        <div className="card stack">
          <h3>Counterparty track record</h3>
          <p className="tiny muted">From verifiable records this quarter. Names stay private; IDs change every quarter.</p>
          <TrackRecord store={store} pseudonym={proof.payload.exporter_pseudonym} field="exporter_pseudonym" label="Exporter" />
          <TrackRecord store={store} pseudonym={proof.payload.buyer_pseudonym} field="buyer_pseudonym" label="Buyer" />
        </div>
      )}
      {o && (
        <div className="card stack">
          <h3>Activity</h3>
          <ol className="timeline">
            {o.steps.filter((s) => !s.step.startsWith("trustline")).map((s) => (
              <li key={s.tx}><span className="muted tiny">{date(s.at)}</span> {stepLabel(s, o.share_code)} · <Tx hash={s.tx} label="tx" /></li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export function DealPage({ ref_ }: { ref_: string }) {
  const { store } = useApp();
  const d = dealFor(store, ref_);
  const o = offeringFor(store, ref_);
  if (!d) return <p>Unknown deal. <a href="#/invest">Back</a></p>;
  const c = o?.on_chain;
  const [label, tone] = offeringStatus(o);
  return (
    <div className="stack-lg">
      <a href="#/invest" className="small">← All deals</a>
      <div className="row between">
        <div className="stack" style={{ gap: 4 }}>
          <h1>{dealTitle(d)}</h1>
          <span className="muted small">{d.shipment_ref} · shares {d.share?.code} · period {d.epoch}</span>
        </div>
        <span className={`chip ${tone}`}>{label}</span>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="v" style={{ color: "var(--primary)" }}>{(d.apy_bps / 100).toFixed(1)}%</div><div className="l">Fixed APY</div></div>
        <div className="kpi"><div className="v">{d.term_days} days</div><div className="l">Term</div></div>
        <div className="kpi"><div className="v">{money(d.face_value_usd, 0)}</div><div className="l">Raise</div></div>
        <div className="kpi"><div className="v">{c ? usd(c.sold_shares, 0) : "–"}</div><div className="l">Subscribed</div></div>
        <div className="kpi"><div className="v">{c ? num(o!.tokens?.outstanding ?? 0) : "0"}</div><div className="l">{d.share?.code} outstanding</div></div>
        {c && c.status === "Open" && <div className="kpi"><div className="v" style={{ fontSize: 15 }}>{dateS(c.p.deadline)}</div><div className="l">Closes</div></div>}
      </div>
      <div className="split">
        <InvestPanel d={d} o={o} />
        <DueDiligence d={d} o={o} />
      </div>
    </div>
  );
}

// ---------- portfolio ----------

function Certificate({ cert, agreement, burned }: { cert: Doc; agreement?: Doc; burned: boolean }) {
  const [show, setShow] = useState<"cert" | "agreement" | null>(null);
  const holder = cert.text?.match(/Registered holder: (\S+)/)?.[1] ?? "";
  const shares = cert.text?.match(/Shares: ([\d,]+)/)?.[1] ?? "";
  return (
    <div className="cert stack" style={{ gap: 8 }}>
      <div className="row between">
        <span className="seal">SPV share certificate · off-chain, in your name</span>
        <span className={`chip ${burned ? "" : "gold"}`}>{burned ? "Redeemed & cancelled" : "Active"}</span>
      </div>
      <dl>
        <dt>Register entry</dt><dd><b>{cert.entry}</b></dd>
        <dt>Holder</dt><dd className="mono">{short(holder, 10)}</dd>
        <dt>Shares</dt><dd>{Number(shares).toLocaleString("en-US")} ordinary shares, fully paid</dd>
        <dt>Certificate hash</dt><dd className="mono">{short(cert.hash ?? "", 12)} · anchored in <Tx hash={cert.tx} label="tx" /></dd>
        {agreement?.hash && <><dt>Agreement hash</dt><dd className="mono">{short(agreement.hash, 12)} · recorded in your <Tx hash={agreement.tx} label="subscription tx" /></dd></>}
      </dl>
      <div className="row">
        <button className="secondary" onClick={() => setShow("cert")}>View certificate</button>
        {agreement?.text && <button className="secondary" onClick={() => setShow("agreement")}>View signed agreement</button>}
      </div>
      {cert.hash && <VerifyOnChain tx={cert.tx} expected={cert.hash} text={cert.text} />}
      {show === "cert" && cert.text && <Modal title={`Share certificate ${cert.entry}`} onClose={() => setShow(null)}><div className="doc" style={{ maxHeight: "none" }}>{cert.text}</div><p className="small muted">The SPV's share register is the legal record; this document's sha256 is anchored on Stellar so you can prove it's the one on record.</p></Modal>}
      {show === "agreement" && agreement?.text && <Modal title="Signed subscription agreement" onClose={() => setShow(null)}><div className="doc" style={{ maxHeight: "none" }}>{agreement.text}</div><p className="small muted">sha256 <span className="mono">{agreement.hash}</span> is part of your subscription transaction.</p></Modal>}
    </div>
  );
}

function PositionCard({ o, label }: { o: Offering; label: Persona }) {
  const { store, interactive, busy, run } = useApp();
  const p = o.investors[label];
  const d = dealFor(store, o.shipment_ref)!;
  const c = o.on_chain!;
  const held = BigInt(p.shares_held);
  const heldUnits = units(p.shares_held);
  const payout = previewPayout(o, held);
  const done = !!p.payout || !!p.refund;
  return (
    <div className="card stack">
      <div className="row between">
        <div>
          <a href={`#/deal/${o.shipment_ref}`}><h3>{dealTitle(d)}</h3></a>
          <span className="small muted">{o.shipment_ref} · {o.share_code}</span>
        </div>
        <span className={`chip ${offeringStatus(o)[1]}`}>{offeringStatus(o)[0]}</span>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="v">{money(p.subscribed_usd, 0)}</div><div className="l">Invested</div></div>
        <div className="kpi"><div className="v">{heldUnits.toLocaleString("en-US")}</div><div className="l">{o.share_code} held</div></div>
        <div className="kpi"><div className="v">{p.pct_of_spv?.toFixed(0)}%</div><div className="l">of the SPV</div></div>
        <div className="kpi"><div className="v">{p.owed_at_apy ? usd(p.owed_at_apy) : "–"}</div><div className="l">Owed at maturity</div></div>
        {!done && c.status !== "Open" && <div className="kpi"><div className="v">{money(accruedValue(o, p.subscribed_usd))}</div><div className="l">Accrued value (est.)</div></div>}
        {p.payout && <div className="kpi"><div className="v" style={{ color: "var(--primary)" }}>{amount(p.payout)}</div><div className="l">Paid out</div></div>}
        {p.refund && <div className="kpi"><div className="v">{amount(p.refund)}</div><div className="l">Refunded</div></div>}
      </div>
      {c.status === "Distributing" && held > 0n && (
        <div className="card cream row between">
          <div className="stack" style={{ gap: 2 }}>
            <b>{OUTCOMES[String(c.outcome_code)]}: {usd(c.total_collected)} collected</b>
            <span className="small">Redeem your {heldUnits.toLocaleString("en-US")} shares for <b>{usd(payout.toString())}</b> TUSDC. Your {o.share_code} tokens are burned and your certificate cancelled.</span>
          </div>
          <button disabled={!interactive || busy} onClick={() => run(`${PERSONAS[label]} redeems ${o.share_code}`, { action: "redeem", ref: o.shipment_ref, who: who(label) })}>Redeem {usd(payout.toString())}</button>
        </div>
      )}
      {c.status === "Refunding" && held > 0n && (
        <div className="card cream row between">
          <span className="small">The offering didn't fill before its deadline. Get your {money(heldUnits, 0)} back; shares are burned.</span>
          <button disabled={!interactive || busy} onClick={() => run(`${PERSONAS[label]} refund`, { action: "refund", ref: o.shipment_ref, who: who(label) })}>Claim refund</button>
        </div>
      )}
      {p.certificates.map((cert, i) => <Certificate key={cert.tx} cert={cert} agreement={p.agreements[i]} burned={done} />)}
      {!p.certificates.length && <p className="tiny muted">Subscribed before certificates were introduced: proof is the agreement hash in the subscription transaction.</p>}
    </div>
  );
}

export function Portfolio() {
  const { store, persona } = useApp();
  if (persona === "ops") return <p>Switch to an investor persona to see a portfolio.</p>;
  const acct = store.accounts[persona];
  const lastActivity = (o: Offering) => o.steps[o.steps.length - 1]?.at ?? "";
  const settled = (o: Offering) => !!(o.investors[persona].payout || o.investors[persona].refund);
  // Active positions first, then most recent activity first.
  const positions = (persona === "U" ? [] : store.offerings.filter((o) => o.investors[persona])).sort(
    (a, b) => Number(settled(a)) - Number(settled(b)) || lastActivity(b).localeCompare(lastActivity(a)),
  );
  const active = positions.filter((o) => !o.investors[persona].payout && !o.investors[persona].refund);
  const invested = active.reduce((n, o) => n + o.investors[persona].subscribed_usd, 0);
  const owed = active.reduce((n, o) => n + units(o.investors[persona].owed_at_apy ?? 0), 0);
  return (
    <div className="stack-lg">
      <div className="row between">
        <h1>My portfolio · {PERSONAS[persona]}</h1>
        <a className="mono small" href={`${X}/account/${acct.public_key}`} target="_blank" rel="noreferrer">{short(acct.public_key, 8)}</a>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="v">{money(units(acct.tusdc))}</div><div className="l">TUSDC in wallet</div></div>
        <div className="kpi"><div className="v">{money(invested, 0)}</div><div className="l">Active investments</div></div>
        <div className="kpi"><div className="v">{owed ? money(owed) : "–"}</div><div className="l">Owed at maturity</div></div>
        <div className="kpi"><div className="v">{positions.length}</div><div className="l">Deals (incl. closed)</div></div>
      </div>
      {!positions.length && (
        <div className="card">
          {persona === "U"
            ? <p>This wallet hasn't passed KYB, so it can't hold SPV shares. Try subscribing to an open deal to see the asset refuse it.</p>
            : <p>No positions yet. <a href="#/invest">Browse open deals →</a></p>}
        </div>
      )}
      {positions.map((o) => <PositionCard key={o.shipment_ref} o={o} label={persona} />)}
    </div>
  );
}
