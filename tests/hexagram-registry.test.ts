import { describe, expect, it } from "vitest";
import { Clarinet, Tx, types } from "clarinet-sdk";

// Define common hexagram patterns for testing
const YOUNG_YANG = 7; // Solid line
const YOUNG_YIN = 8;   // Broken line
const OLD_YANG = 9;    // Changing solid line
const OLD_YIN = 6;     // Changing broken line

const accounts = Clarinet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet_1 = accounts.get("wallet_1")!;
const wallet_2 = accounts.get("wallet_2")!;

describe("Hexagram Registry Tests", () => {
  it("should allow submitting a valid hexagram", () => {
    const hexagram = [
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG)
    ];

    const timestamp = Math.floor(Date.now() / 1000);

    const receipt = Clarinet.mineBlock([
      Tx.contractCall(
        "hexagram-registry",
        "submit-hexagram",
        [
          types.list(hexagram),
          types.uint(timestamp)
        ],
        wallet_1
      )
    ])[0];

    expect(receipt.result).toBeOk(types.uint(1));
  });

  it("should reject invalid hexagram with invalid line values", () => {
    const invalidHexagram = [
      types.uint(5),  // Invalid line value
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG)
    ];

    const timestamp = Math.floor(Date.now() / 1000);

    const receipt = Clarinet.mineBlock([
      Tx.contractCall(
        "hexagram-registry",
        "submit-hexagram",
        [
          types.list(invalidHexagram),
          types.uint(timestamp)
        ],
        wallet_1
      )
    ])[0];

    expect(receipt.result).toBeErr(types.uint(2));
  });

  it("should store and retrieve a submitted hexagram", () => {
    const hexagram = [
      types.uint(OLD_YANG),    // Line 1: Old Yang
      types.uint(OLD_YIN),     // Line 2: Old Yin
      types.uint(YOUNG_YANG),  // Line 3: Young Yang
      types.uint(YOUNG_YIN),   // Line 4: Young Yin
      types.uint(YOUNG_YANG),  // Line 5: Young Yang
      types.uint(YOUNG_YIN)    // Line 6: Young Yin
    ];

    const timestamp = Math.floor(Date.now() / 1000);

    const submitReceipt = Clarinet.mineBlock([
      Tx.contractCall(
        "hexagram-registry",
        "submit-hexagram",
        [
          types.list(hexagram),
          types.uint(timestamp)
        ],
        wallet_1
      )
    ])[0];

    expect(submitReceipt.result).toBeOk();

    const hexagramId = parseInt((submitReceipt.result as any).value.value);

    const getReceipt = Clarinet.mineBlock([
      Tx.contractCall(
        "hexagram-registry",
        "get-hexagram-by-owner-and-id",
        [types.principal(wallet_1), types.uint(hexagramId)],
        wallet_1
      )
    ])[0];

    expect(getReceipt.result).toMatchSnapshot();
  });

  it("should track multiple hexagrams for the same owner", () => {
    const firstHexagram = [
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG)
    ];

    const secondHexagram = [
      types.uint(YOUNG_YIN),
      types.uint(YOUNG_YIN),
      types.uint(YOUNG_YIN),
      types.uint(YOUNG_YIN),
      types.uint(YOUNG_YIN),
      types.uint(YOUNG_YIN)
    ];

    const timestamp = Math.floor(Date.now() / 1000);

    const receipt1 = Clarinet.mineBlock([
      Tx.contractCall(
        "hexagram-registry",
        "submit-hexagram",
        [
          types.list(firstHexagram),
          types.uint(timestamp)
        ],
        wallet_1
      )
    ])[0];

    expect(receipt1.result).toBeOk();

    const receipt2 = Clarinet.mineBlock([
      Tx.contractCall(
        "hexagram-registry",
        "submit-hexagram",
        [
          types.list(secondHexagram),
          types.uint(timestamp)
        ],
        wallet_1
      )
    ])[0];

    expect(receipt2.result).toBeOk();

    const getAllReceipt = Clarinet.mineBlock([
      Tx.contractCall(
        "hexagram-registry",
        "get-hexagrams-by-owner",
        [types.principal(wallet_1)],
        wallet_1
      )
    ])[0];

    expect(getAllReceipt.result).toMatchSnapshot();
  });

  it("should get the current ID correctly", () => {
    const receipt = Clarinet.mineBlock([
      Tx.contractCall(
        "hexagram-registry",
        "get-current-id",
        [],
        wallet_1
      )
    ])[0];

    expect(receipt.result).toMatchSnapshot();
  });
});
