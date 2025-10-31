import { useState, useEffect } from 'react'
import { AppConfig, UserSession, showConnect } from '@stacks/connect'
import { createNetwork } from '@stacks/network'
import { 
  callReadOnlyFunction, 
  contractPrincipalCV, 
  uintCV, 
  principalCV,
  tupleCV,
  makeContractCall,
  broadcastTransaction,
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
    showConnect({
      appDetails: {
        name: 'Token Streaming Protocol',
        icon: window.location.origin + '/icon.png',
      },
      redirectTo: '/',
      network: testnetNetwork,
      onFinish: () => {
        const data = userSession.loadUserData()
        setUserData(data)
        toast.success('Wallet connected!')
        loadStreams()
      },
      onCancel: () => {
        toast.error('Wallet connection cancelled')
      },
      userSession,
    })
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
      
      // Get latest stream ID
      const latestIdResult = await callReadOnlyFunction({
        network: 'testnet',
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-latest-stream-id',
        functionArgs: [],
        senderAddress: userData.profile.stxAddress.testnet,
      })

      // Handle response - check if it's an error
      if (latestIdResult && latestIdResult.value !== undefined) {
        const latestId = Number(latestIdResult.value) || 0
        const streamList = []

        // Try to load streams up to the latest ID
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

            // Check if result exists and has value
            if (streamResult && streamResult.value) {
              streamList.push({
                id: i,
                ...streamResult.value,
              })
            }
          } catch (e) {
            // Stream doesn't exist or error - skip it
            console.log(`Stream ${i} not found or error:`, e.message || e)
          }
        }

        setStreams(streamList)
        if (streamList.length === 0 && latestId === 0) {
          // No streams yet - this is normal
          console.log('No streams found yet')
        }
      } else {
        // Handle error response
        console.error('Error getting latest stream ID:', latestIdResult)
        toast.error('Unable to fetch stream count. Please check your connection.')
        setStreams([])
      }
    } catch (error) {
      console.error('Error loading streams:', error)
      const errorMessage = error?.message || error?.toString() || 'Unknown error'
      
      // More helpful error messages
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast.error('Network error. Please check your internet connection.')
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
      const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName,
        functionArgs,
        senderKey: userData.appPrivateKey,
        network: testnetNetwork,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        ...options,
      }

      const transaction = await makeContractCall(txOptions)
      const broadcastResponse = await broadcastTransaction(transaction, testnetNetwork)
      
      if (broadcastResponse.error) {
        throw new Error(broadcastResponse.error)
      }

      toast.success(`Transaction submitted! TX: ${broadcastResponse.txid}`)
      setTimeout(() => loadStreams(), 2000)
    } catch (error) {
      console.error('Transaction error:', error)
      toast.error(`Transaction failed: ${error.message}`)
    } finally {
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
