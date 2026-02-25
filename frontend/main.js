// Import Stacks libraries
import {
  makeContractCall,
  broadcastTransaction,
  uintCV,
  bufferCV,
  AnchorMode,
  PostConditionMode,
} from "@stacks/transactions";

import { STACKS_DEVNET, STACKS_MAINNET } from "@stacks/network";

import {
  encryptContent,
  decryptContent,
  getPublicKeyFromPrivate,
} from "@stacks/encryption";

import { AppConfig, UserSession } from "@stacks/auth";
import { showConnect, openContractCall } from "@stacks/connect";

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

// Wallet session (used on mainnet for real wallet connection)
const appConfig = new AppConfig(["store_write"]);
const userSession = new UserSession({ appConfig });

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

    console.log(`I Ching App initialized on ${getCurrentNetwork()} network`);

    this.initializeElements();
    this.bindEvents();
    this.createRecordCircles();
    this.updatePreviewFromRecord();
    this.loadHistory();
    this.restoreSession();
    this.updateUI();
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

  restoreSession() {
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
    } else if (userSession.isUserSignedIn()) {
      const userData = userSession.loadUserData();
      this.isAuthenticated = true;
      this.currentAddress = userData.profile?.stxAddress?.mainnet;
      this.appPrivateKey = userData.appPrivateKey;
      if (this.appPrivateKey) {
        this.appPublicKey = getPublicKeyFromPrivate(this.appPrivateKey);
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
      showConnect({
        appDetails: {
          name: "I Ching",
          icon: window.location.origin + "/favicon.svg",
        },
        onFinish: () => {
          const userData = userSession.loadUserData();
          this.isAuthenticated = true;
          this.currentAddress = userData.profile?.stxAddress?.mainnet;
          this.appPrivateKey = userData.appPrivateKey;
          if (this.appPrivateKey) {
            this.appPublicKey = getPublicKeyFromPrivate(this.appPrivateKey);
          }
          this.updateUI();
        },
        onCancel: () => {
          console.log("Wallet connection cancelled");
        },
        userSession,
      });
    }
  }

  logout() {
    this.isAuthenticated = false;
    this.currentAddress = null;
    this.appPrivateKey = null;
    this.appPublicKey = null;
    if (!isDevnet() && userSession.isUserSignedIn()) {
      userSession.signUserOut();
    }
    localStorage.removeItem("stacks-session");
    this.updateUI();
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
        return 6;
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
        openContractCall({
          contractAddress: contractConfig.address,
          contractName: contractConfig.name,
          functionName: "submit-hexagram",
          functionArgs: [hexagramCV, timestampCV],
          network: "mainnet",
          postConditionMode: PostConditionMode.Allow,
          onFinish: (data) => {
            this.saveHexagramRecord(data.txId);
            console.log(`Transaction successful: ${data.txId}`);
            alert(`Hexagram submitted to blockchain!\n\nTX ID: ${data.txId}`);
          },
          onCancel: () => {
            console.log("Transaction cancelled by user");
          },
        });
      }
    } catch (error) {
      console.error("Error submitting to blockchain:", error);
      alert("Error submitting to blockchain: " + error.message);
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
    return binaryValues.reduce((sum, bit, i) => sum + (bit << i), 0);
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
