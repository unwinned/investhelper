import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react'
import { LENDING } from '../data.js'

const PROTO_OPTS = ['All', 'AAVE v3', 'Evaa', 'Tonstakers', 'Bemo']
const ASSET_OPTS = ['All', 'USDC', 'USDT', 'WETH', 'WBTC', 'TON', 'MATIC', 'DAI', 'tgBTC', 'cbETH', 'USDbC', 'WBNB', 'BTCB', 'ETH']
const CHAIN_OPTS = ['All', 'TON', 'Polygon', 'Base', 'BNB']

const CHAIN_COLOR = { TON: '#0098ea', Polygon: '#8247e5', Base: '#2563eb', BNB: '#f59e0b' }

function ChainBadge({ chain }) {
  const c = CHAIN_COLOR[chain] ?? '#8b9dc3'
  return (
    <span
      className="mono"
      style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
        color: c, background: `${c}18`, borderRadius: 5,
        padding: '2px 7px', border: `1px solid ${c}35`,
        whiteSpace: 'nowrap',
      }}
    >
      {chain}
    </span>
  )
}

function fmtNum(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${(n / 1e3).toFixed(0)}K`
}

function UtilBar({ pct }) {
  const color = pct >= 85 ? '#ef4444' : pct >= 70 ? '#fbbf24' : '#00d4aa'
  return (
    <div className="flex items-center gap-2">
      <div style={{ flex: 1, height: 4, borderRadius: 9999, background: 'rgba(255,255,255,0.06)', maxWidth: 72 }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 9999, background: color }} />
      </div>
      <span className="mono text-xs" style={{ color }}>{pct}%</span>
    </div>
  )
}

export default function Lending({ onBack }) {
  const [proto,   setProto]   = useState('All')
  const [asset,   setAsset]   = useState('All')
  const [chain,   setChain]   = useState('All')
  const [sortBy,  setSortBy]  = useState('supplyAPY')
  const [sortDir, setSortDir] = useState('desc')

  const rows = useMemo(() => {
    let list = LENDING.filter(r => {
      if (proto !== 'All' && r.protocol !== proto) return false
      if (asset !== 'All' && r.asset    !== asset)  return false
      if (chain !== 'All' && r.chain    !== chain)  return false
      return true
    })
    list.sort((a, b) => {
      const va = a[sortBy] ?? -Infinity
      const vb = b[sortBy] ?? -Infinity
      return sortDir === 'asc' ? va - vb : vb - va
    })
    return list
  }, [proto, asset, chain, sortBy, sortDir])

  const toggleSort = col => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const bestSupply = [...LENDING].sort((a, b) => b.supplyAPY - a.supplyAPY).slice(0, 3)
  const bestBorrow = [...LENDING].filter(r => r.borrowAPY).sort((a, b) => a.borrowAPY - b.borrowAPY).slice(0, 3)

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ChevronDown className="w-3 h-3 opacity-25" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3" style={{ color: '#0098ea' }} />
      : <ChevronDown className="w-3 h-3" style={{ color: '#0098ea' }} />
  }

  return (
    <div className="space-y-5">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: '#4a5e7a' }}
          onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
          onMouseLeave={e => e.currentTarget.style.color = '#4a5e7a'}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      )}
      {/* Best rates highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="rounded-2xl p-5"
          style={{ background: 'rgba(0,212,170,0.04)', border: '1px solid rgba(0,212,170,0.15)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4" style={{ color: '#00d4aa' }} />
            <span className="text-sm font-semibold text-gray-200">Best Supply Rates</span>
          </div>
          <div className="space-y-3">
            {bestSupply.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="mono text-xs" style={{ color: '#2a3a55', width: 16 }}>{i + 1}.</span>
                  <span className="text-sm font-semibold text-gray-200">{r.asset}</span>
                  <ChainBadge chain={r.chain} />
                  <span style={{ color: '#4a5e7a', fontSize: 12 }}>{r.protocol}</span>
                </div>
                <span className="mono font-bold text-sm" style={{ color: '#00d4aa' }}>{r.supplyAPY.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-2xl p-5"
          style={{ background: 'rgba(0,152,234,0.04)', border: '1px solid rgba(0,152,234,0.15)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-4 h-4" style={{ color: '#0098ea' }} />
            <span className="text-sm font-semibold text-gray-200">Cheapest Borrow Rates</span>
          </div>
          <div className="space-y-3">
            {bestBorrow.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="mono text-xs" style={{ color: '#2a3a55', width: 16 }}>{i + 1}.</span>
                  <span className="text-sm font-semibold text-gray-200">{r.asset}</span>
                  <ChainBadge chain={r.chain} />
                  <span style={{ color: '#4a5e7a', fontSize: 12 }}>{r.protocol}</span>
                </div>
                <span className="mono font-bold text-sm" style={{ color: '#fbbf24' }}>{r.borrowAPY.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap gap-3 items-center rounded-2xl"
        style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {[
          { label: 'Protocol', opts: PROTO_OPTS, val: proto, set: setProto },
          { label: 'Asset',    opts: ASSET_OPTS, val: asset, set: setAsset },
          { label: 'Chain',    opts: CHAIN_OPTS, val: chain, set: setChain },
        ].map(({ label, opts, val, set }) => (
          <select key={label} value={val} onChange={e => set(e.target.value)} className="input-field text-xs py-1">
            {opts.map(o => (
              <option key={o} value={o} style={{ background: '#0a0a0a' }}>
                {o === 'All' ? `All ${label}s` : o}
              </option>
            ))}
          </select>
        ))}
        <span className="text-xs ml-auto" style={{ color: '#4a5e7a' }}>{rows.length} markets</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { label: 'Asset',       col: null,          align: 'left'  },
                  { label: 'Protocol',    col: null,          align: 'left'  },
                  { label: 'Chain',       col: null,          align: 'left'  },
                  { label: 'Supply APY',  col: 'supplyAPY',   align: 'right' },
                  { label: 'Borrow APY',  col: 'borrowAPY',   align: 'right' },
                  { label: 'Utilization', col: 'utilization', align: 'right' },
                  { label: 'TVL',         col: 'tvl',         align: 'right' },
                ].map(({ label, col, align }) => (
                  <th
                    key={label}
                    onClick={col ? () => toggleSort(col) : undefined}
                    className={`px-4 py-3 text-${align} text-xs font-semibold uppercase tracking-wider`}
                    style={{ color: '#3a4a65', cursor: col ? 'pointer' : 'default', userSelect: 'none' }}
                  >
                    {col ? (
                      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
                        {label} <SortIcon col={col} />
                      </span>
                    ) : label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr
                  key={r.id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td className="px-4 py-3 font-semibold" style={{ color: '#d1dce8' }}>{r.asset}</td>
                  <td className="px-4 py-3" style={{ color: '#4a5e7a' }}>{r.protocol}</td>
                  <td className="px-4 py-3"><ChainBadge chain={r.chain} /></td>
                  <td className="px-4 py-3 text-right mono font-bold" style={{ color: '#00d4aa' }}>{r.supplyAPY.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right mono font-semibold" style={{ color: r.borrowAPY ? '#fbbf24' : '#1a2a40' }}>
                    {r.borrowAPY ? `${r.borrowAPY.toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.utilization != null
                      ? <UtilBar pct={r.utilization} />
                      : <span style={{ color: '#1a2a40' }}>—</span>}
                  </td>
                  <td className="px-4 py-3 text-right mono" style={{ color: '#8b9dc3' }}>{fmtNum(r.tvl)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-sm" style={{ color: '#4a5e7a' }}>
                    No markets match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-center" style={{ color: '#2a3a55' }}>
        Rates update every 5 min · Tonstakers &amp; Bemo are supply-only (liquid staking) · Utilization above 85% may trigger rate spikes
      </p>
    </div>
  )
}
