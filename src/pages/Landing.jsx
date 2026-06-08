import { POOLS, TON_STRATEGIES, POLYGON_STRATEGIES, BNB_STRATEGIES } from '../data.js'
import { Wallet, LogOut, Copy } from 'lucide-react'
import { useState } from 'react'

function truncate(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function WalletButton({ wallet, onConnect, onDisconnect, color, label }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    if (wallet.address) navigator.clipboard.writeText(wallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!wallet?.connected) {
    return (
      <button
        onClick={onConnect}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
        style={{ background: `${color}10`, border: `1px solid ${color}30`, color }}
        onMouseEnter={e => { e.currentTarget.style.background = `${color}20`; e.currentTarget.style.borderColor = `${color}60` }}
        onMouseLeave={e => { e.currentTarget.style.background = `${color}10`; e.currentTarget.style.borderColor = `${color}30` }}
      >
        <Wallet className="w-3.5 h-3.5" />
        {label}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 rounded-xl overflow-hidden" style={{ border: `1px solid ${color}30` }}>
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ background: `${color}10` }}
      >
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="mono text-xs" style={{ color }}>{truncate(wallet.address)}</span>
      </div>
      <button
        onClick={copy}
        className="px-2 py-2 transition-colors"
        style={{ background: `${color}08`, color: '#4a5e7a' }}
        onMouseEnter={e => e.currentTarget.style.color = color}
        onMouseLeave={e => e.currentTarget.style.color = '#4a5e7a'}
        title="Copy address"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onDisconnect}
        className="px-2 py-2 transition-colors"
        style={{ background: `${color}08`, color: '#4a5e7a' }}
        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
        onMouseLeave={e => e.currentTarget.style.color = '#4a5e7a'}
        title="Disconnect"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// Chain accent colours — must match app
const CHAIN_COLOR = { TON: '#0098ea', Polygon: '#8247e5', Base: '#2563eb', BNB: '#f59e0b' }

function ChainBadge({ chain }) {
  const c = CHAIN_COLOR[chain] ?? '#8b9dc3'
  return (
    <span
      className="mono"
      style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
        color: c, background: `${c}18`, borderRadius: 5,
        padding: '2px 6px', border: `1px solid ${c}30`,
      }}
    >
      {chain}
    </span>
  )
}

// ─── Featured pool rows ───────────────────────────────────────────────────────
const FEATURED_POOLS = [
  POOLS.find(p => p.id === 7),  // NOT/TON – high APY TON
  POOLS.find(p => p.id === 15), // WETH/USDC – Polygon
  POOLS.find(p => p.id === 33), // USDC/USDbC – Base stable
  POOLS.find(p => p.id === 42), // USDT/USDC – BNB stable
].filter(Boolean)

// ─── Featured strategies ─────────────────────────────────────────────────────
const FEATURED_STRATS = [
  TON_STRATEGIES.find(s => s.id === 'ton-alpha-hunt'),
  POLYGON_STRATEGIES.find(s => s.id === 'poly-stablecoin-vault'),
  BNB_STRATEGIES.find(s => s.id === 'bnb-yield-accelerator'),
].filter(Boolean)

const TIER_COLOR = {
  'Super Safe': '#00d4aa',
  'Safe':       '#0098ea',
  'Middle':     '#f97316',
  'Alpha Seeker': '#ef4444',
}

// ─── Card shells ─────────────────────────────────────────────────────────────

