import React, { useState, useEffect } from 'react'
import { callReadOnlyFunction } from '@stacks/transactions'
import { createNetwork } from '@stacks/network'
import { uintCV, principalCV } from '@stacks/transactions'

const testnetNetwork = createNetwork('testnet')

const CONTRACT_ADDRESS = 'STFMR5YYDP5P4X3FD9Y1D3SK87X8W5J191H71T7S' // Updated: New deployment with read functions
const CONTRACT_NAME = 'stream'

const StreamList = ({ streams, userAddress, onPause, onResume, onCancel, onWithdraw, loading, onRefresh }) => {
  const [balances, setBalances] = useState({})
  const [statuses, setStatuses] = useState({})

  useEffect(() => {
    const loadStreamData = async () => {
      const balanceMap = {}
      const statusMap = {}

      for (const stream of streams) {
        try {
          const balanceResult = await callReadOnlyFunction({
            network: 'testnet',
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'balance-of',
            functionArgs: [uintCV(stream.id), principalCV(userAddress)],
            senderAddress: userAddress,
          })

          const statusResult = await callReadOnlyFunction({
            network: 'testnet',
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'get-stream-status',
            functionArgs: [uintCV(stream.id)],
            senderAddress: userAddress,
          })

          balanceMap[stream.id] = balanceResult?.value?.value || 0
          statusMap[stream.id] = statusResult?.value?.value || 0
        } catch (error) {
          console.error(`Error loading stream ${stream.id}:`, error)
        }
      }

      setBalances(balanceMap)
      setStatuses(statusMap)
    }

    if (streams.length > 0 && userAddress) {
      loadStreamData()
    }
  }, [streams, userAddress])

  const getStatusBadge = (status) => {
    if (status === 0) {
      return <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-semibold">🟢 Active</span>
    } else if (status === 1) {
      return <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-xs font-semibold">🟡 Paused</span>
    } else {
      return <span className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-xs font-semibold">🔴 Cancelled</span>
    }
  }

  const formatMicroSTX = (amount) => {
    if (!amount) return '0'
    return (Number(amount) / 1000000).toFixed(6)
  }

  const isSender = (stream) => {
    const senderValue = stream.sender?.value || stream.sender
    return senderValue === userAddress || (typeof senderValue === 'object' && senderValue.address === userAddress)
  }

  const isRecipient = (stream) => {
    const recipientValue = stream.recipient?.value || stream.recipient
    return recipientValue === userAddress || (typeof recipientValue === 'object' && recipientValue.address === userAddress)
  }

  const getStreamValue = (stream, field) => {
    const value = stream[field]
    // Handle Clarity tuple values
    if (value === undefined || value === null) {
      return undefined
    }
    // If it's an object with a value property, extract it
    if (typeof value === 'object' && 'value' in value) {
      return value.value
    }
    // If it's a principal object, extract the address
    if (typeof value === 'object' && 'address' in value) {
      return value.address
    }
    // If it's a tuple with data, extract from data
    if (typeof value === 'object' && 'data' in value) {
      return value.data
    }
    // Otherwise return as-is
    return value
  }

  if (streams.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
        <p className="text-gray-300 text-lg">No streams found. Create your first stream above!</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Your Streams</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="grid gap-4">
        {streams.map((stream) => {
          const status = statuses[stream.id] || 0
          const balance = balances[stream.id] || 0
          const sender = isSender(stream)
          const recipient = isRecipient(stream)

          return (
            <div
              key={stream.id}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-xl border border-white/20 hover:border-white/30 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-bold text-white">Stream #{stream.id}</h3>
                    {getStatusBadge(status)}
                  </div>
                      <div className="text-sm text-gray-300 space-y-1">
                        <p><span className="font-semibold">Sender:</span> {getStreamValue(stream, 'sender') ? String(getStreamValue(stream, 'sender')).substring(0, 20) + '...' : 'N/A'}</p>
                        <p><span className="font-semibold">Recipient:</span> {getStreamValue(stream, 'recipient') ? String(getStreamValue(stream, 'recipient')).substring(0, 20) + '...' : 'N/A'}</p>
                        <p><span className="font-semibold">Balance:</span> {formatMicroSTX(getStreamValue(stream, 'balance'))} STX</p>
                        <p><span className="font-semibold">Payment/Block:</span> {formatMicroSTX(getStreamValue(stream, 'payment-per-block'))} STX</p>
                    {balance > 0 && (
                      <p className="text-green-300 font-semibold">
                        Withdrawable: {formatMicroSTX(balance)} STX
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {sender && status === 0 && (
                  <button
                    onClick={() => onPause(stream.id)}
                    disabled={loading}
                    className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 font-semibold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 transform hover:scale-105"
                  >
                    ⏸️ Pause
                  </button>
                )}
                
                {sender && status === 1 && (
                  <button
                    onClick={() => onResume(stream.id)}
                    disabled={loading}
                    className="bg-green-500/20 hover:bg-green-500/30 text-green-300 font-semibold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 transform hover:scale-105"
                  >
                    ▶️ Resume
                  </button>
                )}
                
                {sender && status !== 2 && (
                  <button
                    onClick={() => onCancel(stream.id)}
                    disabled={loading}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 transform hover:scale-105"
                  >
                    🗑️ Cancel
                  </button>
                )}
                
                {recipient && balance > 0 && status !== 2 && (
                  <button
                    onClick={() => onWithdraw(stream.id)}
                    disabled={loading}
                    className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-semibold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 transform hover:scale-105"
                  >
                    💰 Withdraw
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default StreamList
