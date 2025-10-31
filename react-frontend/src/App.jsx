import { useState, useEffect } from 'react'
import { AppConfig, UserSession, showConnect, openContractCall } from '@stacks/connect'
import { createNetwork } from '@stacks/network'
import { 
  callReadOnlyFunction, 
  contractPrincipalCV, 
  uintCV, 
  principalCV,
  tupleCV,
  AnchorMode,
  PostConditionMode
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

        if (latestIdResult && latestIdResult.value !== undefined) {
          latestId = Number(latestIdResult.value) || 0
        }
      } catch (e) {
        // Function doesn't exist in deployed contract - fallback to sequential loading
        console.log('get-latest-stream-id not available, using sequential loading:', e.message)
        latestId = null // null means we'll try sequential loading
      }

      // If we have a latest ID, use it. Otherwise, try sequential loading
      if (latestId !== null && latestId > 0) {
        // Load streams up to the latest ID
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

            if (streamResult && streamResult.value) {
              streamList.push({
                id: i,
                ...streamResult.value,
              })
            }
          } catch (e) {
            // Stream doesn't exist - skip it
            console.log(`Stream ${i} not found`)
          }
        }
      } else {
        // Sequential loading: try stream IDs starting from 0 until we hit consecutive failures
        let consecutiveFailures = 0
        const maxConsecutiveFailures = 5 // Stop after 5 consecutive failures
        
        for (let i = 0; consecutiveFailures < maxConsecutiveFailures; i++) {
          try {
            const streamResult = await callReadOnlyFunction({
              network: 'testnet',
              contractAddress: CONTRACT_ADDRESS,
              contractName: CONTRACT_NAME,
              functionName: 'get-stream',
              functionArgs: [uintCV(i)],
              senderAddress: userData.profile.stxAddress.testnet,
            })

            if (streamResult && streamResult.value) {
              streamList.push({
                id: i,
                ...streamResult.value,
              })
              consecutiveFailures = 0 // Reset counter on success
            } else {
              consecutiveFailures++
            }
          } catch (e) {
            consecutiveFailures++
            if (consecutiveFailures >= maxConsecutiveFailures) {
              break // Stop searching
            }
          }
        }
      }

      setStreams(streamList)
      if (streamList.length === 0) {
        console.log('No streams found yet')
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
        onFinish: (data) => {
          console.log('Transaction finished:', data)
          toast.success(`Transaction submitted! TX: ${data.txId}`)
          setTimeout(() => loadStreams(), 2000)
          setLoading(false)
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
    
    // Note: openContractCall handles post-conditions automatically via the wallet
    // We don't need to manually add them for wallet-signed transactions
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
