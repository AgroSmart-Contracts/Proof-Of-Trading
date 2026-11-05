import { describe, expect, it } from "vitest";
import { renderStellarToml } from "../src/stellar-toml.js";

const issuer = "GCGN654QTVW22WCIUFF3CSGHHHPQQ2L4AG7LQHUZQ4FKB4BWSF4R3W3F";
const base = {
  networkPassphrase: "Test SDF Network ; September 2015",
  issuer,
  org: { name: "TruMarket", url: "https://trumarket.tech", description: 'Insured "trade" receivables' },
  shares: [
    {
      shipment_ref: "SHP-0247", code: "TM0247", issuer, sac_id: "CCUFHZ634GXOIDRDQVSL2OQCQBRQIGUFIBKHX5NA5P26N44COZSE5JVE",
      proof_hash: "64901e64", face_value_usd: 100000, commodity: "avocado", destination_region: "EU",
    },
  ],
};

describe("renderStellarToml", () => {
  it("writes the issuer, organization and one CURRENCIES entry per share asset", () => {
    const toml = renderStellarToml(base);
    expect(toml).toContain(`ACCOUNTS = ["${issuer}"]`);
    expect(toml).toContain('NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"');
    expect(toml.match(/\[\[CURRENCIES\]\]/g)).toHaveLength(1);
    expect(toml).toContain('code = "TM0247"');
    expect(toml).toContain('contract = "CCUFHZ634GXOIDRDQVSL2OQCQBRQIGUFIBKHX5NA5P26N44COZSE5JVE"');
    expect(toml).toContain('status = "test"');
    expect(toml).toContain("max_number = 100000");
    expect(toml).toContain("(avocado to EU)");
  });

  it("escapes quotes and leaves the email out unless given", () => {
    const toml = renderStellarToml(base);
    expect(toml).toContain('ORG_DESCRIPTION = "Insured \\"trade\\" receivables"');
    expect(toml).not.toContain("ORG_OFFICIAL_EMAIL");
  });

  it("refuses share assets from another issuer", () => {
    const other = { ...base, shares: [{ ...base.shares[0], issuer: "GBV6QFVVWJHJHZUWCZPGEZFEEE74YKLWESZ5QP353V2PDZM3OPB2SVZM" }] };
    expect(() => renderStellarToml(other)).toThrow(/issuer/);
  });
});
