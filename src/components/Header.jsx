import { Layers, TrendingUp, Zap, ArrowLeftRight, Shield, Wallet, ChevronDown, Copy, LogOut } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
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
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// ─── Single wallet chip with its own dropdown ─────────────────────────────

function WalletChip({ wallet, onConnect, onDisconnect, accentColor, borderColor, label }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const copyAddr = () => {
    if (wallet.address) navigator.clipboard.writeText(wallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!wallet.connected) {
    return (
      <button
        onClick={onConnect}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2a3a55', color: '#8b9dc3' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.color = accentColor }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a3a55'; e.currentTarget.style.color = '#8b9dc3' }}
      >
        <Wallet className="w-3 h-3" />
        {label}
      </button>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{ background: `${accentColor}18`, border: `1px solid ${borderColor}`, color: accentColor }}
      >
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: accentColor }} />
        {truncate(wallet.address)}
        <ChevronDown className="w-3 h-3 opacity-60" style={{ transform: open ? 'rotate(180deg)' : '' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-9 z-50 rounded-xl py-1 min-w-52"
          style={{ background: '#141e30', border: '1px solid #2a3a55', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
        >
          <div className="px-3 py-2.5 border-b" style={{ borderColor: '#2a3a55' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
              <span className="text-xs font-medium" style={{ color: accentColor }}>{wallet.walletName}</span>
            </div>
            <div className="text-xs font-mono text-gray-400 break-all">{wallet.address}</div>
          </div>
          <button
            onClick={() => { copyAddr(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Copied!' : 'Copy address'}
          </button>
          <button
            onClick={() => { onDisconnect(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
            style={{ color: '#f87171' }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────

export default function Header({ tab, setTab, tonWallet, evmWallet, onConnectTon, onConnectEVM, onDisconnectTon, onDisconnectEVM }) {
  return (
    <header style={{ backgroundColor: '#0d1424', borderBottom: '1px solid #1e293b' }}>
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
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

        {/* Dual wallet chips */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <WalletChip
            wallet={tonWallet}
            onConnect={onConnectTon}
            onDisconnect={onDisconnectTon}
            accentColor="#0098ea"
            borderColor="rgba(0,152,234,0.4)"
            label="Connect TON"
          />
          <WalletChip
            wallet={evmWallet}
            onConnect={onConnectEVM}
            onDisconnect={onDisconnectEVM}
            accentColor="#8247e5"
            borderColor="rgba(130,71,229,0.4)"
            label="Connect Wallet"
          />
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
