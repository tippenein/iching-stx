# I Ching Stacks Application

This is a decentralized application (dApp) built on the Stacks blockchain for generating and recording I Ching hexagrams.

## Features

- Generate I Ching hexagrams using the traditional three-coin method
- Record hexagram pairs (original and transformed) on the Stacks blockchain
- View your history of recorded hexagrams
- Visual representation of hexagrams

## How the I Ching Generation Works

The app simulates rolling three coins six times to generate a hexagram:

- Each coin roll: Tails = 2, Heads = 3
- Total of 3 coins determines the line:
  - 6 (3 tails): Old Yin (changing line, becomes Young Yang)
  - 7 (2 tails, 1 head): Young Yang (static line)
  - 8 (1 tail, 2 heads): Young Yin (static line)
  - 9 (3 heads): Old Yang (changing line, becomes Young Yin)

Lines are generated from bottom to top to form the hexagram.

## Smart Contract

The `hexagram-registry.clar` contract handles:

- Validation of hexagram formats
- Storage of hexagram pairs with timestamps
- Association of hexagrams with wallet addresses
- Retrieval of hexagrams by owner

## Frontend

The frontend provides:

- Wallet connection via Stacks Connect
- Coin rolling interface
- Visual display of generated hexagrams
- Submission to the blockchain
- History of previously recorded hexagrams

## Setup

1. Install Clarinet: `curl -L https://sh.clarity-lang.org/install.sh | sh`
2. Install Node.js dependencies: `npm install`
3. Start a local development server: `npm run dev`

## Testing

Run the contract tests with: `clarinet test`

## Deployment

To deploy to the Stacks testnet or mainnet, use Clarinet's deployment features:

```bash
clarinet contract publish hexagram-registry --network testnet
```