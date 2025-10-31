# Token Streaming Protocol - Frontend

A simple web interface to interact with the Token Streaming Protocol smart contract on Stacks Testnet.

## 🚀 Quick Start

### Option 1: Simple Interface (Recommended for Xverse)
1. **Open** `index-simple.html` in your web browser
2. **Click** "Open Contract in Explorer" button
3. **Connect** your Xverse wallet in the explorer
4. **Test** all functions directly from the Stacks Explorer

### Option 2: Full Interface
1. **Open** `index.html` in your web browser
2. **Connect Wallet**: Click "Connect Wallet" and approve the connection
3. **Start Testing**: Use the interface to interact with your deployed contract

## 📋 Features

### Available Functions:

1. **Create Stream** 📝
   - Create a new payment stream
   - Specify recipient, amount, timeframe, and payment rate
   
2. **Refuel Stream** ⛽
   - Add more tokens to an existing stream
   - Only the stream creator can refuel

3. **Withdraw Tokens** 💰
   - Recipients can withdraw accumulated tokens
   - Available at any time during the stream

4. **Refund Excess** 🔙
   - Senders can reclaim unused tokens
   - Only available after stream ends

5. **Check Balance** 📊
   - View withdrawable balance for any address
   - Check both sender and recipient balances

## 🔧 Requirements

- **Xverse or Leather Wallet**: Browser extension installed and configured
- **Testnet STX**: Some testnet STX tokens in your wallet
- **Network**: Make sure your wallet is set to Testnet

## 🆕 Contract Address

**Address**: `ST3DJAD94M03E59W51PWD3VT0XH3S8VXZPXT59P5G.stream`  
**Your Xverse Wallet**: `STFMR5YYDP5P4X3FD9Y1D3SK87X8W5J191H71T7S`

## 💡 Usage Tips

### Creating a Stream:
- **1 STX = 1,000,000 microSTX**
- Example: To stream 1 STX, enter 1000000
- Start block can be 0 (immediate) or future block
- Payment per block determines the streaming rate

### Testing the Flow:
1. Create a stream with yourself as recipient
2. Wait a few blocks
3. Withdraw accumulated tokens
4. Refuel if needed
5. After stream ends, refund excess

## 🌐 Contract Details

- **Contract Address**: `ST3DJAD94M03E59W51PWD3VT0XH3S8VXZPXT59P5G.stream`
- **Network**: Stacks Testnet
- **Explorer**: [View on Explorer](https://explorer.stacks.co/?chain=testnet&contract=ST3DJAD94M03E59W51PWD3VT0XH3S8VXZPXT59P5G.stream)

## 📱 How to Use

### Step 1: Connect Wallet
Click the "Connect Leather Wallet" button and approve the connection request.

### Step 2: Create Your First Stream
1. Enter a recipient address (can be your own for testing)
2. Set initial balance (e.g., 1000000 for 1 STX)
3. Set start block (0 for immediate)
4. Set stop block (e.g., 100 for 100 blocks)
5. Set payment per block (e.g., 10000 for 0.01 STX per block)
6. Click "Create Stream"

### Step 3: Test Other Functions
- Use the stream ID (starts at 0) to interact with your stream
- Try withdrawing, refueling, and checking balances

## 🐛 Troubleshooting

**Wallet not connecting?**
- Make sure Leather Wallet is installed
- Ensure you're on Testnet network
- Refresh the page and try again

**Transaction failing?**
- Check you have enough testnet STX
- Verify the stream ID exists
- Make sure you're authorized for the action

**Balance showing 0?**
- Wait a few blocks after creating the stream
- Tokens unlock progressively per block

## 🎓 Learning Resources

This frontend demonstrates:
- Stacks.js integration
- Wallet connection with Leather
- Contract interaction
- Transaction handling
- Read-only function calls

## 📝 Notes

- This is a testnet application - use testnet STX only
- Transactions may take a few minutes to confirm
- Always verify transaction details before confirming
- Keep your wallet secure and never share your seed phrase

## 🔗 Links

- [Stacks Testnet Explorer](https://explorer.stacks.co/?chain=testnet)
- [Leather Wallet](https://leather.io/)
- [Stacks.js Documentation](https://docs.stacks.co/stacks.js)
- [LearnWeb3 Course](https://learnweb3.io/)

---

Built for the LearnWeb3 Stacks Developer Degree Course
