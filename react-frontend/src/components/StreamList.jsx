import React, { useState, useEffect } from 'react'
import { callReadOnlyFunction } from '@stacks/transactions'
import { createNetwork } from '@stacks/network'
import { uintCV, principalCV } from '@stacks/transactions'

const testnetNetwork = createNetwork('testnet')

const CONTRACT_ADDRESS = 'STFMR5YYDP5P4X3FD9Y1D3SK87X8W5J191H71T7S'
const CONTRACT_NAME = 'stream'

const StreamList = ({ streams, userAddress, onPause, onResume, onCancel, onWithdraw, loading, onRefresh, streamTxIds = {}, recentlyCancelledStreams = new Set() }) => {
  const [balances, setBalances] = useState({})
  const [statuses, setStatuses] = useState({})
  const [currentBlockHeight, setCurrentBlockHeight] = useState(null)

  // Fetch current block height
  useEffect(() => {
    const fetchBlockHeight = async () => {
      try {
        const response = await fetch('https://api.testnet.hiro.so/v2/info')
        const data = await response.json()
        if (data.stacks_tip_height) {
          setCurrentBlockHeight(data.stacks_tip_height)
          console.log('Current block height:', data.stacks_tip_height)
        }
      } catch (error) {
        console.error('Error fetching block height:', error)
      }
    }
    
    fetchBlockHeight()
    // Refresh block height every 30 seconds
    const interval = setInterval(fetchBlockHeight, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const loadStreamData = async () => {
      const balanceMap = {}
      const statusMap = {}

      for (let i = 0; i < streams.length; i++) {
        const stream = streams[i]
        
        // Add delay between API calls to avoid rate limiting
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
        
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

          // Extract balance - handle different response formats
          let balance = 0
          if (balanceResult?.value?.value !== undefined) {
            balance = balanceResult.value.value
          } else if (balanceResult?.value !== undefined) {
            balance = balanceResult.value
          } else if (balanceResult?.okay?.value !== undefined) {
            balance = balanceResult.okay.value
          }
          
          // Extract status - handle different response formats
          // Raw format: {type: 1, value: {type: 0, value: 1n}}
          // get-stream-status returns (ok uint), so unwrap the ok first
          let status = 0
          
          console.log(`Stream ${stream.id} status result:`, statusResult)
          
          // Try different extraction paths
          if (statusResult?.okay !== undefined) {
            // Response is (ok uint), extract the uint value
            status = statusResult.okay?.value !== undefined ? statusResult.okay.value : statusResult.okay
            console.log(`  → Extracted from .okay:`, status)
          } else if (statusResult?.value?.value !== undefined) {
            // This is the format we're seeing: {type: 1, value: {type: 0, value: 1n}}
            status = statusResult.value.value
            console.log(`  → Extracted from .value.value:`, status)
          } else if (statusResult?.value !== undefined) {
            status = statusResult.value
            console.log(`  → Extracted from .value:`, status)
          } else {
            console.log(`  → No extraction path matched, using default 0`)
          }
          
          // Convert BigInt to number if needed
          const statusBeforeConversion = status
          if (typeof status === 'bigint') {
            status = Number(status)
            console.log(`  → Converted BigInt ${statusBeforeConversion} to number:`, status)
          } else {
            status = Number(status) || 0
            console.log(`  → Converted to number:`, status, '(was:', statusBeforeConversion, ')')
          }
          
          balanceMap[stream.id] = typeof balance === 'bigint' ? Number(balance) : (Number(balance) || 0)
          statusMap[stream.id] = status
          
          console.log(`Stream ${stream.id} status:`, status)
        } catch (error) {
          console.error(`Error loading stream ${stream.id} data:`, error)
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          })
          // Set default values on error
          balanceMap[stream.id] = 0
          statusMap[stream.id] = stream.status !== undefined ? Number(stream.status) : 0
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

  // Convert Clarity BigInt values to JavaScript numbers
  const safeToNumber = (value) => {
    if (value === null || value === undefined) return 0
    if (typeof value === 'bigint') return Number(value)
    if (typeof value === 'object' && value !== null) {
      if ('value' in value) {
        const val = value.value
        return typeof val === 'bigint' ? Number(val) : (Number(val) || 0)
      }
    }
    const num = Number(value)
    return isNaN(num) ? 0 : num
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
          // Prioritize fresh status from API call (statuses map), fallback to stream object status
          // The statuses map is loaded fresh from get-stream-status, so it's more up-to-date
          let apiStatus = statuses[stream.id]
          if (apiStatus !== undefined && apiStatus !== null) {
            apiStatus = Number(apiStatus)
          }
          
          // Fallback to stream object status if API status not available
          let streamStatus = stream.status
          if (streamStatus !== undefined && streamStatus !== null) {
            // Convert BigInt or Clarity value to number
            if (typeof streamStatus === 'bigint') {
              streamStatus = Number(streamStatus)
            } else if (typeof streamStatus === 'object' && 'value' in streamStatus) {
              const val = streamStatus.value
              streamStatus = typeof val === 'bigint' ? Number(val) : Number(val)
            } else {
              streamStatus = Number(streamStatus)
            }
          }
          
          // Use API status if available (more fresh), otherwise use stream object status, default to 0
          let status = apiStatus !== undefined && apiStatus !== null ? apiStatus : (streamStatus !== undefined && streamStatus !== null ? streamStatus : 0)
          
          // Override status if stream was recently cancelled (optimistic update)
          if (recentlyCancelledStreams.has(stream.id)) {
            status = 2 // Cancelled
            console.log(`Stream ${stream.id} marked as cancelled`)
          }
          const balance = balances[stream.id] || 0
          const sender = isSender(stream)
          const recipient = isRecipient(stream)
          
          // Calculate next payment info
          const timeframe = stream.timeframe || stream['timeframe']
          
          
          // Extract start-block and stop-block from Clarity tuple format
          // Format can be: {data: {start-block: {...}, stop-block: {...}}} or direct properties
          let startBlock = 0
          let stopBlock = 0
          
          if (timeframe) {
            // Try different extraction paths for Clarity tuple
            const data = timeframe.data || timeframe
            startBlock = safeToNumber(
              data?.['start-block']?.value || 
              data?.['start-block'] || 
              data?.startBlock?.value || 
              data?.startBlock ||
              timeframe?.['start-block']?.value ||
              timeframe?.['start-block'] ||
              timeframe?.startBlock?.value ||
              timeframe?.startBlock ||
              0
            )
            stopBlock = safeToNumber(
              data?.['stop-block']?.value || 
              data?.['stop-block'] || 
              data?.stopBlock?.value || 
              data?.stopBlock ||
              timeframe?.['stop-block']?.value ||
              timeframe?.['stop-block'] ||
              timeframe?.stopBlock?.value ||
              timeframe?.stopBlock ||
              0
            )
            
            if (startBlock === 0 && stopBlock === 0) {
              console.log(`Stream ${stream.id} timeframe extraction failed:`, timeframe)
            }
          }
          
          const paymentPerBlock = safeToNumber(stream['payment-per-block'] || stream.paymentPerBlock)
          
          // Calculate stream progress
          let blocksElapsed = 0
          let paymentsMade = 0
          let progressPercent = 0
          let currentBlockInStream = 0
          
          if (currentBlockHeight !== null && startBlock !== 0 && stopBlock !== 0) {
            // Calculate blocks elapsed (similar to contract's calculate-block-delta)
            if (currentBlockHeight <= startBlock) {
              // Stream hasn't started yet
              blocksElapsed = 0
              currentBlockInStream = 0
            } else if (currentBlockHeight < stopBlock) {
              // Stream is active
              blocksElapsed = currentBlockHeight - startBlock
              currentBlockInStream = currentBlockHeight
            } else {
              // Stream has ended
              blocksElapsed = stopBlock - startBlock
              currentBlockInStream = stopBlock
            }
            
            // Adjust for paused status
            if (isPaused) {
              const pauseBlock = safeToNumber(stream['pause-block'] || stream.pauseBlock)
              if (pauseBlock > startBlock) {
                blocksElapsed = pauseBlock - startBlock
              }
            }
            
            // Subtract total paused blocks if any
            const totalPausedBlocks = safeToNumber(stream['total-paused-blocks'] || stream.totalPausedBlocks || 0)
            blocksElapsed = Math.max(0, blocksElapsed - totalPausedBlocks)
            
            // Calculate payments made
            paymentsMade = blocksElapsed * paymentPerBlock
            
            // Calculate progress percentage
            const totalBlocks = stopBlock - startBlock
            if (totalBlocks > 0) {
              progressPercent = Math.min(100, Math.max(0, (blocksElapsed / totalBlocks) * 100))
            }
          }
          
          // Stacks blocks are mined approximately every 10 minutes
          const BLOCKS_PER_MINUTE = 0.1 // 1 block per 10 minutes
          const isCancelled = Number(status) === 2
          const isPaused = Number(status) === 1
          const isActive = Number(status) === 0

          return (
            <div
              key={stream.id}
              className={`backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all duration-200 ${
                isCancelled 
                  ? 'bg-red-500/10 border-red-500/30 hover:border-red-500/40' 
                  : isPaused
                  ? 'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/40'
                  : 'bg-white/10 border-white/20 hover:border-white/30'
              }`}
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
                        {timeframe ? (
                          startBlock === 0 && stopBlock === 0 ? (
                            <>
                              <p className="text-yellow-300 text-xs italic">
                                ⚠️ Timeframe: Unable to extract block numbers (may be ongoing stream)
                              </p>
                              {currentBlockHeight !== null && !isCancelled && (
                                <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                                  <p className="text-xs">
                                    <span className="font-semibold text-gray-300">Current Block:</span>{' '}
                                    <span className="text-blue-300">{currentBlockHeight}</span>
                                  </p>
                                  <p className="text-xs text-gray-400 italic">
                                    Progress tracking unavailable - timeframe data not accessible
                                  </p>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <p><span className="font-semibold">Timeframe:</span> Blocks {startBlock} - {stopBlock}</p>
                              {currentBlockHeight !== null && startBlock !== 0 && stopBlock !== 0 && !isCancelled && (
                                <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                                  <p className="text-xs">
                                    <span className="font-semibold text-gray-300">Current Block:</span>{' '}
                                    <span className="text-blue-300">{currentBlockHeight}</span>
                                    {currentBlockInStream > 0 && (
                                      <span className="text-gray-400"> (Block {currentBlockInStream} in stream)</span>
                                    )}
                                  </p>
                                  <p className="text-xs">
                                    <span className="font-semibold text-gray-300">Blocks Elapsed:</span>{' '}
                                    <span className="text-green-300">{blocksElapsed}</span>
                                    {' / '}
                                    <span className="text-gray-400">{stopBlock - startBlock} total</span>
                                  </p>
                                  <p className="text-xs">
                                    <span className="font-semibold text-gray-300">Payments Made:</span>{' '}
                                    <span className="text-purple-300">{formatMicroSTX(paymentsMade)} STX</span>
                                    {' '}
                                    <span className="text-gray-400">({blocksElapsed} blocks × {formatMicroSTX(paymentPerBlock)} STX/block)</span>
                                  </p>
                                  {progressPercent > 0 && (
                                    <div className="mt-1">
                                      <div className="flex justify-between text-xs mb-1">
                                        <span className="text-gray-300">Progress</span>
                                        <span className="text-gray-300">{progressPercent.toFixed(1)}%</span>
                                      </div>
                                      <div className="w-full bg-gray-700 rounded-full h-2">
                                        <div 
                                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                                          style={{ width: `${progressPercent}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )
                        ) : (
                          <>
                            <p className="text-gray-400 text-xs italic">Timeframe: Not available</p>
                            {currentBlockHeight !== null && !isCancelled && (
                              <div className="mt-2 pt-2 border-t border-white/10">
                                <p className="text-xs">
                                  <span className="font-semibold text-gray-300">Current Block:</span>{' '}
                                  <span className="text-blue-300">{currentBlockHeight}</span>
                                </p>
                              </div>
                            )}
                          </>
                        )}
                        {isActive && paymentPerBlock > 0 && currentBlockHeight !== null && (
                          <p className="text-blue-300 font-semibold">
                            ⏰ Next payment: ~10 minutes per block (Stacks blocks are mined approximately every 10 minutes)
                          </p>
                        )}
                        {isPaused && (
                          <p className="text-yellow-300 font-semibold">
                            ⏸️ Payments paused - Resume stream to continue payments
                          </p>
                        )}
                        {isCancelled && (
                          <div className="mt-2 space-y-1">
                            <p className="text-red-300 font-semibold">
                              🚫 Stream cancelled - No further payments will be made
                            </p>
                            <p className="text-xs text-red-200/80">
                              When a stream is cancelled:
                            </p>
                            <ul className="text-xs text-red-200/70 list-disc list-inside ml-2 space-y-0.5">
                              <li>All remaining balance is refunded to the sender</li>
                              <li>No more payments will be made to the recipient</li>
                              <li>The stream cannot be resumed or modified</li>
                            </ul>
                          </div>
                        )}
                    {balance > 0 && !isCancelled && (
                      <p className="text-green-300 font-semibold">
                        💰 Withdrawable: {formatMicroSTX(balance)} STX
                      </p>
                    )}
                    {isCancelled && (
                      <p className="text-red-200/70 text-xs italic mt-1">
                        Remaining balance has been refunded to sender
                      </p>
                    )}
                    {streamTxIds[stream.id] && (
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <p className="text-xs text-gray-400">
                          <span className="font-semibold">Transaction ID:</span>{' '}
                          <a 
                            href={`https://explorer.stacks.co/txid/${streamTxIds[stream.id]}?chain=testnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline break-all"
                          >
                            {streamTxIds[stream.id].substring(0, 16)}...{streamTxIds[stream.id].substring(streamTxIds[stream.id].length - 8)}
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {/* Only show action buttons if stream is not cancelled */}
                {Number(status) !== 2 && (
                  <>
                    {sender && Number(status) === 0 && (
                  <button
                    onClick={() => onPause(stream.id)}
                    disabled={loading}
                    className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 font-semibold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 transform hover:scale-105"
                  >
                    ⏸️ Pause
                  </button>
                )}
                
                    {sender && Number(status) === 1 && (
                  <button
                    onClick={() => onResume(stream.id)}
                    disabled={loading}
                    className="bg-green-500/20 hover:bg-green-500/30 text-green-300 font-semibold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 transform hover:scale-105"
                  >
                    ▶️ Resume
                  </button>
                )}
                
                    {sender && (
                  <button
                    onClick={() => onCancel(stream.id)}
                    disabled={loading}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 transform hover:scale-105"
                  >
                    🗑️ Cancel
                  </button>
                )}
                
                    {recipient && balance > 0 && (
                  <button
                    onClick={() => onWithdraw(stream.id)}
                    disabled={loading}
                    className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-semibold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 transform hover:scale-105"
                  >
                    💰 Withdraw
                  </button>
                    )}
                  </>
                )}
                
                {Number(status) === 2 && (
                  <p className="text-gray-400 text-sm italic">This stream has been cancelled. No actions available.</p>
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
