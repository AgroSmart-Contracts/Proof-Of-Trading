import { StrictMode, useCallback, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./theme/tokens.css";
import "./theme/components.css";
import "./style.css";
import { AppCtx } from "./ctx";
import { PERSONAS, X, isInteractive, postAction, short, txLinks, type ActionBody, type Persona, type Store } from "./lib";
import { DealPage, Marketplace, Portfolio } from "./investor";
import { Ops } from "./ops";
import { ProofDetail, Proofs } from "./proofs";
import { Showcase } from "./ui/Showcase";

type Activity = { id: number; label: string; state: "busy" | "ok" | "err"; log: string };

const loadStore = (): Promise<Store> => fetch(`/public-store.json?t=${Date.now()}`).then((r) => r.json());
const savedPersona = (): Persona => {
  try {
    const p = localStorage.getItem("pot-persona") as Persona | null;
    return p && p in PERSONAS ? p : "A";
  } catch {
    return "A";
  }
};

function useHash() {
  const [h, setH] = useState(location.hash || "#/invest");
  useEffect(() => {
    const f = () => setH(location.hash || "#/invest");
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  return h;
}

function ActivityPanel({ items, dismiss }: { items: Activity[]; dismiss: (id: number) => void }) {
  if (!items.length) return null;
  return (
    <div className="activity">
      {items.map((a) => {
        const links = txLinks(a.log);
        return (
          <div key={a.id} className={`toast ${a.state === "err" ? "err" : a.state === "busy" ? "busy" : ""}`}>
            <div className="row between">
              <b>
                {a.state === "busy" && <span className="spin" />} {a.label}
                {a.state === "ok" && " ✓"}
                {a.state === "err" && " failed"}
              </b>
              {a.state !== "busy" && <button className="link small" onClick={() => dismiss(a.id)}>Dismiss</button>}
            </div>
            {a.state === "busy" && <p className="muted small">Signing and submitting on Stellar testnet…</p>}
            {!!links.length && (
              <div className="small">
                {links.map((h) => (
                  <div key={h}>
                    <a href={`${X}/tx/${h}`} target="_blank" rel="noreferrer" className="mono">tx {short(h, 8)}</a>
                  </div>
                ))}
              </div>
            )}
            {a.state === "err" && <pre>{a.log.split("\n").filter((l) => l.includes("✗") || l.includes("Error")).join("\n") || a.log.slice(-600)}</pre>}
          </div>
        );
      })}
    </div>
  );
}

function App() {
  const [store, setStore] = useState<Store | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [interactive, setInteractive] = useState(false);
  const [persona, setPersonaState] = useState<Persona>(savedPersona);
  const [activity, setActivity] = useState<Activity[]>([]);
  const hash = useHash();

  useEffect(() => {
    loadStore().then(setStore).catch((e) => setErr(String(e)));
    isInteractive().then(setInteractive);
  }, []);

  const setPersona = (p: Persona) => {
    setPersonaState(p);
    try {
      localStorage.setItem("pot-persona", p);
    } catch {
      /* private mode: persona just isn't remembered */
    }
    if (p === "ops" && !hash.startsWith("#/ops")) location.hash = "#/ops";
    if (p !== "ops" && hash.startsWith("#/ops")) location.hash = "#/invest";
  };

  const busy = activity.some((a) => a.state === "busy");
  const run = useCallback(async (label: string, body: ActionBody) => {
    const id = Date.now();
    const entry: Activity = { id, label, state: "busy", log: "" };
    setActivity((a) => [entry, ...a].slice(0, 4));
    let ok = false;
    let log = "";
    try {
      ({ ok, log } = await postAction(body));
    } catch (e) {
      log = String(e);
    }
    setActivity((a) => a.map((x): Activity => (x.id === id ? { ...x, state: ok ? "ok" : "err", log } : x)));
    setStore(await loadStore());
    return ok;
  }, []);

  if (err) return <p className="wrap">Could not load data: {err}. Run <code>npm run export</code>.</p>;
  if (!store) return <p className="wrap muted" style={{ padding: 40 }}>Loading…</p>;

  const isInvestor = persona !== "ops";
  const nav: [string, string][] = isInvestor
    ? [["#/invest", "Invest"], ["#/portfolio", "My portfolio"], ["#/proofs", "Shipment records"]]
    : [["#/ops", "SPV operations"], ["#/proofs", "Shipment records"]];
  const deal = hash.match(/^#\/deal\/(SHP-\d{4})$/);
  const proof = hash.match(/^#\/shipment\/(SHP-\d{4})$/);

  let page: ReactNode;
  if (deal) page = <DealPage ref_={deal[1]} />;
  else if (proof) page = <ProofDetail ref_={proof[1]} />;
  else if (hash.startsWith("#/portfolio")) page = <Portfolio />;
  else if (hash.startsWith("#/proofs")) page = <Proofs />;
  else if (hash.startsWith("#/ops")) page = <Ops />;
  else if (hash.startsWith("#/ui")) page = <Showcase />;
  else page = isInvestor ? <Marketplace /> : <Ops />;

  return (
    <AppCtx.Provider value={{ store, persona, interactive, busy, run }}>
      <header className="top">
        <div className="wrap">
          <a className="brand" href={isInvestor ? "#/invest" : "#/ops"}>
            <img src="/logo.svg" alt="TruMarket" />
            <span>Proof of Trading</span>
          </a>
          <nav className="nav">
            {nav.map(([href, label]) => (
              <a key={href} href={href} className={hash.startsWith(href) || (href === "#/invest" && deal) ? "on" : ""}>{label}</a>
            ))}
          </nav>
          <div className="persona">
            <span className="small muted">Viewing as</span>
            <select value={persona} onChange={(e) => setPersona(e.target.value as Persona)} aria-label="Persona">
              {(Object.keys(PERSONAS) as Persona[]).map((p) => (
                <option key={p} value={p}>{PERSONAS[p]}</option>
              ))}
            </select>
          </div>
        </div>
      </header>
      <div className="banner">
        <div className="wrap">
          <span><b>Testnet demo.</b> SPV, KYB and insurance are simulated · TUSDC is test USDC</span>
          <span className="chip" style={{ marginLeft: "auto", background: interactive ? "var(--tm-primary)" : "#3b5a4e", color: "#fff" }}>
            {interactive ? "Live: buttons sign testnet transactions" : "Read-only snapshot"}
          </span>
        </div>
      </div>
      <main className="wrap">{page}</main>
      <ActivityPanel items={activity} dismiss={(id) => setActivity((a) => a.filter((x) => x.id !== id))} />
    </AppCtx.Provider>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
