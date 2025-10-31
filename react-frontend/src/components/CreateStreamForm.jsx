import React, { useState } from 'react'
import toast from 'react-hot-toast'

const CreateStreamForm = ({ onSubmit, loading, userAddress }) => {
  const [formData, setFormData] = useState({
    recipient: userAddress || '',
    initialBalance: '1000000',
    startBlock: '0',
    stopBlock: '100',
    paymentPerBlock: '10000',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!formData.recipient) {
      toast.error('Please enter recipient address')
      return
    }

    if (Number(formData.initialBalance) <= 0) {
      toast.error('Initial balance must be greater than 0')
      return
    }

    if (Number(formData.stopBlock) <= Number(formData.startBlock)) {
      toast.error('Stop block must be greater than start block')
      return
    }

    onSubmit({
      recipient: formData.recipient,
      initialBalance: Number(formData.initialBalance),
      startBlock: Number(formData.startBlock),
      stopBlock: Number(formData.stopBlock),
      paymentPerBlock: Number(formData.paymentPerBlock),
    })

    setFormData({
      recipient: userAddress || '',
      initialBalance: '1000000',
      startBlock: '0',
      stopBlock: '100',
      paymentPerBlock: '10000',
    })
  }

  return (
    <div className="mb-8">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-white/20">
        <h2 className="text-2xl font-bold text-white mb-6">Create New Stream</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                value={formData.recipient}
                onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                placeholder="ST..."
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Initial Balance (microSTX)
              </label>
              <input
                type="number"
                value={formData.initialBalance}
                onChange={(e) => setFormData({ ...formData, initialBalance: e.target.value })}
                placeholder="1000000"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
              <p className="text-xs text-gray-400 mt-1">1 STX = 1,000,000 microSTX</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Start Block
              </label>
              <input
                type="number"
                value={formData.startBlock}
                onChange={(e) => setFormData({ ...formData, startBlock: e.target.value })}
                placeholder="0"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Stop Block
              </label>
              <input
                type="number"
                value={formData.stopBlock}
                onChange={(e) => setFormData({ ...formData, stopBlock: e.target.value })}
                placeholder="100"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Payment Per Block (microSTX)
              </label>
              <input
                type="number"
                value={formData.paymentPerBlock}
                onChange={(e) => setFormData({ ...formData, paymentPerBlock: e.target.value })}
                placeholder="10000"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            {loading ? 'Creating...' : 'Create Stream'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default CreateStreamForm
