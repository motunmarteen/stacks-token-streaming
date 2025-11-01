# Token Streaming Protocol - Stacks Blockchain

A decentralized token streaming protocol built on Stacks blockchain using Clarity smart contracts. This project was completed as part of the **LearnWeb3 Stacks Developer Degree** course.

## 🚀 Level 2 Upgrade Available!

This repository now includes a **Level 2 upgrade** with pause/resume functionality and a modern React frontend! See the `pause-resume-feature` branch for the enhanced version.

**Level 2 Features:**
- ✅ Pause and Resume streams
- ✅ Cancel streams with automatic refunds
- ✅ Modern React + TailwindCSS frontend
- ✅ Enhanced testing suite
- ✅ Professional dashboard UI

## 🎯 Project Overview

This project implements a token streaming protocol that allows continuous payments between two parties over time. The sender creates a stream with specific parameters, and the recipient can withdraw accumulated tokens at any point during the stream's active period.

## ✨ Features Implemented

### Core Functionality
- **Stream Creation**: Create payment streams with custom parameters
- **Refueling**: Add additional tokens to existing streams
- **Withdrawal**: Recipients can withdraw accumulated tokens over time
- **Refund**: Senders can reclaim excess tokens after stream ends
- **Stream Updates**: Modify stream parameters with cryptographic consent

### Security Features
- **ECDSA Signature Verification**: Ensures both parties consent to stream modifications
- **Access Control**: Only authorized parties can perform specific actions
- **Cryptographic Hashing**: SHA-256 hashing for secure message signing

## 🏗️ Technical Architecture

### Smart Contract (`contracts/stream.clar`)
- **Language**: Clarity 3
- **Functions**: 9 public functions, 5 read-only functions
- **Storage**: Data variables and mappings for stream management
- **Error Handling**: Comprehensive error codes for different failure scenarios

### Key Functions
1. `stream-to`: Create new payment streams
2. `refuel`: Add tokens to existing streams
3. `withdraw`: Withdraw accumulated tokens
4. `refund`: Reclaim excess tokens after stream ends
5. `pause-stream`: Pause an active stream
6. `resume-stream`: Resume a paused stream
7. `cancel-stream`: Cancel a stream and refund unused tokens
8. `update-details`: Modify stream parameters with signature verification
9. `balance-of`: Calculate withdrawable balances
10. `get-stream-status`: Get current stream status
11. `get-stream`: Get full stream data
12. `get-latest-stream-id`: Get the latest stream ID

## 🧪 Testing

Comprehensive test suite covering:
- Stream creation and initialization
- Refueling functionality (authorized and unauthorized)
- Token withdrawal over time
- Pause and resume functionality
- Stream cancellation and refunds
- Access control and authorization
- Signature verification and validation
- Stream parameter updates
- Error handling and edge cases

Run tests with: `npm test`

## 🚀 Deployment

### Contract Details
- **Network**: Stacks Testnet
- **Contract Address**: `STFMR5YYDP5P4X3FD9Y1D3SK87X8W5J191H71T7S.stream`
- **Status**: ✅ Live and functional

### View on Block Explorer
[Stacks Testnet Explorer](https://explorer.stacks.co/?chain=testnet&contract=STFMR5YYDP5P4X3FD9Y1D3SK87X8W5J191H71T7S.stream)

## 📋 Course Requirements Completed

This project fulfills all requirements from the **LearnWeb3 Stacks Developer Degree** course:

### ✅ Learning Objectives Met
1. **Clarinet Environment Setup**: Successfully set up local development environment
2. **Token Streaming Protocol Understanding**: Implemented complete streaming mechanism
3. **STX Token Integration**: Built protocol using STX as payment method
4. **Clarity Smart Contract Development**: Wrote comprehensive contract in Clarity
5. **Test Suite Development**: Created thorough test coverage using Vitest
6. **Deployment to Testnet**: Successfully deployed to Stacks Testnet

### ✅ Technical Implementation
- **Smart Contract Development**: Complete Clarity contract with all required functions
- **Cryptographic Security**: ECDSA signature verification for secure updates
- **Blockchain Integration**: STX token transfers and block height calculations
- **Error Handling**: Comprehensive error management and validation
- **Testing**: Unit tests covering all functionality and edge cases

## 🛠️ Development Process

### Phase 1: Environment Setup
- Installed Clarinet development toolkit
- Set up Node.js project with Vitest testing framework
- Configured development and testnet environments

### Phase 2: Smart Contract Development
- Designed contract architecture and data structures
- Implemented core streaming functionality
- Added cryptographic signature verification
- Implemented comprehensive error handling

### Phase 3: Testing & Validation
- Created comprehensive test suite
- Tested all functions and edge cases
- Validated signature verification system
- Ensured proper access control

### Phase 4: Deployment
- Generated testnet deployment plan
- Successfully deployed to Stacks Testnet
- Verified contract functionality on live network

## 🌐 Frontend Interface

A modern React frontend is included to interact with the deployed contract. The frontend is built with React, TailwindCSS, and Stacks.js for wallet integration.

### Quick Start:
1. Navigate to the `react-frontend/` directory
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start the development server
4. Connect your Leather or Xverse wallet (Testnet)
5. Start creating and managing streams!

### Features:
- Create payment streams with custom parameters
- Pause and resume active streams
- Cancel streams and receive automatic refunds
- Withdraw accumulated tokens
- Real-time stream status and progress tracking
- Transaction history and explorer links

## 📁 Project Structure

```
stacks-token-streaming/
├── contracts/
│   └── stream.clar          # Main smart contract
├── tests/
│   └── stream.test.ts       # Comprehensive test suite
├── react-frontend/         # React frontend application
│   ├── src/               # Source code
│   ├── package.json       # Frontend dependencies
│   └── vite.config.js     # Build configuration
├── frontend/              # Simple HTML frontend
│   └── index.html         # Basic web interface
├── settings/
│   ├── Devnet.toml         # Development configuration
│   └── Testnet.toml        # Testnet configuration
├── deployments/
│   └── default.testnet-plan.yaml  # Deployment plan
├── Clarinet.toml           # Project configuration
├── package.json           # Dependencies
└── README.md             # This file
```

## 🔧 Technologies Used

- **Clarity**: Smart contract language
- **Clarinet**: Development and testing framework
- **Vitest**: JavaScript testing framework
- **Stacks Blockchain**: Layer 1 blockchain for Bitcoin
- **TypeScript**: Test development
- **ECDSA**: Cryptographic signature verification

## 🎓 Course Completion

This project represents the successful completion of the **LearnWeb3 Stacks Developer Degree** course, demonstrating:

- Mastery of Clarity smart contract development
- Understanding of DeFi protocol design
- Implementation of cryptographic security
- Comprehensive testing methodologies
- Blockchain deployment and interaction

## 📞 Contact

This project was completed as part of the LearnWeb3 Stacks Developer Degree program. The implementation showcases practical blockchain development skills and real-world DeFi protocol creation.

---

**Status**: ✅ Course Assignment Completed Successfully  
**Date**: 2024  
**Platform**: LearnWeb3 Stacks Developer Degree  
**Blockchain**: Stacks Testnet
