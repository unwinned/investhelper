import { useState } from 'react'
import { X, Loader2, AlertCircle, CheckCircle2, Copy, LogOut, Wallet } from 'lucide-react'

function truncate(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

export default function WalletModal({
  onClose,
  tonWallet, evmWallet,
  onConnectTon, onConnectEVM,
  onDisconnectTon, onDisconnectEVM,
}) {
  const [connecting,  setConnecting]  = useState(null)
  const [error,       setError]       = useState(null)
  const [copiedTon,   setCopiedTon]   = useState(false)
  const [copiedEVM,   setCopiedEVM]   = useState(false)

  const handleConnectTon = () => {
    onConnectTon()
    onClose()
  }

  const handleConnectEVM = async () => {
    setConnecting('evm')
    setError(null)
    try {
      await onConnectEVM()
    } catch (e) {
      setError(e.message)
    } finally {
      setConnecting(null)
    }
  }

  const copy = (addr, setter) => {
    navigator.clipboard.writeText(addr)
    setter(true)
    setTimeout(() => setter(false), 1500)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div className="relative w-full max-w-sm rounded-2xl" style={{ background: '#111827', border: '1px solid #1e293b' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#1e293b' }}>
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-dim" />
            <h2 className="font-semibold text-white">Wallets</h2>
          </div>
          <button onClick={onClose} className="text-dim hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}

          {/* ── TON ─────────────────────────────────────────── */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: '#0d1526', border: '1px solid #1e293b' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="pill pill-ton text-xs">TON</span>
                <span className="text-xs text-dim">TON Connect 2.0</span>
              </div>
              {tonWallet.connected && (
                <span className="flex items-center gap-1 text-xs text-gain">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              )}
            </div>

            {tonWallet.connected ? (
              <>
                <div className="text-xs font-mono text-gray-400 px-1 break-all">{tonWallet.address}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copy(tonWallet.address, setCopiedTon)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ background: 'rgba(0,152,234,0.1)', border: '1px solid rgba(0,152,234,0.2)', color: '#0098ea' }}
                  >
                    <Copy className="w-3 h-3" />
                    {copiedTon ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={() => { onDisconnectTon(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                  >
                    <LogOut className="w-3 h-3" />
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={handleConnectTon}
                  className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'rgba(0,152,234,0.12)', border: '1px solid rgba(0,152,234,0.3)', color: '#0098ea' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,152,234,0.2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,152,234,0.12)' }}
                >
                  Connect TON Wallet
                </button>
                <p className="text-xs text-dim text-center">Scan QR with Tonkeeper, MyTonWallet, or use browser extension</p>
              </>
            )}
          </div>

          {/* ── EVM (Polygon / Base / BNB) ────────────────────── */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: '#0d1526', border: '1px solid #1e293b' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="pill pill-poly text-xs">EVM</span>
                <span className="text-xs text-dim">MetaMask · Polygon / Base / BNB</span>
              </div>
              {evmWallet.connected && (
                <span className="flex items-center gap-1 text-xs text-gain">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              )}
            </div>

            {evmWallet.connected ? (
              <>
                <div className="text-xs font-mono text-gray-400 px-1 break-all">{evmWallet.address}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copy(evmWallet.address, setCopiedEVM)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ background: 'rgba(130,71,229,0.1)', border: '1px solid rgba(130,71,229,0.2)', color: '#8247e5' }}
                  >
                    <Copy className="w-3 h-3" />
                    {copiedEVM ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={() => { onDisconnectEVM(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                  >
                    <LogOut className="w-3 h-3" />
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={handleConnectEVM}
                  disabled={connecting === 'evm'}
                  className="w-full py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'rgba(130,71,229,0.12)', border: '1px solid rgba(130,71,229,0.3)', color: '#8247e5' }}
                  onMouseEnter={e => { if (!connecting) e.currentTarget.style.background = 'rgba(130,71,229,0.2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(130,71,229,0.12)' }}
                >
                  {connecting === 'evm' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Connect MetaMask
                </button>
                <p className="text-xs text-dim text-center">Works on Polygon, Base, and BNB Chain automatically</p>
              </>
            )}
          </div>
        </div>

        <div className="px-5 pb-5">
          <p className="text-xs text-dim text-center">Non-custodial · Both wallets can be active simultaneously</p>
        </div>
      </div>
    </div>
  )
}
