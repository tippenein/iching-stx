// Import Stacks libraries
import {
  makeContractCall,
  broadcastTransaction,
  uintCV,
  listCV,
  AnchorMode,
  PostConditionMode
} from '@stacks/transactions'

import {
  STACKS_DEVNET,
  STACKS_TESTNET,
  STACKS_MAINNET
} from '@stacks/network'

// Configuration constants
const CONTRACT_CONFIG = {
  devnet: {
    address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    name: 'hexagram-registry'
  },
  testnet: {
    address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    name: 'hexagram-registry'
  }
};

// Deployer private key for devnet testing (only safe for local development)
const DEVNET_DEPLOYER_KEY = '753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601';

// Utility functions
function getCurrentNetwork() {
  const hostname = window.location.hostname;
  return (hostname === 'localhost' || hostname === '127.0.0.1') ? 'devnet' : 'testnet';
}

function getNetworkConfig() {
  const network = getCurrentNetwork();
  switch (network) {
    case 'devnet': return STACKS_DEVNET;
    case 'testnet': return STACKS_TESTNET;
    case 'mainnet': return STACKS_MAINNET;
    default: return STACKS_DEVNET;
  }
}

function getContractConfig() {
  const network = getCurrentNetwork();
  return CONTRACT_CONFIG[network];
}

// I Ching App Class
class IChingApp {
  constructor() {
    this.currentHexagram = [];
    this.transformedHexagram = [];
    this.coinRolls = [];
    this.isAuthenticated = false;
    this.currentAddress = null;

    console.log(`I Ching App initialized on ${getCurrentNetwork()} network`);

    this.initializeElements();
    this.bindEvents();
    this.loadHistory();
    this.updateUI();
  }

  initializeElements() {
    this.connectBtn = document.getElementById('connect-btn');
    this.rollBtn = document.getElementById('roll-btn');
    this.submitBtn = document.getElementById('submit-btn');
    this.addressDisplay = document.getElementById('address-display');
    this.coinRollsDiv = document.getElementById('coin-rolls');
    this.currentHexagramDiv = document.getElementById('current-hexagram');
    this.transformedHexagramDiv = document.getElementById('transformed-hexagram');
    this.historyDiv = document.getElementById('hexagram-history');
  }

  bindEvents() {
    this.connectBtn.addEventListener('click', () => this.handleConnect());
    this.rollBtn.addEventListener('click', () => this.generateHexagram());
    this.submitBtn.addEventListener('click', () => this.submitToBlockchain());
  }

  updateUI() {
    if (this.isAuthenticated && this.currentAddress) {
      this.addressDisplay.textContent = this.currentAddress;
      this.connectBtn.textContent = 'Disconnect';
      this.submitBtn.disabled = false;
    } else {
      this.addressDisplay.textContent = 'Not connected';
      this.connectBtn.textContent = 'Connect Wallet';
      this.submitBtn.disabled = true;
    }
  }

  async handleConnect() {
    if (this.isAuthenticated) {
      this.logout();
      return;
    }

    try {
      // Demo wallet for testing - replace with real wallet integration as needed
      const demoAddress = 'ST1DEMO' + Math.random().toString(36).substring(2, 8).toUpperCase();
      this.authenticateUser({
        profile: {
          stxAddress: {
            testnet: demoAddress
          }
        }
      });
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Error connecting wallet: ' + error.message);
    }
  }

  authenticateUser(authData) {
    const address = authData.profile?.stxAddress?.testnet || authData.profile?.stxAddress?.mainnet;

    if (address) {
      this.isAuthenticated = true;
      this.currentAddress = address;
      localStorage.setItem('stacks-session', JSON.stringify(authData));
      this.updateUI();
    }
  }

  logout() {
    this.isAuthenticated = false;
    this.currentAddress = null;
    localStorage.removeItem('stacks-session');
    this.updateUI();
  }

  generateHexagram() {
    this.currentHexagram = [];
    this.transformedHexagram = [];
    this.coinRolls = [];

    // Generate 6 lines (bottom to top)
    for (let i = 0; i < 6; i++) {
      const lineData = this.generateLine();
      this.currentHexagram.push(lineData.currentValue);
      this.transformedHexagram.push(lineData.transformedValue);
      this.coinRolls.push(lineData.rolls);
    }

    this.displayCoinRolls();
    this.displayHexagram(this.currentHexagram, this.currentHexagramDiv, "Current Hexagram");
    this.displayHexagram(this.transformedHexagram, this.transformedHexagramDiv, "Transformed Hexagram");
    this.submitBtn.disabled = !this.isAuthenticated;
  }

  generateLine() {
    const rolls = [];
    let total = 0;

    for (let j = 0; j < 3; j++) {
      const result = Math.random() < 0.5 ? 2 : 3;
      rolls.push(result);
      total += result;
    }

    let currentValue, transformedValue;

    switch(total) {
      case 6:
        currentValue = 6; // Old Yin
        transformedValue = 7; // Becomes Young Yang
        break;
      case 7:
        currentValue = 7; // Young Yang
        transformedValue = 7; // Remains Young Yang
        break;
      case 8:
        currentValue = 8; // Young Yin
        transformedValue = 8; // Remains Young Yin
        break;
      case 9:
        currentValue = 9; // Old Yang
        transformedValue = 6; // Becomes Young Yin
        break;
      default:
        currentValue = 7;
        transformedValue = 7;
    }

    return {
      rolls: rolls,
      total: total,
      currentValue: currentValue,
      transformedValue: transformedValue
    };
  }