function DEXCard({ onClick }) {
  const totalTVL = POOLS.reduce((s, p) => s + p.tvl, 0)
  const fmtTVL = v => v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : `$${(v/1e6).toFixed(0)}M`

  return (
    <button
      onClick={onClick}
      className="group text-left flex flex-col rounded-2xl transition-all duration-200 overflow-hidden"
      style={{
        background: 'rgba(0,152,234,0.05)',
        border: '1px solid rgba(0,152,234,0.2)',
        flex: 1,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(0,152,234,0.09)'
        e.currentTarget.style.borderColor = 'rgba(0,152,234,0.45)'
        e.currentTarget.style.transform = 'translateY(-3px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(0,152,234,0.05)'
        e.currentTarget.style.borderColor = 'rgba(0,152,234,0.2)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between" style={{ padding: '22px 22px 16px' }}>
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span style={{ fontSize: 22 }}>📊</span>
            <span className="font-bold text-white" style={{ fontSize: 20 }}>DEXs</span>
          </div>
          <span style={{ color: '#4a5e7a', fontSize: 13 }}>Pools · Lending · Live rates</span>
        </div>
        <span style={{ color: '#0098ea', fontSize: 13, fontWeight: 600 }}>Enter →</span>
      </div>

      {/* Pool rows */}
      <div style={{ borderTop: '1px solid rgba(0,152,234,0.12)', borderBottom: '1px solid rgba(0,152,234,0.12)' }}>
        {FEATURED_POOLS.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center justify-between"
            style={{
              padding: '9px 22px',
              borderBottom: i < FEATURED_POOLS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined,
            }}
          >
            <div className="flex items-center gap-2">
              <ChainBadge chain={p.chain} />
              <span style={{ color: '#c8d6e8', fontSize: 13, fontWeight: 500 }}>{p.pair}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span style={{ color: '#4a5e7a', fontSize: 11 }}>{p.dex}</span>
              <span className="mono font-bold" style={{ color: '#00d4aa', fontSize: 13 }}>{p.apy}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer stats */}
      <div className="flex items-center gap-4" style={{ padding: '13px 22px' }}>
        {[
          ['Pools', POOLS.length],
          ['Chains', '4'],
          ['TVL', fmtTVL(totalTVL)],
        ].map(([label, val]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span style={{ color: '#4a5e7a', fontSize: 11 }}>{label}</span>
            <span className="mono" style={{ color: '#8b9dc3', fontSize: 12, fontWeight: 600 }}>{val}</span>
          </div>
        ))}
      </div>
    </button>
  )
}

function StrategiesCard({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="group text-left flex flex-col rounded-2xl transition-all duration-200 overflow-hidden"
      style={{
        background: 'rgba(130,71,229,0.05)',
        border: '1px solid rgba(130,71,229,0.2)',
        flex: 1,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(130,71,229,0.10)'
        e.currentTarget.style.borderColor = 'rgba(130,71,229,0.45)'
        e.currentTarget.style.transform = 'translateY(-3px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(130,71,229,0.05)'
        e.currentTarget.style.borderColor = 'rgba(130,71,229,0.2)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between" style={{ padding: '22px 22px 16px' }}>
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span style={{ fontSize: 22 }}>⚡</span>
            <span className="font-bold text-white" style={{ fontSize: 20 }}>Strategies</span>
          </div>
          <span style={{ color: '#4a5e7a', fontSize: 13 }}>Automated multi-step yield</span>
        </div>
        <span style={{ color: '#8247e5', fontSize: 13, fontWeight: 600 }}>Enter →</span>
      </div>

      {/* Strategy rows */}
      <div style={{ borderTop: '1px solid rgba(130,71,229,0.12)', borderBottom: '1px solid rgba(130,71,229,0.12)' }}>
        {FEATURED_STRATS.map((s, i) => (
          <div
            key={s.id}
            className="flex items-center justify-between"
            style={{
              padding: '9px 22px',
              borderBottom: i < FEATURED_STRATS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined,
            }}
          >
            <div className="flex items-center gap-2">
              <ChainBadge chain={s.chain} />
              <span style={{ color: '#c8d6e8', fontSize: 13, fontWeight: 500 }}>{s.name}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span
                style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                  color: TIER_COLOR[s.tier] ?? '#8b9dc3',
                  background: `${TIER_COLOR[s.tier] ?? '#8b9dc3'}18`,
                  borderRadius: 5, padding: '2px 6px',
                  border: `1px solid ${TIER_COLOR[s.tier] ?? '#8b9dc3'}30`,
                }}
              >
                {s.tier}
              </span>
              <span className="mono font-bold" style={{ color: '#00d4aa', fontSize: 13 }}>
                {s.apyMin}–{s.apyMax}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer stats */}
      <div className="flex items-center gap-4" style={{ padding: '13px 22px' }}>
        {[
          ['Strategies', '16'],
          ['Chains', '4'],
          ['One-click', 'Yes'],
        ].map(([label, val]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span style={{ color: '#4a5e7a', fontSize: 11 }}>{label}</span>
            <span className="mono" style={{ color: '#8b9dc3', fontSize: 12, fontWeight: 600 }}>{val}</span>
          </div>
        ))}
      </div>
    </button>
  )
}

function StocksCard() {
  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(245,158,11,0.03)',
        border: '1px solid rgba(245,158,11,0.13)',
        flex: 1,
        opacity: 0.55,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between" style={{ padding: '22px 22px 16px' }}>
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span style={{ fontSize: 22 }}>📈</span>
            <span className="font-bold text-white" style={{ fontSize: 20 }}>Stocks</span>
          </div>
          <span style={{ color: '#4a5e7a', fontSize: 13 }}>Equities · ETFs · Indices</span>
        </div>
        <span style={{ color: '#f59e0b', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>COMING SOON</span>
      </div>

      {/* Placeholder rows */}
      <div style={{ borderTop: '1px solid rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
        {['AAPL · NASDAQ', 'SPY · S&P 500', 'BRK.B · Berkshire'].map((label, i, arr) => (
          <div
            key={label}
            className="flex items-center justify-between"
            style={{
              padding: '9px 22px',
              borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined,
            }}
          >
            <span style={{ color: '#4a5e7a', fontSize: 13 }}>{label}</span>
            <span style={{ color: '#2a3a55', fontSize: 13 }} className="mono">—</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '13px 22px' }}>
        <span style={{ color: '#3a4a65', fontSize: 11 }}>Tokenised stock exposure on-chain</span>
      </div>
    </div>
  )
}

function BridgeCard({ onClick }) {
  const ROUTES = [
    { from: 'TON',     to: 'Polygon', tokens: 'USDC · USDT · WETH' },
    { from: 'TON',     to: 'Base',    tokens: 'USDC · WETH · cbBTC' },
    { from: 'Polygon', to: 'TON',     tokens: 'USDC · WETH · WBTC'  },
  ]
  const CHAIN_COLOR = { TON: '#0098ea', Polygon: '#8247e5', Base: '#2563eb', BNB: '#f59e0b' }
  return (
    <button
      onClick={onClick}
      className="flex flex-col rounded-2xl overflow-hidden text-left transition-all duration-200"
      style={{
        background: 'rgba(0,152,234,0.04)',
        border: '1px solid rgba(0,152,234,0.15)',
        flex: 1,
        cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,152,234,0.4)'; e.currentTarget.style.background = 'rgba(0,152,234,0.07)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,152,234,0.15)'; e.currentTarget.style.background = 'rgba(0,152,234,0.04)' }}
    >
      <div className="flex items-start justify-between" style={{ padding: '22px 22px 16px' }}>
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span style={{ fontSize: 22 }}>🔀</span>
            <span className="font-bold text-white" style={{ fontSize: 20 }}>Cross-chain</span>
          </div>
          <span style={{ color: '#4a5e7a', fontSize: 13 }}>Omniston · Live quotes · Non-custodial</span>
        </div>
        <span className="mono" style={{ color: '#00d4aa', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span>
      </div>

      <div style={{ borderTop: '1px solid rgba(0,152,234,0.1)', borderBottom: '1px solid rgba(0,152,234,0.1)' }}>
        {ROUTES.map((r, i, arr) => (
          <div
            key={r.from + r.to}
            className="flex items-center justify-between"
            style={{ padding: '9px 22px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}
          >
            <div className="flex items-center gap-2">
              <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: CHAIN_COLOR[r.from] ?? '#8b9dc3', background: `${CHAIN_COLOR[r.from]}18`, border: `1px solid ${CHAIN_COLOR[r.from]}35`, borderRadius: 4, padding: '1px 6px' }}>{r.from}</span>
              <span style={{ color: '#2a3a55', fontSize: 12 }}>→</span>
              <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: CHAIN_COLOR[r.to] ?? '#8b9dc3', background: `${CHAIN_COLOR[r.to]}18`, border: `1px solid ${CHAIN_COLOR[r.to]}35`, borderRadius: 4, padding: '1px 6px' }}>{r.to}</span>
            </div>
            <span style={{ color: '#4a5e7a', fontSize: 12 }}>{r.tokens}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between" style={{ padding: '13px 22px' }}>
        <span style={{ color: '#3a4a65', fontSize: 11 }}>Powered by Omniston resolvers</span>
        <span style={{ color: '#0098ea', fontSize: 11 }}>→</span>
      </div>
    </button>
  )
}

// ─── Landing page ─────────────────────────────────────────────────────────────

export default function Landing({ onEnter, tonWallet, evmWallet, onConnectTon, onConnectEVM, onDisconnectTon, onDisconnectEVM }) {
  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#000' }}
    >
      {/* Background circles — heavily blurred colour blobs */}
      <div style={{
        position: 'absolute', width: 700, height: 700, borderRadius: '50%',
        top: '-200px', left: '-220px',
        background: 'radial-gradient(circle, rgba(130,71,229,0.32) 0%, transparent 65%)',
        filter: 'blur(90px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        bottom: '-150px', right: '-150px',
        background: 'radial-gradient(circle, rgba(0,152,234,0.28) 0%, transparent 65%)',
        filter: 'blur(90px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        bottom: '5%', left: '10%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.22) 0%, transparent 65%)',
        filter: 'blur(100px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 350, height: 350, borderRadius: '50%',
        top: '18%', right: '8%',
        background: 'radial-gradient(circle, rgba(130,71,229,0.20) 0%, transparent 65%)',
        filter: 'blur(80px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 250, height: 250, borderRadius: '50%',
        top: '40%', left: '40%',
        background: 'radial-gradient(circle, rgba(0,152,234,0.12) 0%, transparent 60%)',
        filter: 'blur(70px)', pointerEvents: 'none',
      }} />

      {/* Top bar — logo + wallets */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="gradient-logo w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm">IH</div>
          <span className="font-bold text-white" style={{ fontSize: 17, letterSpacing: '-0.01em' }}>InvestHelper</span>
        </div>
        <div className="flex items-center gap-2">
          <WalletButton
            wallet={tonWallet ?? { connected: false }}
            onConnect={onConnectTon}
            onDisconnect={onDisconnectTon}
            color="#0098ea"
            label="Connect TON"
          />
          <WalletButton
            wallet={evmWallet ?? { connected: false }}
            onConnect={onConnectEVM}
            onDisconnect={onDisconnectEVM}
            color="#8247e5"
            label="Connect Wallet"
          />
        </div>
      </div>

      {/* Main content */}
      <div
        className="relative z-10 flex flex-col items-center text-center w-full"
        style={{ padding: '0 24px', gap: 44, maxWidth: 1100 }}
      >
        <div className="flex flex-col items-center" style={{ gap: 12 }}>
          <h1
            className="font-bold text-white"
            style={{ fontSize: 46, lineHeight: 1.13, letterSpacing: '-0.025em' }}
          >
            What are you interested in?
          </h1>
          <p style={{ color: '#4a5e7a', fontSize: 16 }}>Select a category to get started.</p>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch w-full" style={{ gap: 16 }}>
          <DEXCard onClick={() => onEnter('Pools')} />
          <StrategiesCard onClick={() => onEnter('Strategies')} />
          <BridgeCard onClick={() => onEnter('Bridge')} />
          <StocksCard />
        </div>
      </div>
    </div>
  )
}
