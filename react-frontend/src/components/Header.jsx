import React from 'react'

const Header = ({ userData, onConnect, onDisconnect }) => {
  const userAddress = userData?.profile?.stxAddress?.testnet

  return (
    <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">🌊</div>
            <div>
              <h1 className="text-2xl font-bold text-white">Token Streaming Protocol</h1>
              <p className="text-sm text-gray-300">Level 2 - Enhanced Version</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {userAddress ? (
              <>
                <div className="bg-white/10 rounded-lg px-4 py-2">
                  <p className="text-xs text-gray-300">Connected</p>
                  <p className="text-sm font-mono text-white truncate max-w-[200px]">
                    {userAddress}
                  </p>
                </div>
                <button
                  onClick={onDisconnect}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={onConnect}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
