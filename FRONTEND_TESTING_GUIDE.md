# 🌐 Frontend Testing Guide

## How to Test Your Token Streaming Protocol on the Frontend

This guide will walk you through testing your deployed smart contract using the web interface.

## 📋 Prerequisites

Before you start, make sure you have:

1. ✅ **Leather Wallet** installed (Chrome/Brave extension)
2. ✅ **Testnet STX tokens** in your wallet
3. ✅ Wallet set to **Testnet** network
4. ✅ Contract deployed at: `ST3DJAD94M03E59W51PWD3VT0XH3S8VXZPXT59P5G.stream`

## 🚀 Step-by-Step Testing

### Step 1: Open the Frontend

1. Navigate to the `frontend` folder in your project
2. Double-click `index.html` to open it in your browser
3. You should see a beautiful purple gradient interface

### Step 2: Connect Your Wallet

1. Click the **"Connect Leather Wallet"** button
2. Your Leather Wallet will pop up
3. Click **"Connect"** to approve
4. Your address will appear on the page

### Step 3: Create Your First Stream

Let's create a test stream to yourself:

1. **In the "Create Stream" card:**
   - **Recipient Address**: Use your own address (shown after connecting)
   - **Initial Balance**: `1000000` (1 STX)
   - **Start Block**: `0` (starts immediately)
   - **Stop Block**: `100` (ends after 100 blocks)
   - **Payment Per Block**: `10000` (0.01 STX per block)

2. Click **"Create Stream"**
3. Approve the transaction in your Leather Wallet
4. Wait for confirmation (you'll see a transaction ID)

### Step 4: Check Your Balance

After a few blocks (wait ~10 minutes):

1. **In the "Check Balance" card:**
   - **Stream ID**: `0` (your first stream)
   - **Address**: Your wallet address
   
2. Click **"Check Balance"**
3. You should see accumulated tokens!

### Step 5: Withdraw Tokens

Now let's withdraw the accumulated tokens:

1. **In the "Withdraw Tokens" card:**
   - **Stream ID**: `0`
   
2. Click **"Withdraw"**
3. Approve the transaction
4. You'll receive the accumulated STX!

### Step 6: Refuel the Stream (Optional)

Add more tokens to your stream:

1. **In the "Refuel Stream" card:**
   - **Stream ID**: `0`
   - **Amount**: `500000` (0.5 STX)
   
2. Click **"Refuel Stream"**
3. Approve the transaction

### Step 7: Request Refund (After Stream Ends)

After block 100, reclaim unused tokens:

1. **In the "Refund Excess Tokens" card:**
   - **Stream ID**: `0`
   
2. Click **"Request Refund"**
3. Approve the transaction
4. Unused tokens return to you!

## 💡 Understanding the Numbers

### MicroSTX Conversion:
- **1 STX = 1,000,000 microSTX**
- **0.1 STX = 100,000 microSTX**
- **0.01 STX = 10,000 microSTX**

### Example Stream:
- **Initial Balance**: 1,000,000 microSTX (1 STX)
- **Payment Per Block**: 10,000 microSTX (0.01 STX)
- **Duration**: 100 blocks
- **Total Payout**: 100 blocks × 0.01 STX = 1 STX

## 🧪 Testing Scenarios

### Scenario 1: Streaming to Another User
1. Create a stream with a friend's address as recipient
2. They can withdraw accumulated tokens
3. You can refuel to add more tokens
4. After it ends, you can refund excess

### Scenario 2: Multiple Streams
1. Create multiple streams (Stream ID 0, 1, 2, etc.)
2. Each stream operates independently
3. Track different streams for different purposes

### Scenario 3: Error Testing
Try these to see error handling:
- Withdraw from a stream you don't own (should fail)
- Refuel someone else's stream (should fail)
- Refund before stream ends (should fail)

## 🔍 Monitoring Your Transactions

### View on Block Explorer:
1. Go to: https://explorer.stacks.co/?chain=testnet
2. Search for your contract: `ST3DJAD94M03E59W51PWD3VT0XH3S8VXZPXT59P5G.stream`
3. See all transactions and contract calls

### Check Transaction Status:
1. Copy the transaction ID from the frontend
2. Search for it on the explorer
3. See confirmation status and details

## 🐛 Common Issues & Solutions

### Issue: "Wallet not connecting"
**Solution**: 
- Make sure Leather Wallet is installed
- Check you're on Testnet network
- Refresh the page and try again

### Issue: "Transaction failing"
**Solution**:
- Verify you have enough testnet STX
- Check the stream ID exists
- Make sure you're authorized (sender/recipient)

### Issue: "Balance showing 0"
**Solution**:
- Wait a few blocks after creating stream
- Tokens unlock progressively per block
- Check you're using the correct stream ID

### Issue: "Can't refund yet"
**Solution**:
- Refund only works after stop-block
- Wait until the stream period ends
- Check current block height on explorer

## 📊 What to Expect

### Transaction Times:
- **Confirmation**: ~10 minutes per block
- **Multiple blocks**: May take 30-60 minutes
- **Be patient**: Blockchain takes time!

### Gas Fees:
- All transactions cost testnet STX
- Fees are automatically calculated
- Make sure you have extra STX for fees

## 🎯 Success Criteria

You've successfully tested the frontend when you can:

✅ Connect your wallet  
✅ Create a stream  
✅ Check balance and see accumulated tokens  
✅ Withdraw tokens successfully  
✅ Refuel a stream  
✅ Request refund after stream ends  

## 🎓 What This Demonstrates

By testing the frontend, you're demonstrating:

1. **Full-stack blockchain development** - Smart contract + Frontend
2. **Wallet integration** - Connecting and interacting with Leather
3. **Transaction handling** - Creating and confirming blockchain transactions
4. **User experience** - Building intuitive interfaces for DeFi
5. **Real-world testing** - Using your contract on a live network

## 📝 Alternative Testing Methods

### Method 1: Stacks Explorer (No Code)
1. Go to https://explorer.stacks.co/?chain=testnet
2. Search: `ST3DJAD94M03E59W51PWD3VT0XH3S8VXZPXT59P5G.stream`
3. Click "Functions" tab
4. Call functions directly from browser

### Method 2: Clarinet Console (Local)
```bash
clarinet console
```
Then interact with your contract locally

### Method 3: Stacks.js (Programmatic)
Write JavaScript code to interact with your contract

## 🎉 Congratulations!

You now have a complete, working DeFi application with:
- ✅ Smart contract deployed on Stacks
- ✅ Comprehensive test suite
- ✅ Beautiful web interface
- ✅ Real blockchain interactions

This is a **production-ready application** that demonstrates professional blockchain development skills!

---

**Need Help?** Check the frontend console (F12) for detailed error messages and logs.
