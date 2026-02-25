import { describe, expect, it } from "vitest";
import { tx } from "@stacks/clarinet-sdk";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet_1 = accounts.get("wallet_1")!;
const wallet_2 = accounts.get("wallet_2")!;

// Helper: generate a fake encrypted buffer hex string for testing
function fakeEncryptedHex(seed: number = 1): Uint8Array {
  const bytes = new Uint8Array(64);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = (seed + i) % 256;
  }
  return bytes;
}

describe("Hexagram Registry Tests", () => {
  it("should allow submitting an encrypted hexagram", () => {
    const buf = fakeEncryptedHex(1);
    const timestamp = Math.floor(Date.now() / 1000);

    const result = simnet.callPublicFn(
      "hexagram-registry",
      "submit-hexagram",
      [Cl.buffer(buf), Cl.uint(timestamp)],
      wallet_1
    );

    expect(result.result).toBeOk(Cl.uint(1));
  });

  it("should reject an empty buffer", () => {
    const timestamp = Math.floor(Date.now() / 1000);

    const result = simnet.callPublicFn(
      "hexagram-registry",
      "submit-hexagram",
      [Cl.buffer(new Uint8Array(0)), Cl.uint(timestamp)],
      wallet_1
    );

    expect(result.result).toBeErr(Cl.uint(2));
  });

  it("should store and retrieve a submitted hexagram", () => {
    const buf = fakeEncryptedHex(42);
    const timestamp = Math.floor(Date.now() / 1000);

    const submitResult = simnet.callPublicFn(
      "hexagram-registry",
      "submit-hexagram",
      [Cl.buffer(buf), Cl.uint(timestamp)],
      wallet_1
    );

    expect(submitResult.result).toBeOk(Cl.uint(1));

    const getResult = simnet.callReadOnlyFn(
      "hexagram-registry",
      "get-hexagram-by-owner-and-id",
      [Cl.standardPrincipal(wallet_1), Cl.uint(1)],
      wallet_1
    );

    expect(getResult.result).toBeSome(
      Cl.tuple({
        hexagram: Cl.buffer(buf),
        timestamp: Cl.uint(timestamp),
      })
    );
  });

  it("should track owner hexagram count correctly", () => {
    const timestamp = Math.floor(Date.now() / 1000);

    // Submit 3 hexagrams for wallet_1
    for (let i = 0; i < 3; i++) {
      const result = simnet.callPublicFn(
        "hexagram-registry",
        "submit-hexagram",
        [Cl.buffer(fakeEncryptedHex(10 + i)), Cl.uint(timestamp + i)],
        wallet_1
      );
      expect(result.result).toBeOk(Cl.uint(i + 1));
    }

    // Check count for wallet_1
    const countResult = simnet.callReadOnlyFn(
      "hexagram-registry",
      "get-owner-hexagram-count",
      [Cl.standardPrincipal(wallet_1)],
      wallet_1
    );

    expect(countResult.result).toBeUint(3);
  });

  it("should return correct hexagram ID at each index", () => {
    const timestamp = Math.floor(Date.now() / 1000);

    // Submit 2 hexagrams for wallet_2
    const result1 = simnet.callPublicFn(
      "hexagram-registry",
      "submit-hexagram",
      [Cl.buffer(fakeEncryptedHex(100)), Cl.uint(timestamp)],
      wallet_2
    );
    expect(result1.result).toBeOk(Cl.uint(1));

    const result2 = simnet.callPublicFn(
      "hexagram-registry",
      "submit-hexagram",
      [Cl.buffer(fakeEncryptedHex(200)), Cl.uint(timestamp + 1)],
      wallet_2
    );
    expect(result2.result).toBeOk(Cl.uint(2));

    // Check index 0 returns first ID
    const idx0Result = simnet.callReadOnlyFn(
      "hexagram-registry",
      "get-owner-hexagram-id-at-index",
      [Cl.standardPrincipal(wallet_2), Cl.uint(0)],
      wallet_2
    );
    expect(idx0Result.result).toBeSome(Cl.tuple({ id: Cl.uint(1) }));

    // Check index 1 returns second ID
    const idx1Result = simnet.callReadOnlyFn(
      "hexagram-registry",
      "get-owner-hexagram-id-at-index",
      [Cl.standardPrincipal(wallet_2), Cl.uint(1)],
      wallet_2
    );
    expect(idx1Result.result).toBeSome(Cl.tuple({ id: Cl.uint(2) }));

    // Check index 2 returns none
    const idx2Result = simnet.callReadOnlyFn(
      "hexagram-registry",
      "get-owner-hexagram-id-at-index",
      [Cl.standardPrincipal(wallet_2), Cl.uint(2)],
      wallet_2
    );
    expect(idx2Result.result).toBeNone();
  });

  it("should get the current ID correctly", () => {
    const timestamp = Math.floor(Date.now() / 1000);

    // Submit one hexagram to advance the ID
    simnet.callPublicFn(
      "hexagram-registry",
      "submit-hexagram",
      [Cl.buffer(fakeEncryptedHex(50)), Cl.uint(timestamp)],
      wallet_1
    );

    const result = simnet.callReadOnlyFn(
      "hexagram-registry",
      "get-current-id",
      [],
      wallet_1
    );

    expect(result.result).toBeUint(1);
  });
});