  displayCoinRolls() {
    this.coinRollsDiv.innerHTML = '<h3>Coin Rolls:</h3>';

    this.coinRolls.forEach((rolls, index) => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'line-roll';
      lineDiv.innerHTML = `
        <strong>Line ${6-index}:</strong>
        ${rolls.map(r => r === 2 ? 'Tails (2)' : 'Heads (3)').join(' + ')} = ${rolls.reduce((a, b) => a + b, 0)}
      `;
      this.coinRollsDiv.appendChild(lineDiv);
    });
  }

  displayHexagram(hexagram, container, label) {
    container.innerHTML = '';

    const labelDiv = document.createElement('div');
    labelDiv.className = 'hexagram-label';
    labelDiv.textContent = label;
    container.appendChild(labelDiv);

    for (let i = 0; i < hexagram.length; i++) {
      const lineValue = hexagram[i];
      const lineDiv = document.createElement('div');
      lineDiv.className = 'hexagram-line';

      if (lineValue === 6 || lineValue === 8) {
        lineDiv.innerHTML = `
          <div class="broken-line">
            <div class="broken-line-part"></div>
            <div class="broken-line-part"></div>
          </div>
          <small>Line ${6-i}: ${lineValue === 6 ? 'Old Yin (Changing)' : 'Young Yin'}</small>
        `;
      } else {
        lineDiv.innerHTML = `
          <div class="solid-line"></div>
          <small>Line ${6-i}: ${lineValue === 9 ? 'Old Yang (Changing)' : 'Young Yang'}</small>
        `;
      }

      container.appendChild(lineDiv);
    }
  }

  async submitToBlockchain() {
    if (!this.isAuthenticated) {
      alert('Please connect your wallet first!');
      return;
    }

    try {
      console.log(`Submitting hexagram to ${getCurrentNetwork()} blockchain...`);

      const networkConfig = getNetworkConfig();
      const contractConfig = getContractConfig();

      // Prepare transaction arguments
      const originalHexagramCV = listCV(this.currentHexagram.map(n => uintCV(n)));
      const transformedHexagramCV = listCV(this.transformedHexagram.map(n => uintCV(n)));
      const timestampCV = uintCV(Math.floor(Date.now() / 1000));

      const txOptions = {
        contractAddress: contractConfig.address,
        contractName: contractConfig.name,
        functionName: 'submit-hexagram-pair',
        functionArgs: [originalHexagramCV, transformedHexagramCV, timestampCV],
        senderKey: DEVNET_DEPLOYER_KEY,
        network: networkConfig,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow
      };

      // Create and broadcast transaction
      const transaction = await makeContractCall(txOptions);
      const broadcastResponse = await broadcastTransaction({
        transaction: transaction,
        network: networkConfig
      });

      if (broadcastResponse.error) {
        throw new Error(broadcastResponse.reason || broadcastResponse.error);
      }

      // Save to history
      this.saveHexagramRecord(broadcastResponse.txid || broadcastResponse);

      console.log(`✅ Transaction successful: ${broadcastResponse.txid}`);
      alert(`✅ Hexagram submitted to blockchain!\n\nTX ID: ${broadcastResponse.txid}`);

    } catch (error) {
      console.error('Error submitting to blockchain:', error);
      alert('Error submitting to blockchain: ' + error.message);
    }
  }

  saveHexagramRecord(txId) {
    const hexagramRecord = {
      id: Date.now(),
      original: [...this.currentHexagram],
      transformed: [...this.transformedHexagram],
      timestamp: Date.now(),
      date: new Date().toISOString(),
      txId: txId,
      network: getCurrentNetwork()
    };

    const records = JSON.parse(localStorage.getItem('ichingRecords') || '[]');
    records.push(hexagramRecord);
    localStorage.setItem('ichingRecords', JSON.stringify(records));
    this.loadHistory();
  }

  loadHistory() {
    const records = JSON.parse(localStorage.getItem('ichingRecords') || '[]');

    if (records.length === 0) {
      this.historyDiv.innerHTML = '<p>No hexagrams recorded yet.</p>';
      return;
    }

    this.historyDiv.innerHTML = '<ul></ul>';
    const list = this.historyDiv.querySelector('ul');

    records.slice().reverse().forEach(record => {
      const li = document.createElement('li');
      li.className = 'history-item';

      const date = new Date(record.date).toLocaleString();
      const networkBadge = record.network ? `[${record.network}]` : '';

      li.innerHTML = `
        <div class="history-date">${date} ${networkBadge}</div>
        <div class="hexagram-preview">
          <div class="hexagram-line">
            <span>Current: [${record.original.join(', ')}]</span>
          </div>
          <div class="hexagram-line">
            <span>Transformed: [${record.transformed.join(', ')}]</span>
          </div>
          ${record.txId ? `<div><small>TX: ${record.txId.substring(0, 20)}...</small></div>` : ''}
        </div>
      `;

      list.appendChild(li);
    });
  }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
  window.ichingApp = new IChingApp();
});