# Token Streaming Protocol - React Frontend

Modern React + TailwindCSS frontend for the Token Streaming Protocol Level 2 upgrade.

## 🚀 Features

- **Modern UI**: Glassmorphic design with smooth animations
- **Wallet Integration**: Connect with Leather/Xverse wallets
- **Stream Management**: Create, pause, resume, and cancel streams
- **Real-time Updates**: Live balance and status tracking
- **Toast Notifications**: User-friendly feedback for all actions

## 🛠️ Tech Stack

- **React 18**: Modern React with hooks
- **TailwindCSS**: Utility-first CSS framework
- **Stacks.js**: Blockchain interaction library
- **Vite**: Fast build tool
- **React Hot Toast**: Beautiful toast notifications

## 📦 Installation

```bash
cd react-frontend
npm install
```

## 🏃 Running

```bash
npm run dev
```

The app will open at `http://localhost:3000`

## 🏗️ Build

```bash
npm run build
```

## 📁 Project Structure

```
react-frontend/
├── src/
│   ├── components/
│   │   ├── Header.jsx          # Navigation and wallet connection
│   │   ├── CreateStreamForm.jsx # Stream creation form
│   │   └── StreamList.jsx      # Stream display and actions
│   ├── App.jsx                 # Main application component
│   ├── main.jsx                # React entry point
│   └── index.css               # TailwindCSS imports
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## 🎨 Design Features

- **Glassmorphic Cards**: Frosted glass effect with backdrop blur
- **Gradient Backgrounds**: Purple to blue to indigo gradients
- **Status Badges**: Color-coded stream status (🟢 Active, 🟡 Paused, 🔴 Cancelled)
- **Hover Effects**: Smooth scale and color transitions
- **Responsive Design**: Works on all screen sizes

## 🔧 Configuration

Update the contract address in `src/App.jsx`:

```javascript
const CONTRACT_ADDRESS = 'ST3DJAD94M03E59W51PWD3VT0XH3S8VXZPXT59P5G'
const CONTRACT_NAME = 'stream'
```

## 🎯 Usage

1. **Connect Wallet**: Click "Connect Wallet" and approve in your wallet
2. **Create Stream**: Fill in the form and click "Create Stream"
3. **Manage Streams**: Use pause/resume/cancel buttons based on your role
4. **Withdraw**: Recipients can withdraw accumulated tokens

## 🐛 Troubleshooting

- **Wallet not connecting**: Make sure Leather/Xverse extension is installed
- **Transactions failing**: Check you have testnet STX for gas fees
- **Streams not loading**: Verify contract is deployed and accessible

## 📝 Notes

- Requires Stacks Testnet network
- All amounts in microSTX (1 STX = 1,000,000 microSTX)
- Transactions take ~10 minutes to confirm

## 🎓 Level 2 Requirements

✅ Modern React frontend  
✅ TailwindCSS styling  
✅ Wallet integration  
✅ Full CRUD operations  
✅ Beautiful UI/UX  
✅ Toast notifications  
✅ Responsive design  

---

Built for LearnWeb3 Stacks Developer Degree - Level 2 Submission
