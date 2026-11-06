// The legal entity that holds partner accounts (Bridge virtual accounts, Koywe payouts).
// ACCOUNT_HOLDER=Agro Smart Contracts Lda (default) until the SPV is incorporated; ACCOUNT_HOLDER=spv
// switches to the SPV, named by SPV_LEGAL_NAME.
export const DEFAULT_ACCOUNT_HOLDER = "Agro Smart Contracts Lda";
export const SPV_PLACEHOLDER = "Receivables-portfolio SPV (updated when the SPV is incorporated)";

export function accountHolder(env: Record<string, string | undefined> = process.env): { name: string; kind: "operator" | "spv" } {
  const v = env.ACCOUNT_HOLDER?.trim();
  if (v && v.toLowerCase() === "spv") return { name: env.SPV_LEGAL_NAME?.trim() || SPV_PLACEHOLDER, kind: "spv" };
  return { name: v || DEFAULT_ACCOUNT_HOLDER, kind: "operator" };
}
