import { useState, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown } from 'lucide-react'
import { POOLS } from '../data.js'

const CHAIN_OPTS = ['All', 'TON', 'Polygon']
const DEX_OPTS   = ['All', 'STON.fi', 'DeDust', 'Uniswap v3', 'QuickSwap', 'Balancer']
const APY_OPTS   = [
  { label: 'Any APY',  min: 0   },
  { label: '>5%',      min: 5   },
  { label: '>15%',     min: 15  },
  { label: '>30%',     min: 30  },
  { label: '>50%',     min: 50  },
]

const IL_COLOR = {
  'None':      { pill: 'pill-green'  },
  'Low':       { pill: 'pill-blue'   },
  'Medium':    { pill: 'pill-yellow' },
  'High':      { pill: 'pill-orange' },
  'Very High': { pill: 'pill-red'    },
}

function apyColor(v) {
  if (v >= 50)  return '#ef4444'
  if (v >= 30)  return '#f97316'
  if (v >= 15)  return '#fbbf24'
  if (v >= 5)   return '#00d4aa'
  return '#8b9dc3'
}

function fmtNum(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${(n / 1e3).toFixed(0)}K`
}

export default function Pools() {
  const [chain,  setChain]  = useState('All')
  const [dex,    setDex]    = useState('All')
  const [minAPY, setMinAPY] = useState(0)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('apy')
  const [sortDir,setSortDir]= useState('desc')

  const pools = useMemo(() => {
    let list = POOLS.filter(p => {
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
      ? <ChevronUp   className="w-3 h-3 text-ton" />
      : <ChevronDown className="w-3 h-3 text-ton" />
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="card p-3 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-dim absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search pair..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-8 w-36 text-sm"
          />
        </div>

        {/* Chain filter */}
        <div className="flex gap-1">
          {CHAIN_OPTS.map(c => (
            <button
              key={c}
              onClick={() => setChain(c)}
              className="px-3 py-1 rounded-md text-xs font-medium transition-all"
              style={{
                background: chain === c
                  ? c === 'TON' ? '#0098ea' : c === 'Polygon' ? '#8247e5' : '#2a3a55'
                  : 'transparent',
                color: chain === c ? '#fff' : '#8b9dc3',
                border: '1px solid',
                borderColor: chain === c
                  ? c === 'TON' ? '#0098ea' : c === 'Polygon' ? '#8247e5' : '#2a3a55'
                  : '#2a3a55',
              }}
            >{c}</button>
          ))}
        </div>

        {/* DEX filter */}
        <select
          value={dex}
          onChange={e => setDex(e.target.value)}
          className="input-field text-sm py-1"
        >
          {DEX_OPTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* APY filter */}
        <select
          value={minAPY}
          onChange={e => setMinAPY(Number(e.target.value))}
          className="input-field text-sm py-1"
        >
          {APY_OPTS.map(a => <option key={a.min} value={a.min}>{a.label}</option>)}
        </select>

        <span className="text-xs text-dim ml-auto">{pools.length} of {POOLS.length} pools</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {[
                  { label: 'Pair',   col: null,     align: 'left'  },
                  { label: 'Chain',  col: null,     align: 'left'  },
                  { label: 'DEX',    col: null,     align: 'left'  },
                  { label: 'APY',    col: 'apy',    align: 'right' },
                  { label: 'TVL',    col: 'tvl',    align: 'right' },
                  { label: '24h Vol',col: 'vol24h', align: 'right' },
                  { label: 'IL Risk',col: null,     align: 'center'},
                ].map(({ label, col, align }) => (
                  <th
                    key={label}
                    onClick={col ? () => toggleSort(col) : undefined}
                    className={`px-4 py-2.5 text-${align} text-xs font-medium uppercase tracking-wider`}
                    style={{ color: '#4a5e7a', cursor: col ? 'pointer' : 'default', userSelect: 'none' }}
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
              {pools.map((pool, i) => (
                <tr
                  key={pool.id}
                  style={{
                    borderBottom: '1px solid #111e31',
                    background: i % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                  }}
                  className="hover:bg-white/[0.04] transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium text-gray-200">{pool.pair}</td>
                  <td className="px-4 py-2.5">
                    <span className={`pill ${pool.chain === 'TON' ? 'pill-ton' : 'pill-poly'}`}>
                      {pool.chain === 'TON' ? 'TON' : 'POLY'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-dim">{pool.dex}</td>
                  <td className="px-4 py-2.5 text-right mono font-semibold" style={{ color: apyColor(pool.apy) }}>
                    {pool.apy.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right mono text-gray-300">{fmtNum(pool.tvl)}</td>
                  <td className="px-4 py-2.5 text-right mono text-dim">{fmtNum(pool.vol24h)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`pill ${IL_COLOR[pool.ilRisk]?.pill ?? 'pill-gray'}`}>{pool.ilRisk}</span>
                  </td>
                </tr>
              ))}
              {pools.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-dim text-sm">No pools match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-dim text-center">
        Showing {pools.length} of 2,400+ tracked pools · APYs update every 5 minutes · Past performance does not guarantee future returns
      </p>
    </div>
  )
}
