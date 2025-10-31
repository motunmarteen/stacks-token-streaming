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
  FungibleConditionCode
} from '@stacks/transactions'
import toast, { Toaster } from 'react-hot-toast'
import StreamList from './components/StreamList'
import CreateStreamForm from './components/CreateStreamForm'
import Header from './components/Header'

const CONTRACT_ADDRESS = 'ST3DJAD94M03E59W51PWD3VT0XH3S8VXZPXT59P5G'
const CONTRACT_NAME = 'stream'
const testnetNetwork = createNetwork('testnet')

const appConfig = new AppConfig(['store_write', 'publish_data'], 'testnet')
const userSession = new UserSession({ appConfig })

function App() {
  const [userData, setUserData] = useState(null)
  const [streams, setStreams] = useState([])
  const [loading, setLoading] = useState(false)
  const hasShownContractErrorRef = useRef(false) // Track if we've shown the contract error

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

  const loadStreams = async () => {
    if (!userData) return

    try {
      setLoading(true)
      const streamList = []
      let latestId = 0
      let hasUndefinedFunctionError = false // Track if we've seen this error

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
        latestId = null // null means we'll try sequential loading
      }

      // If we have a latest ID, use it. Otherwise, try sequential loading
      if (latestId !== null && latestId > 0) {
        // Load streams up to the latest ID
        console.log(`Loading ${latestId} streams...`)
        for (let i = 0; i < latestId; i++) {
          try {
            const streamResult = await callReadOnlyFunction({
              network: 'testnet',
              contractAddress: CONTRACT_ADDRESS,
              contractName: CONTRACT_NAME,
              functionName: 'get-stream',
              functionArgs: [uintCV(i)],
              senderAddress: userData.profile.stxAddress.testnet,
            })

            console.log(`Stream ${i} result:`, streamResult)
            if (streamResult && streamResult.value) {
              streamList.push({
                id: i,
                ...streamResult.value,
              })
              console.log(`Added stream ${i} to list`)
            }
          } catch (e) {
            // Stream doesn't exist - skip it
            console.log(`Stream ${i} not found:`, e.message)
          }
        }
      } else {
        // Sequential loading: try stream IDs starting from 0 until we hit consecutive failures
        console.log('Using sequential loading...')
        let consecutiveFailures = 0
        const maxConsecutiveFailures = 20 // Increased to find more streams (you have multiple transactions)
        
        for (let i = 0; consecutiveFailures < maxConsecutiveFailures; i++) {
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

            console.log(`Stream ${i} result:`, streamResult)
            console.log(`Stream ${i} result type:`, typeof streamResult)
            console.log(`Stream ${i} result.value:`, streamResult?.value)
            console.log(`Stream ${i} result.okay:`, streamResult?.okay)
            
            // Handle different response formats
            let streamData = null
            if (streamResult?.okay) {
              // Clarity ok response
              streamData = streamResult.okay
            } else if (streamResult?.value) {
              // Direct value
              streamData = streamResult.value
            } else if (streamResult) {
              // Try streamResult itself
              streamData = streamResult
            }
            
            if (streamData) {
              streamList.push({
                id: i,
                ...streamData,
              })
              console.log(`✅ Added stream ${i} to list:`, streamData)
              consecutiveFailures = 0 // Reset counter on success
            } else {
              console.log(`⚠️ Stream ${i} returned empty/invalid value. Full result:`, streamResult)
              consecutiveFailures++
            }
          } catch (e) {
            console.error(`❌ Stream ${i} error:`, e)
            console.error(`Error details:`, {
              message: e.message,
              stack: e.stack,
              name: e.name
            })
            
            // If it's an undefined function error, stop trying - contract doesn't have the function
            if (e.message && e.message.includes('UndefinedFunction')) {
              console.error('❌ Contract does not have get-stream function. The deployed contract is missing read-only functions.')
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
      
      // Show error message only once per session if contract is missing functions
      if (hasUndefinedFunctionError && streamList.length === 0 && !hasShownContractErrorRef.current) {
        hasShownContractErrorRef.current = true // Mark that we've shown the error
        toast.error('⚠️ Contract missing read functions. Your streams exist on-chain but cannot be displayed. Please redeploy the contract with updated read-only functions (get-stream, get-latest-stream-id).', {
          duration: 12000
        })
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
      if (errorMessage.includes('ERR_NAME_NOT_RESOLVED') || errorMessage.includes('network') || errorMessage.includes('fetch')) {
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
        toast.success(`✅ Transaction confirmed! Stream created successfully.`)
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
        toast.error(`❌ Transaction failed: ${data.tx_status.replace('_', ' ')}. Check the explorer for details.`)
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
        network: 'testnet',
        userSession,
        postConditionMode: PostConditionMode.Allow, // Allow transaction even if post-conditions don't match exactly
        postConditions: options.postConditions || [],
        onFinish: async (data) => {
          console.log('Transaction finished:', data)
          const txId = data.txId
          const explorerUrl = `https://explorer.stacks.co/txid/${txId}?chain=testnet`
          
          toast.success(
            `Transaction submitted! TX: ${txId.substring(0, 8)}...\n⏳ Waiting for confirmation...\nView: ${explorerUrl}`,
            { 
              duration: 8000,
              icon: '📤'
            }
          )
          
          // Reset loading state immediately after submission
          setLoading(false)
          
          // Wait a bit for transaction to be included, then check status and load streams
          setTimeout(async () => {
            console.log('Checking transaction status...')
            const success = await checkTransactionStatus(txId)
            
            // Always try to load streams after a delay (transaction might be confirmed)
            console.log('Loading streams after transaction...')
            setTimeout(() => {
              loadStreams()
            }, 10000) // Wait 10 seconds for indexing
            
            if (success) {
              // If confirmed, load streams again after a bit more time
              setTimeout(() => {
                console.log('Reloading streams after confirmation...')
                loadStreams()
              }, 20000)
            }
          }, 15000) // Wait 15 seconds before first check
        },
        onCancel: () => {
          console.log('Transaction cancelled')
          toast.error('Transaction cancelled')
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

  const pauseStream = (streamId) => {
    handleContractCall('pause-stream', [uintCV(streamId)])
  }

  const resumeStream = (streamId) => {
    handleContractCall('resume-stream', [uintCV(streamId)])
  }

  const cancelStream = (streamId) => {
    handleContractCall('cancel-stream', [uintCV(streamId)])
  }

  const withdraw = (streamId) => {
    handleContractCall('withdraw', [uintCV(streamId)])
  }

  const createStream = async (formData) => {
    const { recipient, initialBalance, startBlock, stopBlock, paymentPerBlock } = formData
    
    // Note: openContractCall/wallet handles post-conditions automatically
    // The wallet UI will show the STX transfer to the user for approval
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
