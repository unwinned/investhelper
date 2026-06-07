import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react'
import { LENDING } from '../data.js'

const PROTO_OPTS = ['All', 'AAVE v3', 'Evaa', 'Tonstakers', 'Bemo']
const ASSET_OPTS = ['All', 'USDC', 'USDT', 'WETH', 'WBTC', 'TON', 'MATIC', 'DAI', 'tgBTC']
const CHAIN_OPTS = ['All', 'TON', 'Polygon']

function fmtNum(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${(n / 1e3).toFixed(0)}K`
}

function UtilBar({ pct }) {
  const color = pct >= 85 ? '#ef4444' : pct >= 70 ? '#fbbf24' : '#00d4aa'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: '#1a2235', maxWidth: 80 }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="mono text-xs" style={{ color }}>{pct}%</span>
    </div>
  )
}

export default function Lending() {
  const [proto,  setProto]  = useState('All')
  const [asset,  setAsset]  = useState('All')
  const [chain,  setChain]  = useState('All')
  const [sortBy, setSortBy] = useState('supplyAPY')
  const [sortDir,setSortDir]= useState('desc')

  const rows = useMemo(() => {
    let list = LENDING.filter(r => {
      if (proto !== 'All' && r.protocol !== proto) return false
      if (asset !== 'All' && r.asset   !== asset)  return false
      if (chain !== 'All' && r.chain   !== chain)  return false
      return true
    })
    list.sort((a, b) => {
      const va = a[sortBy] ?? -Infinity
      const vb = b[sortBy] ?? -Infinity
      return sortDir === 'asc' ? va - vb : vb - va
    })
    return list
  }, [proto, asset, chain, sortBy, sortDir])

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  // Best rates highlights
  const bestSupply = [...LENDING].sort((a, b) => b.supplyAPY - a.supplyAPY).slice(0, 3)
  const bestBorrow = [...LENDING].filter(r => r.borrowAPY).sort((a, b) => a.borrowAPY - b.borrowAPY).slice(0, 3)

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ChevronDown className="w-3 h-3 opacity-25" />
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-ton" /> : <ChevronDown className="w-3 h-3 text-ton" />
  }

  return (
    <div className="space-y-5">
      {/* Best rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Best supply */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-gain" />
            <span className="text-sm font-semibold text-gray-200">Best Supply Rates</span>
          </div>
          <div className="space-y-2">
            {bestSupply.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-dim w-4">{i + 1}.</span>
                  <span className="text-sm font-medium text-gray-200">{r.asset}</span>
                  <span className={`pill ${r.chain === 'TON' ? 'pill-ton' : 'pill-poly'}`}>
                    {r.protocol}
                  </span>
                </div>
                <span className="mono font-semibold text-gain">{r.supplyAPY.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cheapest borrow */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-ton" />
            <span className="text-sm font-semibold text-gray-200">Cheapest Borrow Rates</span>
          </div>
          <div className="space-y-2">
            {bestBorrow.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-dim w-4">{i + 1}.</span>
                  <span className="text-sm font-medium text-gray-200">{r.asset}</span>
                  <span className={`pill ${r.chain === 'TON' ? 'pill-ton' : 'pill-poly'}`}>
                    {r.protocol}
                  </span>
                </div>
                <span className="mono font-semibold text-warn">{r.borrowAPY.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap gap-3 items-center">
        {[
          { label: 'Protocol', opts: PROTO_OPTS, val: proto, set: setProto },
          { label: 'Asset',    opts: ASSET_OPTS, val: asset, set: setAsset },
          { label: 'Chain',    opts: CHAIN_OPTS, val: chain, set: setChain },
        ].map(({ label, opts, val, set }) => (
          <select key={label} value={val} onChange={e => set(e.target.value)} className="input-field text-sm py-1">
            {opts.map(o => <option key={o} value={o}>{o === 'All' ? `All ${label}s` : o}</option>)}
          </select>
        ))}
        <span className="text-xs text-dim ml-auto">{rows.length} markets</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {[
                  { label: 'Asset',       col: null,         align: 'left'  },
                  { label: 'Protocol',    col: null,         align: 'left'  },
                  { label: 'Chain',       col: null,         align: 'left'  },
                  { label: 'Supply APY',  col: 'supplyAPY',  align: 'right' },
                  { label: 'Borrow APY',  col: 'borrowAPY',  align: 'right' },
                  { label: 'Utilization', col: 'utilization',align: 'right' },
                  { label: 'TVL',         col: 'tvl',        align: 'right' },
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
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: '1px solid #111e31', background: i % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent' }}
                  className="hover:bg-white/[0.04] transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium text-gray-200">{r.asset}</td>
                  <td className="px-4 py-2.5 text-dim">{r.protocol}</td>
                  <td className="px-4 py-2.5">
                    <span className={`pill ${r.chain === 'TON' ? 'pill-ton' : 'pill-poly'}`}>
                      {r.chain === 'TON' ? 'TON' : 'POLY'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right mono font-semibold text-gain">{r.supplyAPY.toFixed(2)}%</td>
                  <td className="px-4 py-2.5 text-right mono font-semibold" style={{ color: r.borrowAPY ? '#fbbf24' : '#2a3a55' }}>
                    {r.borrowAPY ? `${r.borrowAPY.toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.utilization != null ? <UtilBar pct={r.utilization} /> : <span className="text-dim text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right mono text-gray-300">{fmtNum(r.tvl)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-dim text-sm">No markets match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-dim text-center">
        Rates update every 5 min · Tonstakers & Bemo are supply-only (liquid staking) · Utilization above 85% may trigger rate spikes
      </p>
    </div>
  )
}
