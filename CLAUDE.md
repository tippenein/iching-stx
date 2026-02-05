# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a decentralized I Ching hexagram generator built on the Stacks blockchain. The application allows users to generate traditional I Ching hexagrams using a three-coin method and record them permanently on the blockchain.

## Architecture

### Smart Contract (`contracts/hexagram-registry.clar`)
- **Language**: Clarity (Stacks blockchain smart contract language)
- **Main Functions**:
  - `submit-hexagram-pair`: Records original and transformed hexagram pairs with timestamps
  - `get-hexagram-by-id`: Retrieves hexagrams by ID for the calling user
  - `get-hexagrams-by-owner`: Returns list of hexagram IDs for a given owner
- **Data Storage**: Uses maps to store hexagram data with owner/ID as composite keys
- **Validation**: Ensures hexagram lines are valid (values 6, 7, 8, or 9 representing I Ching line types)

### Frontend (`frontend/`)
- **Language**: Vanilla JavaScript with ES6 modules and Stacks integration
- **Main File**: `main.js` - Single-page application class managing the entire UI
- **Build System**: Vite for modern development with proper module bundling
- **Wallet Integration**: Uses `@stacks/transactions` for blockchain submission
- **Storage**: Uses localStorage for offline hexagram history
- **Hexagram Generation**: Simulates traditional three-coin method (tails=2, heads=3) to generate lines

### I Ching Line Values
- `6`: Old Yin (broken line that transforms to solid)
- `7`: Young Yang (solid line, unchanging)
- `8`: Young Yin (broken line, unchanging)
- `9`: Old Yang (solid line that transforms to broken)

## Development Commands

### Contract Development
- **Test contracts**: `clarinet test` (uses Vitest with Clarinet SDK)
- **Check contract syntax**: `clarinet check`
- **Deploy to testnet**: `clarinet contract publish hexagram-registry --network testnet`

### Frontend Development
- **Start development server**: `npm run dev` (uses Vite dev server on port 3000)
- **Build for production**: `npm run build` (outputs to `dist/` directory)
- **Preview production build**: `npm run preview`

### Testing
- **Run all tests**: `npm test` or `vitest`
- **Contract-specific tests**: Located in `tests/hexagram-registry.test.ts`
- **Test configuration**: Uses `vitest.config.js` with Clarinet environment for blockchain simulation

## Network Configuration

Network settings are stored in `settings/` directory:
- `Devnet.toml`: Local development network
- `Testnet.toml`: Stacks testnet configuration
- `Mainnet.toml`: Stacks mainnet configuration

## Key Dependencies

- **@stacks/transactions**: Transaction building and broadcasting
- **@stacks/network**: Stacks network configuration (devnet, testnet, mainnet)
- **@hirosystems/clarinet-sdk**: Contract testing and simulation
- **vitest**: Test runner configured for Clarinet integration
- **vite**: Modern build tool and development server

## Development Notes

- Contract uses Clarity version 2 (epoch 2.4)
- Frontend assumes contract deployed at `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.hexagram-registry`
- Hexagrams are generated bottom-to-top (index 0 = bottom line, index 5 = top line)
- Automatically detects **devnet** when running on localhost, **testnet** otherwise
- Real blockchain transactions work with local Clarinet devnet
- Owner hexagram tracking in contract has known limitation (simplified implementation that doesn't update existing lists)

## Current Implementation (Vite + ES6 Modules)

The frontend uses a modern Vite-based development setup with proper ES6 modules:

### Dependencies (@stacks v7.3.1)
- `@stacks/network`: Network configuration (STACKS_DEVNET, STACKS_TESTNET, STACKS_MAINNET)
- `@stacks/transactions`: Transaction building and broadcasting
- `vite`: Modern build tool with hot module replacement

### Architecture
- **`main.js`**: Single application class with ES6 module imports
- **Network detection**: Automatically switches between devnet (localhost) and testnet
- **Contract configuration**: Centralized contract address management
- **Transaction handling**: Direct blockchain submission using deployer key for devnet

### Key Features
- **Real blockchain transactions**: Successfully submits to local Clarinet devnet
- **Network-aware**: Automatically detects localhost vs deployed environments
- **ES6 modules**: Proper module imports with Vite bundling
- **Demo wallet**: Generates demo addresses for testing without external wallet
- **Transaction broadcasting**: Uses `broadcastTransaction` with proper parameter format
- **Local storage**: Saves hexagram history locally with transaction IDs

### Development Workflow
1. `clarinet devnet start` - Start local blockchain
2. `npm run dev` - Start Vite dev server (port 3000)
3. Generate hexagrams and submit to devnet
4. Transactions appear in Clarinet console logs

### Transaction Flow
1. User generates hexagram through coin rolling simulation
2. App converts to Clarity data types (`uintCV`, `listCV`)
3. Creates contract call to `submit-hexagram-pair` function
4. Broadcasts transaction to network using deployer key
5. Saves transaction ID and hexagram to localStorage

### Key Implementation Details
- Uses deployer private key for devnet transactions (development only)
- Proper `broadcastTransaction` parameter format: `{ transaction, network }`
- Contract deployed at `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.hexagram-registry`
- Hexagram values converted to Clarity `uint` types (6, 7, 8, 9)