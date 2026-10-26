import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Run a repo script with tsx; resolves with exit code and combined output (signing keys never leave the server). */
function runScript(args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const p = spawn("npx", ["tsx", ...args], { cwd: ROOT, env: process.env });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code: code ?? 1, out: out.replace(/^\[arc\].*\n/gm, "") }));
  });
}

const REF = /^SHP-\d{4}$/;
const WHO = /^(a|b|unapproved)$/;
const NUM = /^\d+(\.\d+)?$/;
type Body = { action?: string; ref?: string; who?: string; usd?: string; outcome?: string; deadlineMins?: string };

/** Whitelisted demo actions → CLI invocations. Anything else is rejected. */
function plan(b: Body): string[][] | string {
  const off = (...a: string[]) => ["scripts/offering.ts", ...a];
  if (!b.ref || !REF.test(b.ref)) return "invalid shipment ref";
  const who = b.who ?? "";
  switch (b.action) {
    case "create":
      if (b.deadlineMins && !NUM.test(b.deadlineMins)) return "invalid deadline";
      return [off("handover", b.ref), off("create", b.ref, "--deadline-mins", b.deadlineMins ?? "120")];
    case "approve":
      if (!/^(a|b)$/.test(who)) return "only investors A and B can be approved";
      return [off("trustlines", b.ref), off("approve", b.ref, who)];
    case "subscribe":
      if (!WHO.test(who) || !b.usd || !NUM.test(b.usd)) return "invalid subscription";
      return [off("trustlines", b.ref), off("subscribe", b.ref, who, b.usd)];
    case "fund":
    case "sweep":
    case "attest-outcome":
    case "start-refunds":
      return [off(b.action, b.ref)];
    case "distribute":
      if (!b.usd || !NUM.test(b.usd) || !/^[1-5]$/.test(b.outcome ?? "")) return "invalid distribution";
      return [off("distribute", b.ref, b.usd, b.outcome!)];
    case "redeem":
    case "refund":
      if (!/^(a|b)$/.test(who)) return "invalid investor";
      return [off(b.action, b.ref, who)];
    default:
      return "unknown action";
  }
}

/** Dev-only API: lets the dashboard drive real testnet transactions through the same scripts as the CLI. */
function demoApi(): Plugin {
  // One action at a time: concurrent transactions from the same account would collide on sequence numbers.
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T,>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(fn, fn);
    queue = next.catch(() => undefined);
    return next;
  };
  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  };
  const readBody = (req: IncomingMessage) =>
    new Promise<Body>((resolve) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        try {
          resolve(JSON.parse(raw || "{}"));
        } catch {
          resolve({});
        }
      });
    });
  return {
    name: "pot-demo-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/health", (_req, res) => send(res, 200, { interactive: true }));
      server.middlewares.use("/api/refresh", async (_req, res) => {
        const r = await enqueue(() => runScript(["scripts/export-public.ts"]));
        send(res, r.code ? 500 : 200, { ok: !r.code, log: r.out });
      });
      server.middlewares.use("/api/action", async (req, res) => {
        if (req.method !== "POST") return send(res, 405, { ok: false, log: "POST only" });
        const steps = plan(await readBody(req));
        if (typeof steps === "string") return send(res, 400, { ok: false, log: steps });
        const job = async () => {
          let log = "";
          for (const s of steps) {
            const r = await runScript(s);
            log += r.out;
            if (r.code) return { ok: false, log };
          }
          await runScript(["scripts/export-public.ts"]);
          return { ok: true, log };
        };
        const result = await enqueue(job);
        send(res, 200, result);
      });
    },
  };
}

export default defineConfig({ plugins: [react(), demoApi()] });
