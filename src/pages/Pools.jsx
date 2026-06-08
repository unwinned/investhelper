import { useState, useMemo, useEffect } from 'react'
import { Search, ChevronUp, ChevronDown, ArrowLeft, Wifi, WifiOff, Loader2 } from 'lucide-react'
import { POOLS } from '../data.js'
import { fetchLivePools } from '../lib/poolsApi.js'

const CHAIN_OPTS = ['All', 'TON', 'Polygon', 'Base', 'BNB']
const DEX_OPTS   = ['All', 'STON.fi', 'DeDust', 'Uniswap v3', 'QuickSwap', 'Balancer', 'Aerodrome', 'PancakeSwap']
const APY_OPTS   = [
  { label: 'Any APY', min: 0  },
  { label: '>5%',     min: 5  },
  { label: '>15%',    min: 15 },
  { label: '>30%',    min: 30 },
  { label: '>50%',    min: 50 },
]

const CHAIN_COLOR  = { TON: '#0098ea', Polygon: '#8247e5', Base: '#2563eb', BNB: '#f59e0b' }
const CHAIN_ABBREV = { TON: 'TON', Polygon: 'POLY', Base: 'BASE', BNB: 'BNB' }

const IL_STYLE = {
  'None':      { color: '#00d4aa' },
  'Low':       { color: '#0098ea' },
  'Medium':    { color: '#fbbf24' },
  'High':      { color: '#f97316' },
  'Very High': { color: '#ef4444' },
}

function apyColor(v) {
  if (v >= 50) return '#ef4444'
  if (v >= 30) return '#f97316'
  if (v >= 15) return '#fbbf24'
  if (v >= 5)  return '#00d4aa'
  return '#8b9dc3'
}

function fmtNum(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${(n / 1e3).toFixed(0)}K`
}

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
      {CHAIN_ABBREV[chain] ?? chain}
    </span>
  )
}

export default function Pools({ onBack }) {
  const [chain,  setChain]  = useState('All')
  const [dex,    setDex]    = useState('All')
  const [minAPY, setMinAPY] = useState(0)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('apy')
  const [sortDir,setSortDir]= useState('desc')
  const [livePools, setLivePools] = useState(null) // null = loading
  const [liveStatus, setLiveStatus] = useState('loading') // 'loading' | 'live' | 'static'

  useEffect(() => {
    let cancelled = false
    fetchLivePools()
      .then(data => {
        if (cancelled) return
        if (data && data.length > 0) {
          setLivePools(data)
          setLiveStatus('live')
        } else {
          setLiveStatus('static')
        }
      })
      .catch(() => !cancelled && setLiveStatus('static'))
    return () => { cancelled = true }
  }, [])

  const allPools = livePools ?? POOLS

  const pools = useMemo(() => {
    let list = allPools.filter(p => {
      if (chain !== 'All' && p.chain !== chain) return false
      if (dex   !== 'All' && p.dex   !== dex)   return false
      if (p.apy < minAPY) return false
      if (search && !p.pair.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    list.sort((a, b) => {
      const diff = a[sortBy] - b[sortBy]
      return sortDir === 'asc' ? diff : -diff
    })
    return list
  }, [chain, dex, minAPY, search, sortBy, sortDir])

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3" style={{ color: '#0098ea' }} />
      : <ChevronDown className="w-3 h-3" style={{ color: '#0098ea' }} />
  }

  return (
    <div className="space-y-4">
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
      {/* Filter bar */}
      <div
        className="flex flex-wrap gap-3 items-center rounded-2xl"
        style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#4a5e7a' }} />
          <input
            type="text"
            placeholder="Search pair..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-8 w-36 text-sm"
          />
        </div>

        {/* Chain pills */}
        <div className="flex gap-1.5">
          {CHAIN_OPTS.map(c => {
            const color = CHAIN_COLOR[c]
            const active = chain === c
            return (
              <button
                key={c}
                onClick={() => setChain(c)}
                className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: active ? (color ? `${color}22` : 'rgba(255,255,255,0.1)') : 'transparent',
                  color: active ? (color ?? '#e2e8f0') : '#4a5e7a',
                  border: `1px solid ${active ? (color ? `${color}50` : 'rgba(255,255,255,0.2)') : 'rgba(255,255,255,0.06)'}`,
                }}
              >{c}</button>
            )
          })}
        </div>

        <div className="flex gap-2">
          <select value={dex} onChange={e => setDex(e.target.value)} className="input-field text-xs py-1">
            {DEX_OPTS.map(d => <option key={d} value={d} style={{ background: '#0a0a0a' }}>{d === 'All' ? 'All DEXs' : d}</option>)}
          </select>
          <select value={minAPY} onChange={e => setMinAPY(Number(e.target.value))} className="input-field text-xs py-1">
            {APY_OPTS.map(a => <option key={a.min} value={a.min} style={{ background: '#0a0a0a' }}>{a.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {liveStatus === 'loading' && (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#4a5e7a' }}>
              <Loader2 className="w-3 h-3 animate-spin" /> Fetching live data...
            </span>
          )}
          {liveStatus === 'live' && (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#00d4aa' }}>
              <Wifi className="w-3 h-3" /> Live
            </span>
          )}
          {liveStatus === 'static' && (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#f59e0b' }}>
              <WifiOff className="w-3 h-3" /> Cached
            </span>
          )}
          <span className="text-xs" style={{ color: '#4a5e7a' }}>{pools.length} of {allPools.length} pools</span>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { label: 'Pair',    col: null,     align: 'left'   },
                  { label: 'Chain',   col: null,     align: 'left'   },
                  { label: 'DEX',     col: null,     align: 'left'   },
                  { label: 'APY',     col: 'apy',    align: 'right'  },
                  { label: 'TVL',     col: 'tvl',    align: 'right'  },
                  { label: '24h Vol', col: 'vol24h', align: 'right'  },
                  { label: 'IL Risk', col: null,     align: 'center' },
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
              {pools.map(pool => (
                <tr
                  key={pool.id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td className="px-4 py-3 font-semibold" style={{ color: '#d1dce8' }}>{pool.pair}</td>
                  <td className="px-4 py-3"><ChainBadge chain={pool.chain} /></td>
                  <td className="px-4 py-3" style={{ color: '#4a5e7a' }}>{pool.dex}</td>
                  <td className="px-4 py-3 text-right mono font-bold" style={{ color: apyColor(pool.apy) }}>
                    {pool.apy.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right mono" style={{ color: '#8b9dc3' }}>{fmtNum(pool.tvl)}</td>
                  <td className="px-4 py-3 text-right mono" style={{ color: '#4a5e7a' }}>{fmtNum(pool.vol24h)}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="mono"
                      style={{
                        fontSize: 10, fontWeight: 700,
                        color: IL_STYLE[pool.ilRisk]?.color ?? '#8b9dc3',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {pool.ilRisk}
                    </span>
                  </td>
                </tr>
              ))}
              {pools.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-sm" style={{ color: '#4a5e7a' }}>
                    No pools match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-center" style={{ color: '#2a3a55' }}>
        {liveStatus === 'live'
          ? `Live data from STON.fi + DeFiLlama · ${allPools.length} pools tracked · refreshes every 5 min`
          : 'Showing cached pool data · Past performance does not guarantee future returns'
        }
      </p>
    </div>
  )
}
