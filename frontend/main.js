// Import Stacks libraries
import {
  makeContractCall,
  broadcastTransaction,
  uintCV,
  bufferCV,
  AnchorMode,
  PostConditionMode,
  getAddressFromPublicKey,
} from "@stacks/transactions";

import { STACKS_DEVNET, STACKS_MAINNET } from "@stacks/network";

import {
  encryptContent,
  decryptContent,
  getPublicKeyFromPrivate,
} from "@stacks/encryption";

// @stacks/connect is dynamically imported to reduce initial bundle size
let _stacksConnect = null;
async function getStacksConnect() {
  if (!_stacksConnect) {
    _stacksConnect = await import("@stacks/connect");
  }
  return _stacksConnect;
}

// Configuration constants
const CONTRACT_CONFIG = {
  devnet: {
    address: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    name: "hexagram-registry",
  },
  mainnet: {
    address: "SPZW1F5W7XT81NV8B8SHA71S1YJ04V76HQBPNQ5Z",
    name: "hexagram-registry",
  },
};

// Deployer private key — used ONLY on devnet (localhost)
const DEVNET_DEPLOYER_KEY =
  "753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601";

// Utility functions
function isDevnet() {
  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function getCurrentNetwork() {
  return isDevnet() ? "devnet" : "mainnet";
}

function getNetworkConfig() {
  return isDevnet() ? STACKS_DEVNET : STACKS_MAINNET;
}

function getContractConfig() {
  return CONTRACT_CONFIG[getCurrentNetwork()];
}

// I Ching App Class
class IChingApp {
  constructor() {
    this.currentHexagram = [];
    this.transformedHexagram = [];
    this.isAuthenticated = false;
    this.currentAddress = null;
    this.recordValues = [null, null, null, null, null, null];
    this.appPrivateKey = null;
    this.appPublicKey = null;

    console.log(`Divining...`);

    this.initializeElements();
    this.bindEvents();
    this.createRecordCircles();
    this.updatePreviewFromRecord();
    this.loadHistory();
    this.restoreSession().then(() => this.updateUI());
  }

  initializeElements() {
    this.connectBtn = document.getElementById("connect-btn");
    this.submitBtn = document.getElementById("submit-btn");
    this.addressDisplay = document.getElementById("address-display");
    this.currentHexagramDiv = document.getElementById("current-hexagram");
    this.transformedHexagramDiv = document.getElementById(
      "transformed-hexagram",
    );
    this.historyDiv = document.getElementById("hexagram-history");
    this.recordLinesDiv = document.getElementById("record-lines");
  }

  bindEvents() {
    this.connectBtn.addEventListener("click", () => this.handleConnect());
    this.submitBtn.addEventListener("click", () => this.submitToBlockchain());
  }

  updateUI() {
    if (this.isAuthenticated && this.currentAddress) {
      this.addressDisplay.textContent = this.currentAddress;
      this.connectBtn.textContent = "Disconnect";
      this.submitBtn.disabled = false;
    } else {
      this.addressDisplay.textContent = "Not connected";
      this.connectBtn.textContent = "Connect Wallet";
      this.submitBtn.disabled = true;
    }
  }

  async restoreSession() {
    if (isDevnet()) {
      const saved = localStorage.getItem("stacks-session");
      if (saved) {
        try {
          const authData = JSON.parse(saved);
          const address = authData.profile?.stxAddress?.testnet;
          if (address) {
            this.isAuthenticated = true;
            this.currentAddress = address;
          }
        } catch (e) {
          localStorage.removeItem("stacks-session");
        }
      }
    } else {
      const { isConnected, getLocalStorage } = await getStacksConnect();
      if (isConnected()) {
        const data = getLocalStorage();
        const stxAddr = data?.addresses?.stx?.[0]?.address;
        if (stxAddr) {
          this.isAuthenticated = true;
          this.currentAddress = stxAddr;
        }
      }
    }
  }

  async handleConnect() {
    if (this.isAuthenticated) {
      this.logout();
      return;
    }

    if (isDevnet()) {
      // Demo wallet for local devnet testing
      const demoAddress =
        "ST1DEMO" + Math.random().toString(36).substring(2, 8).toUpperCase();
      this.isAuthenticated = true;
      this.currentAddress = demoAddress;
      localStorage.setItem(
        "stacks-session",
        JSON.stringify({
          profile: { stxAddress: { testnet: demoAddress } },
        }),
      );
      this.updateUI();
    } else {
      // Real wallet connection (Leather / Xverse)
      try {
        const { connect } = await getStacksConnect();
        const result = await connect();
        const stxEntry = result.addresses.find((a) => a.symbol === "STX")
          || result.addresses[0];
        if (stxEntry?.address) {
          this.isAuthenticated = true;
          this.currentAddress = stxEntry.address;
          if (stxEntry.publicKey) {
            this.appPublicKey = this.resolveCompressedPublicKey(
              stxEntry.publicKey,
              stxEntry.address,
            );
          }
          this.updateUI();
        }
      } catch (error) {
        console.error("Wallet connection failed:", error);
      }
    }
  }

  async logout() {
    this.isAuthenticated = false;
    this.currentAddress = null;
    this.appPrivateKey = null;
    this.appPublicKey = null;
    if (!isDevnet()) {
      const { disconnect } = await getStacksConnect();
      disconnect();
    }
    localStorage.removeItem("stacks-session");
    this.updateUI();
  }

  resolveCompressedPublicKey(rawKey, address) {
    // Strip 0x prefix if present
    let key = rawKey.startsWith("0x") ? rawKey.slice(2) : rawKey;

    // Already a valid compressed (66) or uncompressed (130) key
    if (key.length === 66 || key.length === 130) return key;

    // Raw 32-byte x-coordinate (64 chars) — need to find correct prefix
    if (key.length === 64) {
      for (const prefix of ["02", "03"]) {
        const candidate = prefix + key;
        const derived = getAddressFromPublicKey(candidate, "mainnet");
        if (derived === address) return candidate;
      }
      // Fallback to 02 if address check fails (e.g. testnet address format)
      return "02" + key;
    }

    return key;
  }

  getEncryptionPublicKey() {
    if (this.appPublicKey) return this.appPublicKey;
    if (isDevnet()) return getPublicKeyFromPrivate(DEVNET_DEPLOYER_KEY);
    throw new Error("No encryption key available. Please connect your wallet.");
  }

  getDecryptionPrivateKey() {
    if (this.appPrivateKey) return this.appPrivateKey;
    if (isDevnet()) return DEVNET_DEPLOYER_KEY;
    throw new Error("No decryption key available. Please connect your wallet.");
  }

  async encryptHexagram(values) {
    const json = JSON.stringify(values);
    const publicKey = this.getEncryptionPublicKey();
    const cipherText = await encryptContent(json, { publicKey });
    return cipherText;
  }

  async decryptHexagram(cipherText) {
    const privateKey = this.getDecryptionPrivateKey();
    const json = await decryptContent(cipherText, { privateKey });
    return JSON.parse(json);
  }

  displayHexagram(hexagram, container, label) {
    container.innerHTML = "";

    const allFilled = hexagram.every((v) => v !== null);
    if (!allFilled) {
      container.classList.add("grayed-out");
    } else {
      container.classList.remove("grayed-out");
    }

    const labelDiv = document.createElement("div");
    labelDiv.className = "hexagram-label";
    labelDiv.textContent = label;
    container.appendChild(labelDiv);

    for (let i = 0; i < hexagram.length; i++) {
      const lineValue = hexagram[i];
      const lineDiv = document.createElement("div");
      lineDiv.className = "hexagram-line";

      if (lineValue === null) {
        lineDiv.classList.add("placeholder");
        lineDiv.innerHTML = `<div class="placeholder-line"></div>`;
      } else if (lineValue === 6 || lineValue === 8) {
        lineDiv.innerHTML = `
          <div class="broken-line">
            <div class="broken-line-part"></div>
            <div class="broken-line-part"></div>
          </div>
        `;
      } else {
        lineDiv.innerHTML = `
          <div class="solid-line"></div>
        `;
      }

      container.appendChild(lineDiv);
    }

    const numberDiv = document.createElement("div");
    numberDiv.className = "hexagram-number";
    if (allFilled) {
      const binary = this.toBinary(hexagram);
      numberDiv.textContent = this.hexagramNumber(binary);
    } else {
      numberDiv.textContent = "—";
    }
    container.appendChild(numberDiv);
  }

  createRecordCircles() {
    this.recordLinesDiv.innerHTML = "";

    for (let i = 0; i < 6; i++) {
      const row = document.createElement("div");
      row.className = "record-row";

      const lineLabel = document.createElement("span");
      lineLabel.className = "record-line-label";
      lineLabel.textContent = i + 1;
      row.appendChild(lineLabel);

      const value = this.recordValues[i];
      const circle = document.createElement("div");

      if (value === null) {
        circle.className = "record-circle unfilled";
        circle.textContent = "—";
      } else {
        circle.className = `record-circle ${this.isChangingLine(value) ? "changing" : "stable"}`;
        circle.textContent = value;
      }

      circle.addEventListener("click", () => this.cycleRecordValue(i));
      row.appendChild(circle);

      const typeLabel = document.createElement("span");
      typeLabel.className = "record-type-label";
      typeLabel.textContent = value === null ? "" : this.getLineTypeName(value);
      row.appendChild(typeLabel);

      this.recordLinesDiv.appendChild(row);
    }
  }

  cycleRecordValue(index) {
    const cycle = [6, 7, 8, 9];
    if (this.recordValues[index] === null) {
      this.recordValues[index] = cycle[0];
    } else {
      const nextIndex =
        (cycle.indexOf(this.recordValues[index]) + 1) % cycle.length;
      this.recordValues[index] = cycle[nextIndex];
    }
    this.createRecordCircles();
    this.updatePreviewFromRecord();
  }

  updatePreviewFromRecord() {
    this.currentHexagram = [...this.recordValues];
    this.transformedHexagram = this.recordValues.map((v) =>
      v === null ? null : this.getTransformedValue(v),
    );
    this.displayHexagram(
      this.currentHexagram,
      this.currentHexagramDiv,
      "Current Hexagram",
    );
    this.displayHexagram(
      this.transformedHexagram,
      this.transformedHexagramDiv,
      "Future Hexagram",
    );
    const allFilled = this.recordValues.every((v) => v !== null);
    this.submitBtn.disabled = !this.isAuthenticated || !allFilled;
  }

  getTransformedValue(value) {
    switch (value) {
      case 6:
        return 7;
      case 7:
        return 7;
      case 8:
        return 8;
      case 9:
        return 8;
      default:
        return value;
    }
  }

  getLineTypeName(value) {
    switch (value) {
      case 6:
        return "Old Yin (Changing)";
      case 7:
        return "Young Yang";
      case 8:
        return "Young Yin";
      case 9:
        return "Old Yang (Changing)";
      default:
        return "";
    }
  }

  isChangingLine(value) {
    return value === 6 || value === 9;
  }

  async submitToBlockchain() {
    if (!this.isAuthenticated) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      console.log(
        `Submitting hexagram to ${getCurrentNetwork()} blockchain...`,
      );

      const contractConfig = getContractConfig();

      // Encrypt hexagram data before submitting
      const cipherText = await this.encryptHexagram(this.currentHexagram);
      const cipherBytes = new TextEncoder().encode(cipherText);
      const hexagramCV = bufferCV(cipherBytes);
      const timestampCV = uintCV(Math.floor(Date.now() / 1000));

      if (isDevnet()) {
        // Devnet: sign directly with deployer key
        const networkConfig = getNetworkConfig();
        const txOptions = {
          contractAddress: contractConfig.address,
          contractName: contractConfig.name,
          functionName: "submit-hexagram",
          functionArgs: [hexagramCV, timestampCV],
          senderKey: DEVNET_DEPLOYER_KEY,
          network: networkConfig,
          anchorMode: AnchorMode.Any,
          postConditionMode: PostConditionMode.Allow,
        };

        const transaction = await makeContractCall(txOptions);
        const broadcastResponse = await broadcastTransaction({
          transaction,
          network: networkConfig,
        });

        if (broadcastResponse.error) {
          throw new Error(broadcastResponse.reason || broadcastResponse.error);
        }

        this.saveHexagramRecord(broadcastResponse.txid || broadcastResponse);
        console.log(`Transaction successful: ${broadcastResponse.txid}`);
        alert(
          `Hexagram submitted to blockchain!\n\nTX ID: ${broadcastResponse.txid}`,
        );
      } else {
        // Mainnet: wallet signs the transaction
        const { request } = await getStacksConnect();
        const result = await request("stx_callContract", {
          contract: `${contractConfig.address}.${contractConfig.name}`,
          functionName: "submit-hexagram",
          functionArgs: [hexagramCV, timestampCV],
          network: "mainnet",
          postConditionMode: "allow",
        });

        if (result.txid) {
          this.saveHexagramRecord(result.txid);
          console.log(`Transaction successful: ${result.txid}`);
          alert(`Hexagram submitted to blockchain!\n\nTX ID: ${result.txid}`);
        }
      }
    } catch (error) {
      console.error("Error submitting to blockchain:", error);
      const msg = error?.message || error?.reason_data || JSON.stringify(error);
      alert("Error submitting to blockchain: " + msg);
    }
  }

  saveHexagramRecord(txId) {
    const hexagramRecord = {
      id: Date.now(),
      original: [...this.currentHexagram],
      timestamp: Date.now(),
      date: new Date().toISOString(),
      txId: txId,
      network: getCurrentNetwork(),
    };

    const records = JSON.parse(localStorage.getItem("ichingRecords") || "[]");
    records.push(hexagramRecord);
    localStorage.setItem("ichingRecords", JSON.stringify(records));
    this.loadHistory();
  }

  toBinary(values) {
    return values.map((v) => (v === 7 || v === 9 ? 1 : 0));
  }

  hexagramNumber(binaryValues) {
    // King Wen sequence lookup via upper/lower trigrams
    // Trigram binary (yang=1 yin=0, LSB=bottom line) → index in table
    // Order: Qian(7)=0, Kun(0)=1, Zhen(1)=2, Kan(2)=3, Gen(4)=4, Xun(6)=5, Li(5)=6, Dui(3)=7
    const trigramIndex = [1, 2, 3, 7, 4, 6, 5, 0];
    const kingWen = [
      [ 1, 11, 34,  5, 26,  9, 14, 43], // Qian lower
      [12,  2, 16,  8, 23, 20, 35, 45], // Kun lower
      [25, 24, 51,  3, 27, 42, 21, 17], // Zhen lower
      [ 6,  7, 40, 29,  4, 59, 64, 47], // Kan lower
      [33, 15, 62, 39, 52, 53, 56, 31], // Gen lower
      [44, 46, 32, 48, 18, 57, 50, 28], // Xun lower
      [13, 36, 55, 63, 22, 37, 30, 49], // Li lower
      [10, 19, 54, 60, 41, 61, 38, 58], // Dui lower
    ];
    const lower = binaryValues[0] + binaryValues[1] * 2 + binaryValues[2] * 4;
    const upper = binaryValues[3] + binaryValues[4] * 2 + binaryValues[5] * 4;
    return kingWen[trigramIndex[lower]][trigramIndex[upper]];
  }

  renderMiniHexagram(binaryValues) {
    return binaryValues
      .map((v) => {
        if (v === 1) {
          return '<div class="mini-line solid"></div>';
        }
        return '<div class="mini-line broken"><span></span><span></span></div>';
      })
      .join("");
  }

  loadHistory() {
    const records = JSON.parse(localStorage.getItem("ichingRecords") || "[]");

    if (records.length === 0) {
      this.historyDiv.innerHTML = "<p>No hexagrams recorded yet.</p>";
      return;
    }

    this.historyDiv.innerHTML = "<ul></ul>";
    const list = this.historyDiv.querySelector("ul");

    records
      .slice()
      .reverse()
      .forEach((record) => {
        const li = document.createElement("li");
        li.className = "history-item";

        const date = new Date(record.date).toLocaleString();
        const networkBadge = record.network ? `[${record.network}]` : "";
        const currentBinary = this.toBinary(record.original);
        const futureBinary = this.toBinary(
          record.original.map((v) => this.getTransformedValue(v)),
        );
        const currentNumber = this.hexagramNumber(currentBinary);
        const futureNumber = this.hexagramNumber(futureBinary);

        li.innerHTML = `
        <div class="history-date">${date} ${networkBadge}</div>
        <div class="history-hexagrams">
          <div class="mini-hexagram-group">
            <div class="mini-hexagram-number">${currentNumber}</div>
            <div class="mini-hexagram">${this.renderMiniHexagram(currentBinary)}</div>
          </div>
          <span class="history-arrow">&rarr;</span>
          <div class="mini-hexagram-group">
            <div class="mini-hexagram-number">${futureNumber}</div>
            <div class="mini-hexagram">${this.renderMiniHexagram(futureBinary)}</div>
          </div>
          <div class="history-raw">${record.original.join("")}</div>
        </div>
        ${record.txId ? `<div><small>TX: ${record.txId.substring(0, 20)}...</small></div>` : ""}
      `;

        list.appendChild(li);
      });
  }
}

// Initialize the app when the page loads
document.addEventListener("DOMContentLoaded", () => {
  window.ichingApp = new IChingApp();
});