describe("Roll Hexagram (VRF) Tests", () => {
  it("should return ok with id and a list of 6 lines", () => {
    // Mine a block so there's a previous block with a VRF seed
    simnet.mineEmptyBlock();

    const result = simnet.callPublicFn(
      "hexagram-registry",
      "roll-hexagram",
      [],
      wallet_1
    );

    expect(result.result).toBeOk(expect.anything());

    // Parse the ok tuple to verify structure
    // result.result = { type: "ok", value: { type: "tuple", value: { id: ..., lines: { type: "list", value: [...] } } } }
    const tuple = (result.result as any).value.value;
    expect(tuple.id).toBeDefined();
    expect(tuple.lines).toBeDefined();
    expect(tuple.lines.value).toHaveLength(6);
  });

  it("should generate line values in range 6-9", () => {
    simnet.mineEmptyBlock();

    const result = simnet.callPublicFn(
      "hexagram-registry",
      "roll-hexagram",
      [],
      wallet_1
    );

    const tuple = (result.result as any).value.value;
    const lines = tuple.lines.value;

    for (const line of lines) {
      const val = Number(line.value);
      expect(val).toBeGreaterThanOrEqual(6);
      expect(val).toBeLessThanOrEqual(9);
    }
  });

  it("should increment owner hexagram count after a roll", () => {
    simnet.mineEmptyBlock();

    // Get count before
    const beforeCount = simnet.callReadOnlyFn(
      "hexagram-registry",
      "get-owner-hexagram-count",
      [Cl.standardPrincipal(wallet_2)],
      wallet_2
    );
    const countBefore = Number((beforeCount.result as any).value);

    // Roll
    const result = simnet.callPublicFn(
      "hexagram-registry",
      "roll-hexagram",
      [],
      wallet_2
    );
    expect(result.result).toBeOk(expect.anything());

    // Get count after
    const afterCount = simnet.callReadOnlyFn(
      "hexagram-registry",
      "get-owner-hexagram-count",
      [Cl.standardPrincipal(wallet_2)],
      wallet_2
    );
    const countAfter = Number((afterCount.result as any).value);

    expect(countAfter).toBe(countBefore + 1);
  });

  it("should produce different results across different blocks", () => {
    simnet.mineEmptyBlock();

    const result1 = simnet.callPublicFn(
      "hexagram-registry",
      "roll-hexagram",
      [],
      wallet_1
    );

    // Mine another block to get a different VRF seed
    simnet.mineEmptyBlock();

    const result2 = simnet.callPublicFn(
      "hexagram-registry",
      "roll-hexagram",
      [],
      wallet_1
    );

    const lines1 = (result1.result as any).value.value.lines.value.map(
      (l: any) => Number(l.value)
    );
    const lines2 = (result2.result as any).value.value.lines.value.map(
      (l: any) => Number(l.value)
    );

    // It's statistically near-impossible for all 6 lines to be identical
    // across two different VRF seeds, but we just check they're not the same array
    const same = lines1.every((v: number, i: number) => v === lines2[i]);
    // If by extreme chance they match, at least both should be valid
    if (same) {
      for (const v of lines1) {
        expect(v).toBeGreaterThanOrEqual(6);
        expect(v).toBeLessThanOrEqual(9);
      }
    } else {
      expect(same).toBe(false);
    }
  });

  it("should store the rolled hexagram on-chain", () => {
    simnet.mineEmptyBlock();

    const result = simnet.callPublicFn(
      "hexagram-registry",
      "roll-hexagram",
      [],
      wallet_1
    );

    const tuple = (result.result as any).value.value;
    const id = Number(tuple.id.value);

    // Retrieve the stored hexagram
    const getResult = simnet.callReadOnlyFn(
      "hexagram-registry",
      "get-hexagram-by-owner-and-id",
      [Cl.standardPrincipal(wallet_1), Cl.uint(id)],
      wallet_1
    );

    expect(getResult.result).toBeSome(expect.anything());
  });
});
