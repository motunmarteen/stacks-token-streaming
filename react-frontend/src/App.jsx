import { useState, useEffect, useRef } from 'react'
import { AppConfig, UserSession, showConnect, openContractCall } from '@stacks/connect'
import { createNetwork } from '@stacks/network'
import { 
  callReadOnlyFunction, 
  contractPrincipalCV, 
  uintCV, 
  principalCV,
  tupleCV,
  AnchorMode,
  PostConditionMode,
  createSTXPostCondition,
  FungibleConditionCode,
  cvToValue
} from '@stacks/transactions'
import toast, { Toaster } from 'react-hot-toast'
import StreamList from './components/StreamList'
import CreateStreamForm from './components/CreateStreamForm'
import Header from './components/Header'

const CONTRACT_ADDRESS = 'STFMR5YYDP5P4X3FD9Y1D3SK87X8W5J191H71T7S'
const CONTRACT_NAME = 'stream'
const testnetNetwork = createNetwork('testnet')

const appConfig = new AppConfig(['store_write', 'publish_data'], 'testnet')
const userSession = new UserSession({ appConfig })

function App() {
  const [userData, setUserData] = useState(null)
  const [streams, setStreams] = useState([])
  const [loading, setLoading] = useState(false)
  const [streamTxIds, setStreamTxIds] = useState({}) // Map of streamId -> transactionId
  const [recentlyCancelledStreams, setRecentlyCancelledStreams] = useState(new Set()) // Track recently cancelled streams
  const hasShownContractErrorRef = useRef(false) // Track if we've shown the contract error
  const pendingStreamTxIdsRef = useRef([]) // Queue of pending transaction IDs for stream creation

  // Load transaction IDs from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('streamTxIds')
    if (stored) {
      try {
        setStreamTxIds(JSON.parse(stored))
      } catch (e) {
        console.error('Error loading stream transaction IDs:', e)
      }
    }
  }, [])

  // Save transaction IDs to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(streamTxIds).length > 0) {
      localStorage.setItem('streamTxIds', JSON.stringify(streamTxIds))
    }
  }, [streamTxIds])

  useEffect(() => {
    // Check if user is signed in without throwing errors
    try {
      const isSignedIn = userSession.isUserSignedIn()
      if (isSignedIn) {
        const data = userSession.loadUserData()
        setUserData(data)
      }
    } catch (error) {
      // No session data yet - this is normal before wallet connection
      // Silently handle the NoSessionDataError
      if (error.name !== 'NoSessionDataError') {
        console.error('Error checking session:', error)
      }
    }
  }, [])

  const connectWallet = async () => {
    try {
      // Check if wallet extension is available
      if (typeof window === 'undefined' || !window.StacksProvider) {
        toast.error('Please install Leather or Xverse wallet extension')
        return
      }

      await showConnect({
      appDetails: {
        name: 'Token Streaming Protocol',
        icon: window.location.origin + '/icon.png',
      },
      redirectTo: '/',
        network: 'testnet',
      onFinish: () => {
          try {
        const data = userSession.loadUserData()
            console.log('User data loaded:', data)
            console.log('User address:', data.profile.stxAddress.testnet)
        setUserData(data)
            toast.success(`Wallet connected! Address: ${data.profile.stxAddress.testnet.substring(0, 10)}...`)
        loadStreams()
          } catch (error) {
            console.error('Error loading user data:', error)
            toast.error('Connected but failed to load user data')
          }
      },
      onCancel: () => {
        toast.error('Wallet connection cancelled')
      },
      userSession,
    })
    } catch (error) {
      console.error('Error connecting wallet:', error)
      toast.error(`Failed to connect wallet: ${error.message || 'Please make sure your wallet extension is installed and unlocked'}`)
    }
  }

  const disconnectWallet = () => {
    userSession.signUserOut()
    setUserData(null)
    setStreams([])
    toast.success('Wallet disconnected')
  }

  // Rate limiting helper
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  // Convert Clarity BigInt values to JavaScript numbers
  const safeToNumber = (value) => {
    if (value === null || value === undefined) return 0
    if (typeof value === 'bigint') return Number(value)
    if (typeof value === 'object' && value !== null) {
      // If it's a Clarity value object with a value property
      if ('value' in value) {
        const val = value.value
        return typeof val === 'bigint' ? Number(val) : (Number(val) || 0)
      }
    }
    const num = Number(value)
    return isNaN(num) ? 0 : num
  }

  const loadStreams = async () => {
    if (!userData) return
    
    try {
      setLoading(true)
      const streamList = []
      let latestId = 0
      let hasUndefinedFunctionError = false // Track if we've seen this error
      let rateLimitHit = false // Track if we hit rate limits

      console.log('Loading streams for address:', userData.profile.stxAddress.testnet)
      console.log('Contract:', `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`)

      // Try to get latest stream ID first (if function exists)
      try {
      const latestIdResult = await callReadOnlyFunction({
          network: 'testnet',
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-latest-stream-id',
        functionArgs: [],
        senderAddress: userData.profile.stxAddress.testnet,
      })

        console.log('Latest stream ID result:', latestIdResult)
        if (latestIdResult && latestIdResult.value !== undefined) {
          latestId = Number(latestIdResult.value) || 0
          console.log('Latest stream ID:', latestId)
        }
      } catch (e) {
        // Function doesn't exist in deployed contract - fallback to sequential loading
        console.log('get-latest-stream-id not available, using sequential loading:', e.message)
        if (e.message && e.message.includes('UndefinedFunction')) {
          hasUndefinedFunctionError = true
        }
        // Check for rate limit errors
        if (e.message && (e.message.includes('429') || e.message.includes('Too Many Requests') || e.message.includes('Failed to fetch'))) {
          rateLimitHit = true
          toast.error('Rate limit reached. Please wait a moment and refresh.', { duration: 5000 })
        }
        latestId = null // null means we'll try sequential loading
      }

      // If we have a latest ID, use it. Otherwise, try sequential loading
      if (latestId !== null && latestId > 0 && !rateLimitHit) {
        // Load streams up to the latest ID
        console.log(`Loading ${latestId} streams...`)
      for (let i = 0; i < latestId; i++) {
          // Add delay between API calls to avoid rate limiting (200ms delay)
          if (i > 0) {
            await delay(200)
          }
          
          // Check if we've hit rate limits in previous calls
          if (rateLimitHit) {
            console.log('Rate limit hit, stopping stream loading')
            break
          }
          
        try {
          const streamResult = await callReadOnlyFunction({
              network: 'testnet',
              contractAddress: CONTRACT_ADDRESS,
              contractName: CONTRACT_NAME,
              functionName: 'get-stream',
              functionArgs: [uintCV(i)],
              senderAddress: userData.profile.stxAddress.testnet,
            })

            // Log stream result without JSON.stringify (to avoid BigInt serialization errors)
            console.log(`Stream ${i} result:`, streamResult)
            
            // Handle the response - get-stream returns (ok tuple)
            let streamData = null
            try {
              const convertedValue = cvToValue(streamResult)
              if (convertedValue?.okay) {
                streamData = convertedValue.okay
              } else if (convertedValue?.value) {
                streamData = convertedValue.value
              } else if (convertedValue) {
                streamData = convertedValue
              }
            } catch (e) {
              if (streamResult?.okay) {
                streamData = streamResult.okay
              } else if (streamResult?.value) {
                streamData = streamResult.value
              }
            }
            
            // Validate we have actual stream data
            const hasValidData = streamData && (
              streamData.sender || streamData.recipient ||
              streamData['sender'] || streamData['recipient']
            )
            
            if (hasValidData) {
              streamList.push({
                id: i,
                ...streamData,
              })
              console.log(`Stream ${i} loaded:`, streamData)
            } else {
              console.log(`Stream ${i} skipped - no valid data`)
            }
          } catch (e) {
            // Check for rate limit errors
            const errorMsg = e.message || e.toString() || ''
            if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('Failed to fetch') || errorMsg.includes('CORS')) {
              console.error(`Rate limit hit at stream ${i}`)
              rateLimitHit = true
              toast.error('Rate limit reached. Stopping stream loading. Please wait and refresh.', { duration: 5000 })
              break
            }
            // Stream doesn't exist - skip it
            console.log(`Stream ${i} not found:`, e.message)
          }
        }
      } else if (!rateLimitHit) {
        // Sequential loading: try stream IDs starting from 0 until we hit consecutive failures
        console.log('Using sequential loading...')
        let consecutiveFailures = 0
        const maxConsecutiveFailures = 10 // Reduced to avoid too many API calls
        
        for (let i = 0; consecutiveFailures < maxConsecutiveFailures && !rateLimitHit; i++) {
          // Add delay between API calls to avoid rate limiting (300ms delay for sequential)
          if (i > 0) {
            await delay(300)
          }
          
          try {
            console.log(`Trying to load stream ${i}...`)
            const streamResult = await callReadOnlyFunction({
              network: 'testnet',
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'get-stream',
            functionArgs: [uintCV(i)],
            senderAddress: userData.profile.stxAddress.testnet,
          })

            // Log stream result without JSON.stringify (to avoid BigInt serialization errors)
            console.log(`Stream ${i} result:`, streamResult)
            
            // Check if response is an error (stream doesn't exist)
            // get-stream returns (err u999) when stream doesn't exist
            if (streamResult?.err || streamResult?.error) {
              console.log(`Stream ${i} doesn't exist (error response)`)
              consecutiveFailures++
              continue
            }
            
            // Convert Clarity value to JavaScript value
            let streamData = null
            try {
              // Try to convert the response using cvToValue
              const convertedValue = cvToValue(streamResult)
              console.log(`Stream ${i} converted value:`, convertedValue)
              
              // Check if converted value is an error
              if (convertedValue?.err || convertedValue?.error) {
                console.log(`Stream ${i} doesn't exist (error in converted value)`)
                consecutiveFailures++
                continue
              }
              
              // Handle different response formats
              if (convertedValue?.okay) {
                streamData = convertedValue.okay
              } else if (convertedValue?.value) {
                streamData = convertedValue.value
              } else if (convertedValue && typeof convertedValue === 'object' && !convertedValue.err) {
                streamData = convertedValue
              }
            } catch (e) {
              console.log(`Could not convert stream ${i} with cvToValue:`, e.message)
              // Fallback to direct extraction
              if (streamResult?.okay) {
                streamData = streamResult.okay
              } else if (streamResult?.value?.okay) {
                streamData = streamResult.value.okay
              } else if (streamResult?.value && !streamResult.value.err) {
                streamData = streamResult.value
              }
            }
            
            // Validate that we have actual stream data with sender or recipient
            let finalData = streamData?.data || streamData
            
            // Check if we have valid stream data (must have sender or recipient)
            const senderValue = finalData?.sender || finalData?.['sender']
            const recipientValue = finalData?.recipient || finalData?.['recipient']
            
            // Extract actual values from Clarity types
            const getPrincipalValue = (val) => {
              if (!val) return null
              if (typeof val === 'string') return val
              if (typeof val === 'object' && val.address) return val.address
              if (typeof val === 'object' && val.value) return val.value
              return null
            }
            
            const senderStr = getPrincipalValue(senderValue)
            const recipientStr = getPrincipalValue(recipientValue)
            
            // Only add if we have BOTH sender AND recipient (valid stream)
            if (finalData && senderStr && recipientStr) {
            streamList.push({
              id: i,
                sender: senderStr,
                recipient: recipientStr,
                balance: safeToNumber(finalData.balance || finalData['balance']),
                'withdrawn-balance': safeToNumber(finalData['withdrawn-balance'] || finalData.withdrawnBalance),
                'payment-per-block': safeToNumber(finalData['payment-per-block'] || finalData.paymentPerBlock),
                timeframe: finalData.timeframe || finalData['timeframe'],
                status: safeToNumber(finalData.status || finalData['status']),
                'pause-block': safeToNumber(finalData['pause-block'] || finalData.pauseBlock),
                'total-paused-blocks': safeToNumber(finalData['total-paused-blocks'] || finalData.totalPausedBlocks),
              })
              console.log(`Stream ${i} loaded`, { 
                sender: senderStr, 
                recipient: recipientStr
              })
              consecutiveFailures = 0
            } else {
              console.log(`Stream ${i} skipped - invalid sender/recipient`, {
                senderStr,
                recipientStr,
                finalData
              })
              consecutiveFailures++
            }
          } catch (e) {
            console.error(`Stream ${i} error:`, e)
            console.error(`Error details:`, {
              message: e.message,
              stack: e.stack,
              name: e.name
            })
            
            // Check for rate limit errors first
            const errorMsg = e.message || e.toString() || ''
            if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('Failed to fetch') || errorMsg.includes('CORS')) {
              console.error(`Rate limit hit at stream ${i}`)
              rateLimitHit = true
              toast.error('Rate limit reached. Stopping stream loading. Please wait and refresh.', { duration: 5000 })
              break
            }
            
            // If it's an undefined function error, stop trying - contract doesn't have the function
            if (e.message && e.message.includes('UndefinedFunction')) {
              console.error('Contract missing get-stream function')
              hasUndefinedFunctionError = true
              // Stop searching - contract doesn't have this function
              break
            }

            consecutiveFailures++
            if (consecutiveFailures >= maxConsecutiveFailures) {
              console.log(`Stopping after ${consecutiveFailures} consecutive failures`)
              break // Stop searching
            }
          }
        }
      }

      console.log(`Total streams loaded: ${streamList.length}`, streamList)
      setStreams(streamList)
      
      // Clear recently cancelled streams that are now confirmed cancelled
      setRecentlyCancelledStreams(prev => {
        const updated = new Set(prev)
        streamList.forEach(stream => {
          const streamStatus = safeToNumber(stream.status)
          if (streamStatus === 2 && updated.has(stream.id)) {
            console.log(`Stream ${stream.id} confirmed cancelled`)
            updated.delete(stream.id)
          }
        })
        return updated
      })
      
      // Match pending transaction IDs to streams
      if (pendingStreamTxIdsRef.current.length > 0 && streamList.length > 0) {
        // Sort streams by ID (newest first)
        const sortedStreams = [...streamList].sort((a, b) => b.id - a.id)
        const pendingTxIds = [...pendingStreamTxIdsRef.current]
        
        // Match each pending txId to a stream that doesn't have one yet
        setStreamTxIds(prevTxIds => {
          const updated = { ...prevTxIds }
          let txIdIndex = 0
          
          for (const stream of sortedStreams) {
            if (!updated[stream.id] && txIdIndex < pendingTxIds.length) {
              updated[stream.id] = pendingTxIds[txIdIndex]
              console.log(`Matched txId to stream ${stream.id}`)
              txIdIndex++
            }
          }
          
          // Remove matched txIds from pending queue
          if (txIdIndex > 0) {
            pendingStreamTxIdsRef.current = pendingTxIds.slice(txIdIndex)
          }
          
          return updated
        })
      }
      
      // Show error message only once per session if contract is missing functions
      if (hasUndefinedFunctionError && streamList.length === 0 && !hasShownContractErrorRef.current) {
        hasShownContractErrorRef.current = true // Mark that we've shown the error
        toast.error('⚠️ Contract missing read functions. Your streams exist on-chain but cannot be displayed. Please redeploy the contract with updated read-only functions (get-stream, get-latest-stream-id).', {
          duration: 12000
        })
      } else if (rateLimitHit) {
        // Rate limit was hit - partial results might be available
        if (streamList.length > 0) {
          toast(`⚠️ Rate limit reached. Loaded ${streamList.length} stream(s) before stopping. Please wait a moment and refresh to load more.`, {
            duration: 6000,
            icon: '⚠️'
          })
        } else {
          toast.error('Rate limit reached. Please wait 30-60 seconds and refresh.', {
            duration: 5000
          })
        }
      } else if (streamList.length === 0 && !hasUndefinedFunctionError) {
        console.log('No streams found yet - this might mean:')
        console.log('1. Transaction has not confirmed yet (wait 1-2 minutes)')
        console.log('2. Transaction failed (check explorer)')
        console.log('3. Streams are associated with a different address')
        console.log('4. Contract read functions are not available (get-stream function missing)')
        
        toast('No streams found. If you just created one, wait 1-2 minutes and click Refresh.', {
          duration: 5000,
          icon: 'ℹ️'
        })
      } else {
        toast.success(`✅ Loaded ${streamList.length} stream(s)!`, {
          duration: 3000
        })
      }
    } catch (error) {
      console.error('Error loading streams:', error)
      const errorMessage = error?.message || error?.toString() || 'Unknown error'
      
      // More helpful error messages
      if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        toast.error('Rate limit reached. Please wait 30-60 seconds and refresh.', {
          duration: 5000
        })
      } else if (errorMessage.includes('ERR_NAME_NOT_RESOLVED') || errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast.error('Cannot connect to Stacks API. Please check your internet connection and try again.')
        console.error('Network connectivity issue. Check if you can access: https://api.testnet.hiro.so')
      } else if (errorMessage.includes('contract')) {
        toast.error('Contract not found. Please verify the contract address.')
      } else {
        toast.error(`Failed to load streams: ${errorMessage}`)
      }
      
      setStreams([])
    } finally {
      setLoading(false)
    }
  }

  const checkTransactionStatus = async (txId) => {
    try {
      // Wait a bit for transaction to be included in a block
      await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds
      
      const response = await fetch(`https://api.testnet.hiro.so/extended/v1/tx/${txId}`)
      const data = await response.json()
      
      console.log('Transaction status:', data)
      
      if (data.tx_status === 'success') {
        toast.success(`✅ Transaction confirmed successfully!`)
        return true
      } else if (data.tx_status === 'pending') {
        toast.info(`⏳ Transaction pending... Waiting for confirmation...`)
        // Check again after 30 seconds
        setTimeout(async () => {
          const status = await checkTransactionStatus(txId)
          if (status) loadStreams()
        }, 30000)
        return false
      } else if (data.tx_status === 'abort_by_response' || data.tx_status === 'abort_by_post_condition') {
        // Try to extract error details from the transaction result
        let errorMessage = `Transaction failed: ${data.tx_status.replace(/_/g, ' ')}`
        
        // Check for contract error details
        if (data.tx_result && data.tx_result.repr) {
          const errorRepr = data.tx_result.repr
          console.error('Contract error:', errorRepr)
          
          // Parse common error codes
          if (errorRepr.includes('u0') || errorRepr.includes('ERR_UNAUTHORIZED')) {
            errorMessage = '❌ Unauthorized: You are not authorized to perform this action. Only the sender can pause/cancel streams, and only the recipient can withdraw.'
          } else if (errorRepr.includes('u1') || errorRepr.includes('ERR_INVALID_SIGNATURE')) {
            errorMessage = '❌ Invalid signature: Signature verification failed. This usually happens with update-details function.'
          } else if (errorRepr.includes('u2') || errorRepr.includes('ERR_STREAM_STILL_ACTIVE')) {
            errorMessage = '❌ Stream still active: The stream is still active and cannot be refunded yet.'
          } else if (errorRepr.includes('u3') || errorRepr.includes('ERR_INVALID_STREAM_ID')) {
            errorMessage = '❌ Invalid stream ID: Stream does not exist or invalid stream ID provided.'
          } else if (errorRepr.includes('u4') || errorRepr.includes('ERR_STREAM_NOT_PAUSED')) {
            errorMessage = '❌ Stream is not paused: Cannot resume a stream that is not paused.'
          } else if (errorRepr.includes('u5') || errorRepr.includes('ERR_STREAM_ALREADY_PAUSED')) {
            errorMessage = '❌ Stream already paused: Cannot pause a stream that is already paused.'
          } else if (errorRepr.includes('u6') || errorRepr.includes('ERR_STREAM_CANCELLED')) {
            errorMessage = '❌ Stream cancelled: Cannot withdraw from a cancelled stream. Cancelled streams cannot be withdrawn from.'
          } else {
            errorMessage = `❌ Contract error: ${errorRepr}`
          }
          
          // Log full transaction data for debugging
          console.error('Full transaction data:', JSON.stringify(data, null, 2))
          console.error('Transaction result:', data.tx_result)
          console.error('Error representation:', errorRepr)
        }
        
        toast.error(errorMessage, { duration: 8000 })
        console.error('Transaction failed:', data)
        return false
      }
      
      return false
    } catch (error) {
      console.error('Error checking transaction status:', error)
      return false
    }
  }

  const handleContractCall = async (functionName, functionArgs, options = {}) => {
    if (!userData) {
      toast.error('Please connect your wallet first')
      return
    }

    try {
      setLoading(true)
      
      console.log('Calling contract:', {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName,
        network: 'testnet',
        userAddress: userData.profile.stxAddress.testnet
      })

      await openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName,
        functionArgs,
        network: testnetNetwork, // Use network object instead of string
        userSession,
        postConditionMode: PostConditionMode.Allow, // Allow transaction even if post-conditions don't match exactly
        postConditions: options.postConditions || [],
        onFinish: async (data) => {
          console.log('Transaction finished:', data)
          const txId = data.txId
          const explorerUrl = `https://explorer.stacks.co/txid/${txId}?chain=testnet`
          
          // If this is a stream creation, add the transaction ID to pending queue
          const isStreamCreation = functionName === 'stream-to'
          const isCancellation = functionName === 'cancel-stream'
          const cancelledStreamId = options.streamId
          
          if (isStreamCreation) {
            pendingStreamTxIdsRef.current.push(txId)
            console.log('Stream creation transaction added to queue:', txId)
          }
          
          toast.success(
            `Transaction submitted! TX: ${txId.substring(0, 8)}...\n⏳ Waiting for confirmation...\nView: ${explorerUrl}`,
            { 
              duration: 8000,
              icon: '📤'
            }
          )
          
          // Reset loading state immediately after submission
          setLoading(false)
          
          // For cancellations, reload more aggressively
          const reloadDelays = isCancellation ? [10000, 20000, 30000, 45000, 60000] : [10000, 20000]
          
          // Wait a bit for transaction to be included, then check status and load streams
          setTimeout(async () => {
            console.log('Checking transaction status...')
            const success = await checkTransactionStatus(txId)
            
            // Multiple reload attempts for cancellations to ensure UI updates
            reloadDelays.forEach((delay, index) => {
              setTimeout(() => {
                console.log(`Reloading streams (attempt ${index + 1}/${reloadDelays.length})...`)
                loadStreams()
              }, delay)
            })
            
            if (success) {
              // If confirmed, do immediate reload and then more delayed reloads
              console.log('Transaction confirmed! Reloading streams immediately...')
              loadStreams()
              
              // Additional reloads for cancellations to catch status updates
              if (isCancellation) {
                setTimeout(() => {
                  console.log('Extra reload for cancelled stream status update...')
                  loadStreams()
                }, 30000)
              }
            }
          }, 15000) // Wait 15 seconds before first check
        },
        onCancel: () => {
          console.log('Transaction cancelled')
          toast.error('Transaction cancelled')
          setLoading(false)
        },
        onError: (error) => {
          console.error('Transaction error in openContractCall:', error)
          const errorMessage = error?.message || error?.toString() || 'Unknown error'
          toast.error(`Transaction error: ${errorMessage}`)
          setLoading(false)
        },
      })
    } catch (error) {
      console.error('Transaction error:', error)
      const errorMessage = error?.message || error?.toString() || 'Unknown error'
      
      if (errorMessage.includes('ERR_NAME_NOT_RESOLVED') || errorMessage.includes('network')) {
        toast.error('Network error: Cannot connect to Stacks API. Please check your internet connection.')
      } else {
        toast.error(`Transaction failed: ${errorMessage}`)
      }
      setLoading(false)
    }
  }

  const pauseStream = async (streamId) => {
    console.log('Pausing stream:', streamId)
    try {
      await handleContractCall('pause-stream', [uintCV(streamId)])
    } catch (error) {
      console.error('Error pausing stream:', error)
      toast.error(`Failed to pause stream: ${error.message || error}`)
    }
  }

  const resumeStream = async (streamId) => {
    console.log('Resuming stream:', streamId)
    try {
      await handleContractCall('resume-stream', [uintCV(streamId)])
    } catch (error) {
      console.error('Error resuming stream:', error)
      toast.error(`Failed to resume stream: ${error.message || error}`)
    }
  }

  const cancelStream = async (streamId) => {
    console.log('Cancelling stream:', streamId)
    
    // Check if stream is already cancelled
    const stream = streams.find(s => s.id === streamId)
    if (stream) {
      const streamStatus = safeToNumber(stream.status)
      if (streamStatus === 2) {
        toast.error('Stream is already cancelled!', { duration: 3000 })
        return
      }
    }
    
    // Immediately mark as cancelled optimistically
    setRecentlyCancelledStreams(prev => new Set([...prev, streamId]))
    try {
      console.log('Calling cancel-stream with streamId:', streamId, 'type:', typeof streamId)
      await handleContractCall('cancel-stream', [uintCV(streamId)], { streamId })
    } catch (error) {
      console.error('Error cancelling stream:', error)
      toast.error(`Failed to cancel stream: ${error.message || error}`)
      // Remove from cancelled set if it failed
      setRecentlyCancelledStreams(prev => {
        const newSet = new Set(prev)
        newSet.delete(streamId)
        return newSet
      })
    }
  }

  const withdraw = (streamId) => {
    handleContractCall('withdraw', [uintCV(streamId)])
  }

  const createStream = async (formData) => {
    const { recipient, initialBalance, startBlock, stopBlock, paymentPerBlock } = formData
    
    // Wallet handles post-conditions and shows STX transfer for approval
    await handleContractCall('stream-to', [
      principalCV(recipient),
      uintCV(initialBalance),
      tupleCV({
        'start-block': uintCV(startBlock),
        'stop-block': uintCV(stopBlock),
      }),
      uintCV(paymentPerBlock),
    ])
  }

  useEffect(() => {
    if (userData) {
      loadStreams()
    }
  }, [userData])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Toaster position="top-right" />
      <Header 
        userData={userData}
        onConnect={connectWallet}
        onDisconnect={disconnectWallet}
      />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {userData ? (
          <>
            <CreateStreamForm 
              onSubmit={createStream}
              loading={loading}
              userAddress={userData.profile.stxAddress.testnet}
            />
            
            <StreamList
              streams={streams}
              userAddress={userData.profile.stxAddress.testnet}
              onPause={pauseStream}
              onResume={resumeStream}
              onCancel={cancelStream}
              onWithdraw={withdraw}
              loading={loading}
              onRefresh={loadStreams}
              streamTxIds={streamTxIds}
              recentlyCancelledStreams={recentlyCancelledStreams}
            />
          </>
        ) : (
          <div className="text-center py-20">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 max-w-md mx-auto">
              <h2 className="text-3xl font-bold text-white mb-4">
                Welcome to Token Streaming Protocol
              </h2>
              <p className="text-gray-300 mb-8">
                Connect your wallet to start creating and managing payment streams
              </p>
              <button
                onClick={connectWallet}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
