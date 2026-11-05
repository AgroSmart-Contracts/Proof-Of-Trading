import { afterEach, describe, expect, it } from "vitest";
import { CIRCLE_TESTNET_USDC, settlementAsset } from "../src/settlement.js";

describe("settlementAsset", () => {
  const saved = process.env.SETTLEMENT_ASSET;
  afterEach(() => {
    if (saved === undefined) delete process.env.SETTLEMENT_ASSET;
    else process.env.SETTLEMENT_ASSET = saved;
  });

  it("defaults to Circle testnet USDC and its known SAC", () => {
    delete process.env.SETTLEMENT_ASSET;
    expect(settlementAsset()).toEqual({
      ...CIRCLE_TESTNET_USDC,
      sac_id: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    });
  });

  it("reads CODE:ISSUER from SETTLEMENT_ASSET", () => {
    process.env.SETTLEMENT_ASSET = "TUSDC:GBV6QFVVWJHJHZUWCZPGEZFEEE74YKLWESZ5QP353V2PDZM3OPB2SVZM";
    expect(settlementAsset().sac_id).toBe("CC3GZE5HDQGVXAMGRSERDGQPQUQH64ZVRMXUZ7KQZ6M5DUVF2WTVT2D6");
  });

  it("rejects a malformed value", () => {
    process.env.SETTLEMENT_ASSET = "USDC";
    expect(() => settlementAsset()).toThrow(/CODE:ISSUER/);
  });
});
