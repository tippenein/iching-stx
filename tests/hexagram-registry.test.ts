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
  it("should allow submitting a valid hexagram pair", () => {
    // Create a sample hexagram (young yang lines)
    const originalHexagram = [
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG), 
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG)
    ];
    
    // Transformed hexagram (for this example, same as original)
    const transformedHexagram = [
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG), 
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG)
    ];
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Submit the hexagram pair
    const receipt = Clarinet.mineBlock([
      Tx.contractCall(
        "hexagram-registry",
        "submit-hexagram-pair",
        [
          types.list(originalHexagram),
          types.list(transformedHexagram),
          types.uint(timestamp)
        ],
        wallet_1
      )
    ])[0];
    
    expect(receipt.result).toBeOk(types.uint(1));
  });

  it("should reject invalid hexagram with invalid line values", () => {
    // Create a hexagram with an invalid line value (5 is not valid)
    const invalidHexagram = [
      types.uint(5),  // Invalid line value
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG)
    ];
    
    const validHexagram = [
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG)
    ];
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Try to submit with invalid hexagram
    const receipt = Clarinet.mineBlock([
      Tx.contractCall(
        "hexagram-registry",
        "submit-hexagram-pair",
        [
          types.list(invalidHexagram),
          types.list(validHexagram),
          types.uint(timestamp)
        ],
        wallet_1
      )
    ])[0];
    
    expect(receipt.result).toBeErr(types.uint(2)); // Should return error code 2 for invalid hexagram
  });

  it("should store and retrieve a submitted hexagram", () => {
    // Create a hexagram with changing lines (old yang and old yin)
    const originalHexagram = [
      types.uint(OLD_YANG),  // Line 1: Old Yang (changing to Yin)
      types.uint(OLD_YIN),   // Line 2: Old Yin (changing to Yang)
      types.uint(YOUNG_YANG), // Line 3: Young Yang (unchanging)
      types.uint(YOUNG_YIN),  // Line 4: Young Yin (unchanging)
      types.uint(YOUNG_YANG), // Line 5: Young Yang (unchanging)
      types.uint(YOUNG_YIN)   // Line 6: Young Yin (unchanging)
    ];
    
    // When transformed, old yang becomes yin, old yin becomes yang
    const transformedHexagram = [
      types.uint(YOUNG_YIN),  // Line 1: Was Old Yang, now Yin
      types.uint(YOUNG_YANG), // Line 2: Was Old Yin, now Yang
      types.uint(YOUNG_YANG), // Line 3: Unchanged
      types.uint(YOUNG_YIN),  // Line 4: Unchanged
      types.uint(YOUNG_YANG), // Line 5: Unchanged
      types.uint(YOUNG_YIN)   // Line 6: Unchanged
    ];
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Submit the hexagram pair
    const submitReceipt = Clarinet.mineBlock([
      Tx.contractCall(
        "hexagram-registry",
        "submit-hexagram-pair",
        [
          types.list(originalHexagram),
          types.list(transformedHexagram),
          types.uint(timestamp)
        ],
        wallet_1
      )
    ])[0];
    
    expect(submitReceipt.result).toBeOk();
    
    // Retrieve the hexagram by ID
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
    // Submit first hexagram
    const firstHexagram = [
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG),
      types.uint(YOUNG_YANG)
    ];
    
    const timestamp1 = Math.floor(Date.now() / 1000);
    
    const receipt1 = Clarinet.mineBlock([
      Tx.contractCall(
        "hexagram-registry",
        "submit-hexagram-pair",
        [
          types.list(firstHexagram),
          types.list(firstHexagram),
          types.uint(timestamp1)
        ],
        wallet_1
      )
    ])[0];
    
    expect(receipt1.result).toBeOk();
    
    // Submit second hexagram
    const secondHexagram = [
      types.uint(YOUNG_YIN),
      types.uint(YOUNG_YIN),
      types.uint(YOUNG_YIN),
      types.uint(YOUNG_YIN),
      types.uint(YOUNG_YIN),
      types.uint(YOUNG_YIN)
    ];
    
    const timestamp2 = Math.floor(Date.now() / 1000);
    
    const receipt2 = Clarinet.mineBlock([
      Tx.contractCall(
        "hexagram-registry",
        "submit-hexagram-pair",
        [
          types.list(secondHexagram),
          types.list(secondHexagram),
          types.uint(timestamp2)
        ],
        wallet_1
      )
    ])[0];
    
    expect(receipt2.result).toBeOk();
    
    // Get all hexagrams for the owner
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