import { useApp } from "./ctx";
import { CRAM, OUTCOMES, X, date, money, num, offeringFor, shipmentTitle, stepLabel, units } from "./lib";
import { Tx, VerifyOnChain } from "./investor";
import { Badge, Panel, SectionLabel } from "./ui";

const OUTCOME_TONE: Record<string, "primary" | "accent" | "danger" | "info"> = { "1": "primary", "2": "accent", "3": "accent", "4": "info", "5": "danger" };

export function Proofs() {
  const { store } = useApp();
  const proofs = store.attestations.filter((a) => a.event !== "outcome");
  const outcomes = store.attestations.filter((a) => a.event === "outcome");
  return (
    <div className="stack-lg">
      <div className="stack" style={{ gap: 6 }}>
        <h1>Verifiable shipment records</h1>
        <p className="muted">
          Every consented shipment is sealed on Stellar when it clears customs, financed or not, building a verifiable track record
          for exporters and buyers. The details stay private; anyone can check the record hasn't changed.
        </p>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="scroll">
          <table>
            <thead><tr><th>Shipment</th><th>Financed by investors</th><th>Period</th><th>Registered on</th><th>Status</th><th /></tr></thead>
            <tbody>
              {proofs.map((a) => (
                <tr key={a.tx_hash}>
                  <td>
                    <a href={`#/shipment/${a.shipment_ref}`}><b>{shipmentTitle(store, a.shipment_ref)}</b></a>
                    <div className="tiny muted">{a.shipment_ref}</div>
                  </td>
                  <td>{a.event === "financed_attested" ? <Badge tone="accent">Yes</Badge> : <span className="small muted">No</span>}</td>
                  <td>{a.payload.epoch}</td>
                  <td className="small">{date(a.created_at)}</td>
                  <td>{a.verified ? <Badge>✓ Verifiable</Badge> : <Badge tone="danger">Mismatch</Badge>}</td>
                  <td><a href={`#/shipment/${a.shipment_ref}`} className="small">View →</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <h2>How financed shipments ended</h2>
        <p className="muted small">Recorded on Stellar when each deal closes, so repayment history can't be edited after the fact.</p>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="scroll">
          <table>
            <thead><tr><th>Shipment</th><th>Result</th><th>Collected</th><th>Owed to investors</th><th>Recorded on</th></tr></thead>
            <tbody>
              {outcomes.map((a) => {
                const code = String(a.payload.outcome?.code);
                return (
                  <tr key={a.tx_hash}>
                    <td><a href={`#/shipment/${a.shipment_ref}`}><b>{shipmentTitle(store, a.shipment_ref)}</b></a><div className="tiny muted">{a.shipment_ref}</div></td>
                    <td><Badge tone={OUTCOME_TONE[code]}>{OUTCOMES[code]}</Badge></td>
                    <td>{money(units(a.payload.outcome?.amount_collected ?? 0))}</td>
                    <td>{money(units(a.payload.outcome?.amount_owed ?? 0))}</td>
                    <td className="small">{date(a.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** A compact fact: big value, small caption. */
function Fact({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="fact">
      <div className="fact-label">{label}</div>
      <div className="fact-value">{value}</div>
      {sub && <div className="fact-sub">{sub}</div>}
    </div>
  );
}

function trackLine(store: ReturnType<typeof useApp>["store"], field: string, pseudonym: string) {
  const theirs = store.attestations.filter((a) => a.payload[field] === pseudonym);
  const n = theirs.filter((a) => a.event !== "outcome").length;
  const outs = theirs.filter((a) => a.event === "outcome");
  const paid = outs.filter((a) => String(a.payload.outcome?.code) === "1").length;
  const claims = outs.filter((a) => String(a.payload.outcome?.code) === "4").length;
  return `${n} shipment${n === 1 ? "" : "s"} · ${paid} paid on time · ${claims} claim${claims === 1 ? "" : "s"}`;
}

export function ProofDetail({ ref_ }: { ref_: string }) {
  const { store } = useApp();
  const atts = store.attestations.filter((a) => a.shipment_ref === ref_);
  const share = store.shares.find((s) => s.shipment_ref === ref_);
  const offering = offeringFor(store, ref_);
  const main = atts.find((a) => a.event !== "outcome");
  const outcome = atts.find((a) => a.event === "outcome");
  if (!main) return <p>Unknown or unregistered shipment. <a href="#/proofs">Back</a></p>;
  const financed = main.event === "financed_attested";
  const code = outcome ? String(outcome.payload.outcome?.code) : null;
  const sealed = [
    "Customs declaration",
    "Exporter & buyer (anonymous)",
    ...(financed ? ["Insurance assignment", "Risk rating"] : []),
  ];
  const history = [
    ...atts.map((a) => ({
      at: a.created_at,
      tx: a.tx_hash,
      label: a.event === "outcome" ? `Result recorded on Stellar: ${OUTCOMES[String(a.payload.outcome?.code)]}` : "Shipment registered on Stellar",
    })),
    ...(offering?.steps ?? [])
      .filter((s) => !s.step.startsWith("outcome attested") && !s.step.startsWith("trustline"))
      .map((s) => ({ at: s.at, label: stepLabel(s, offering!.share_code), tx: s.tx })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="stack-lg" style={{ maxWidth: 900 }}>
      <a href="#/proofs" className="small">← All shipment records</a>

      <div className="row between">
        <div className="stack" style={{ gap: 4 }}>
          <h1>{shipmentTitle(store, ref_)}</h1>
          <span className="muted small">{ref_} · {main.payload.epoch}</span>
        </div>
        {financed ? <Badge tone="accent">Financed by investors</Badge> : <Badge tone="info" outline>Not financed</Badge>}
      </div>

      {/* The answer first: is this shipment really on record? */}
      <Panel className="verdict">
        <div className="verdict-row">
          <div className="verdict-icon">✓</div>
          <div className="stack" style={{ gap: 4, flex: 1, minWidth: 220 }}>
            <b className="verdict-title">Verifiable record, sealed on Stellar on {date(main.created_at)}</b>
            <span className="small muted">Nobody, including TruMarket, can change or backdate it. Check it yourself →</span>
          </div>
          <VerifyOnChain tx={main.tx_hash} expected={main.proof_hash} />
        </div>
      </Panel>

      <div className="facts-grid">
        {financed && (
          <Fact
            label="Risk"
            value={<span className="row" style={{ gap: 8 }}><span className={`band ${main.payload.cram_band}`}>{main.payload.cram_band}</span> {CRAM[main.payload.cram_band]?.split(":")[0]}</span>}
            sub="Insured up to 90%"
          />
        )}
        {outcome && (
          <Fact
            label="Outcome"
            value={<Badge tone={OUTCOME_TONE[code!]}>{OUTCOMES[code!]}</Badge>}
            sub={`${money(units(outcome.payload.outcome?.amount_collected ?? 0))} collected of ${money(units(outcome.payload.outcome?.amount_owed ?? 0))} owed`}
          />
        )}
        {financed && offering?.tokens && (
          <Fact
            label="Investors"
            value={`${num(offering.tokens.minted)} shares`}
            sub={<a href={`#/deal/${ref_}`}>Open the deal →</a>}
          />
        )}
        <Fact
          label="Track record"
          value={<span className="small">Exporter: {trackLine(store, "exporter_pseudonym", main.payload.exporter_pseudonym)}</span>}
          sub={<>Buyer: {trackLine(store, "buyer_pseudonym", main.payload.buyer_pseudonym)}</>}
        />
      </div>

      <Panel>
        <SectionLabel>What's sealed</SectionLabel>
        <div className="row" style={{ marginTop: 10, gap: 8 }}>
          {sealed.map((s) => <span key={s} className="chip green">✓ {s}</span>)}
          {outcome && <span className="chip green">✓ Final result and payouts</span>}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>
          Only a fingerprint is public. The documents themselves stay with TruMarket and can be shared with auditors under NDA.
        </p>
      </Panel>

      <details className="tech">
        <summary>History ({history.length} steps)</summary>
        <ol className="timeline" style={{ marginTop: 10 }}>
          {history.map((t) => <li key={t.tx}><span className="muted tiny">{date(t.at)}</span> {t.label}</li>)}
        </ol>
      </details>

      <details className="tech">
        <summary>Technical details (for auditors and developers)</summary>
        <div className="stack" style={{ marginTop: 12 }}>
          {atts.map((a) => (
            <div key={a.tx_hash} className="card stack">
              <h4>{a.event === "outcome" ? "Outcome record" : "Shipment record"}</h4>
              <dl>
                <dt>Fingerprint (sha256)</dt><dd className="mono">{a.proof_hash}</dd>
                <dt>Stellar transaction</dt><dd><Tx hash={a.tx_hash} label={a.tx_hash} /> (ledger {a.ledger})</dd>
                <dt>How it's stored</dt><dd className="small">MEMO_HASH of a 0.0000001 XLM payment from TruMarket's attestor account. The fingerprint is sha256 of the canonical JSON below plus a private random salt (kept by TruMarket, so the fingerprint can't be guessed).</dd>
                {a.arc_stub && <><dt>Arc deal ID</dt><dd className="small">Stubbed in this testnet demo</dd></>}
              </dl>
              <pre>{JSON.stringify(a.payload, null, 2)}</pre>
            </div>
          ))}
          {share && (
            <div className="card stack">
              <h4>Share asset</h4>
              <dl>
                <dt>Asset</dt><dd><a href={`${X}/asset/${share.code}-${share.issuer}`} target="_blank" rel="noreferrer">{share.code}</a> (approved holders only, revocable, clawback for compliance)</dd>
                <dt>Stellar Asset Contract</dt><dd className="mono">{share.sac_id}</dd>
                <dt>Issuer</dt><dd className="mono">{share.issuer}</dd>
              </dl>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
