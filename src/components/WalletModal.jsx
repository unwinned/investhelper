import { useState } from 'react'
import { X, Loader2, AlertCircle } from 'lucide-react'

export default function WalletModal({ onClose, openTonModal, connectMetaMask, onConnected }) {
  const [connecting, setConnecting] = useState(null)
  const [error, setError] = useState(null)

  const handleTON = () => {
    openTonModal()   // opens TonConnect's own modal (QR / deep link / extension)
    // onClose is already called in App.jsx via the openTonModal wrapper
  }

  const handleMetaMask = async () => {
    setConnecting('MetaMask')
    setError(null)
    try {
      await connectMetaMask()
      onConnected()
    } catch (e) {
      setError(e.message)
    } finally {
      setConnecting(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div className="relative w-full max-w-sm rounded-2xl" style={{ background: '#111827', border: '1px solid #1e293b' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#1e293b' }}>
          <h2 className="font-semibold text-white">Connect Wallet</h2>
          <button onClick={onClose} className="text-dim hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}

          {/* TON */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="pill pill-ton">TON</span>
              <span className="text-xs text-dim">TON Connect 2.0</span>
            </div>
            <button
              onClick={handleTON}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-sm font-medium text-gray-200"
              style={{ background: '#1a2235', border: '1px solid #2a3a55' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,152,234,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a3a55' }}
            >
              <span>Connect TON Wallet</span>
              <span className="text-xs text-dim">Tonkeeper · MyTonWallet · OpenMask…</span>
            </button>
            <p className="text-xs text-dim mt-1.5 px-1">Opens TonConnect modal — scan QR or use browser extension.</p>
          </div>

          <div className="border-t" style={{ borderColor: '#1e293b' }} />

          {/* Polygon */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="pill pill-poly">POLYGON</span>
              <span className="text-xs text-dim">WalletConnect v2</span>
            </div>
            <button
              onClick={handleMetaMask}
              disabled={connecting === 'MetaMask'}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-sm font-medium text-gray-200 disabled:opacity-50"
              style={{ background: '#1a2235', border: '1px solid #2a3a55' }}
              onMouseEnter={e => { if (!connecting) e.currentTarget.style.borderColor = 'rgba(130,71,229,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a3a55' }}
            >
              <span>MetaMask</span>
              {connecting === 'MetaMask'
                ? <Loader2 className="w-4 h-4 text-poly animate-spin" />
                : <span className="text-xs text-dim">window.ethereum</span>}
            </button>
          </div>
        </div>

        <div className="px-5 pb-5">
          <p className="text-xs text-dim text-center">Non-custodial · Your keys stay in your wallet</p>
        </div>
      </div>
    </div>
  )
}
