import { Layers, TrendingUp, Zap, ArrowLeftRight, Shield, Wallet, ChevronDown, Copy, LogOut } from 'lucide-react'
import { useState } from 'react'
import { PLATFORM_STATS } from '../data.js'

const TABS = [
  { id: 'Pools',      label: 'Pools',      Icon: Layers         },
  { id: 'Lending',    label: 'Lending',    Icon: TrendingUp     },
  { id: 'Strategies', label: 'Strategies', Icon: Zap            },
  { id: 'Bridge',     label: 'Bridge',     Icon: ArrowLeftRight },
  { id: 'Security',   label: 'Security',   Icon: Shield         },
]

function truncate(addr) {
  if (!addr) return ''
  if (addr.startsWith('0x')) return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function Header({ tab, setTab, wallet, onConnectWallet, onDisconnect }) {
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyAddr = () => {
    if (wallet.address) navigator.clipboard.writeText(wallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <header style={{ backgroundColor: '#0d1424', borderBottom: '1px solid #1e293b' }}>
      {/* Main nav row */}
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="gradient-logo w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm">IH</div>
          <span className="font-bold text-white text-base tracking-tight">InvestHelper</span>
          <span className="text-dim text-sm">.com</span>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1 flex-1">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  color: active ? '#e2e8f0' : '#8b9dc3',
                  background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            )
          })}
        </nav>

        {/* Wallet */}
        <div className="relative flex-shrink-0">
          {wallet.connected ? (
            <>
              <button
                onClick={() => setWalletMenuOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{
                  background: wallet.chain === 'TON' ? 'rgba(0,152,234,0.15)' : 'rgba(130,71,229,0.15)',
                  border: wallet.chain === 'TON' ? '1px solid rgba(0,152,234,0.35)' : '1px solid rgba(130,71,229,0.35)',
                  color: wallet.chain === 'TON' ? '#0098ea' : '#8247e5',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: wallet.chain === 'TON' ? '#0098ea' : '#8247e5' }}
                />
                {truncate(wallet.address)}
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>
              {walletMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setWalletMenuOpen(false)} />
                  <div
                    className="absolute right-0 top-10 z-20 rounded-xl py-1 min-w-44"
                    style={{ background: '#1a2235', border: '1px solid #2a3a55' }}
                  >
                    <div className="px-3 py-2 border-b" style={{ borderColor: '#2a3a55' }}>
                      <div className="text-xs text-dim mb-0.5">{wallet.walletName}</div>
                      <div className="text-xs font-mono text-gray-300">{wallet.address}</div>
                    </div>
                    <button
                      onClick={() => { copyAddr(); setWalletMenuOpen(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? 'Copied!' : 'Copy address'}
                    </button>
                    <button
                      onClick={() => { onDisconnect(); setWalletMenuOpen(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-white/5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Disconnect
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <button onClick={onConnectWallet} className="btn-primary flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div
        className="max-w-7xl mx-auto px-4 h-9 flex items-center gap-6"
        style={{ borderTop: '1px solid #111e31' }}
      >
        <span className="flex items-center gap-1.5 text-xs text-dim">
          <span className="w-1.5 h-1.5 rounded-full bg-gain animate-pulse" />
          Live
        </span>
        {PLATFORM_STATS.map(({ label, value }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs">
            <span className="text-dim">{label}</span>
            <span className="font-semibold mono" style={{ color: '#e2e8f0' }}>{value}</span>
          </span>
        ))}
      </div>
    </header>
  )
}
