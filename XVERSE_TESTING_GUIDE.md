# 🎯 Testing with Xverse Wallet - Quick Guide

## Your Contract Information

**Contract Address**: `ST3DJAD94M03E59W51PWD3VT0XH3S8VXZPXT59P5G.stream`  
**Network**: Stacks Testnet  
**Your Xverse Address**: `STFMR5YYDP5P4X3FD9Y1D3SK87X8W5J191H71T7S`

## 🚀 Easiest Way to Test (Using Stacks Explorer)

### Step 1: Open Your Contract
Click this link to open your contract in the Stacks Explorer:
👉 https://explorer.stacks.co/?chain=testnet&contract=ST3DJAD94M03E59W51PWD3VT0XH3S8VXZPXT59P5G.stream

### Step 2: Connect Xverse Wallet
1. Click on the **"Functions"** tab
2. Click **"Connect Wallet"** in the top right corner
3. Select **Xverse** from the wallet options
4. Approve the connection in your Xverse wallet

### Step 3: Create Your First Stream

1. **Find the `stream-to` function** in the list
2. **Fill in the parameters:**
   ```
   recipient: STFMR5YYDP5P4X3FD9Y1D3SK87X8W5J191H71T7S
   initial-balance: 1000000
   start-block: 0
   stop-block: 100
   payment-per-block: 10000
   ```
3. **Click "Call Function"**
4. **Approve the transaction** in your Xverse wallet
5. **Wait for confirmation** (~10 minutes)

### Step 4: Check Your Balance

1. **Find the `balance-of` function** (it's in the Read-Only section)
2. **Fill in:**
   ```
   stream-id: 0
   who: STFMR5YYDP5P4X3FD9Y1D3SK87X8W5J191H71T7S
   ```
3. **Click "Call Function"**
4. **See your accumulated tokens!** (will increase with each block)

### Step 5: Withdraw Tokens

1. **Find the `withdraw` function**
2. **Enter:**
   ```
   stream-id: 0
   ```
3. **Click "Call Function"**
4. **Approve in Xverse**
5. **Tokens will be transferred to you!**

## 🎨 Alternative: Use the Simple Interface

1. **Open** `frontend/index-simple.html` in your browser
2. **Click** the "Open Contract in Explorer" button
3. **Follow** the step-by-step instructions on the page

## 📊 Understanding the Parameters

### MicroSTX Conversion:
- **1 STX = 1,000,000 microSTX**
- **0.1 STX = 100,000 microSTX**
- **0.01 STX = 10,000 microSTX**

### Example Stream Explained:
- **Initial Balance**: 1,000,000 microSTX (1 STX total locked)
- **Payment Per Block**: 10,000 microSTX (0.01 STX unlocks per block)
- **Duration**: 100 blocks
- **Total Payout**: 100 × 0.01 = 1 STX over 100 blocks

## 🔍 All Available Functions

### Public Functions (Require Transaction):

1. **stream-to** - Create a new payment stream
2. **refuel** - Add more tokens to existing stream
3. **withdraw** - Withdraw accumulated tokens
4. **refund** - Reclaim excess tokens (after stream ends)
5. **update-details** - Modify stream parameters (requires signature)

### Read-Only Functions (No Transaction):

1. **balance-of** - Check withdrawable balance
2. **calculate-block-delta** - See how many blocks have passed
3. **hash-stream** - Generate hash for signing
4. **validate-signature** - Verify signatures

## ✅ Testing Checklist

- [ ] Open contract in Stacks Explorer
- [ ] Connect Xverse wallet
- [ ] Create a stream (to yourself for testing)
- [ ] Wait a few blocks (~10-20 minutes)
- [ ] Check balance (should show accumulated tokens)
- [ ] Withdraw tokens
- [ ] Refuel the stream (optional)
- [ ] After 100 blocks, request refund

## 💡 Pro Tips

1. **Test with yourself first**: Use your own address as recipient to see the full flow
2. **Start small**: Use small amounts (0.1-1 STX) for testing
3. **Be patient**: Blockchain transactions take time to confirm
4. **Check explorer**: Monitor your transactions on the explorer
5. **Watch blocks**: Each block adds more withdrawable tokens

## 🐛 Troubleshooting

### "Transaction Failed"
- Make sure you have enough testnet STX for gas fees
- Verify you're on Testnet network
- Check the stream ID exists

### "Can't See Balance"
- Wait a few blocks after creating the stream
- Make sure you're checking the correct stream ID
- Tokens unlock progressively per block

### "Refund Not Working"
- Refund only works after the stop-block
- Check current block height on explorer
- Make sure you're the stream creator

## 🎓 What This Demonstrates

By testing your contract, you're showing:

✅ **Smart Contract Deployment** - Live on Stacks Testnet  
✅ **DeFi Protocol Implementation** - Real token streaming  
✅ **Blockchain Interaction** - Using wallet to interact with contract  
✅ **Real-World Testing** - Actual transactions on live network  

## 🔗 Quick Links

- **Your Contract**: https://explorer.stacks.co/?chain=testnet&contract=ST3DJAD94M03E59W51PWD3VT0XH3S8VXZPXT59P5G.stream
- **Stacks Explorer**: https://explorer.stacks.co/?chain=testnet
- **Xverse Wallet**: https://www.xverse.app/
- **LearnWeb3**: https://learnweb3.io/

---

**🎉 Congratulations!** You've successfully deployed and can now test your token streaming protocol on the Stacks blockchain!
