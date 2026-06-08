// Live pool data: STON.fi (TON) + DeFiLlama yields (EVM)
// Returns normalized pool objects matching POOLS shape from data.js

const CACHE_TTL = 5 * 60 * 1000 // 5 min
let _cache = null
let _cacheTime = 0

const STABLECOINS = new Set([
  'USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'USD+', 'USDR', 'FRAX', 'LUSD',
  'USDBC', 'USDBC', 'GUSD', 'MIM', 'DOLA', 'SUSD', 'CUSD', 'MUSD',
])
const MAJORS = new Set([
  'TON', 'WTON', 'ETH', 'WETH', 'BTC', 'WBTC', 'BTCB', 'CBBTC',
  'BNB', 'WBNB', 'MATIC', 'POL', 'WMATIC', 'WPOL',
])

function classifyIL(sym1, sym2) {
  const a = sym1.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const b = sym2.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const stabA = STABLECOINS.has(a) || a.startsWith('USD') || a.endsWith('USD')
  const stabB = STABLECOINS.has(b) || b.startsWith('USD') || b.endsWith('USD')
  if (stabA && stabB) return 'None'
  // Same underlying (e.g. cbETH/WETH, stBNB/WBNB)
  if ((a.includes('ETH') && b.includes('ETH')) ||
      (a.includes('BTC') && b.includes('BTC')) ||
      (a.includes('BNB') && b.includes('BNB')) ||
      (a.includes('TON') && b.includes('TON'))) return 'Low'
  const majA = MAJORS.has(a)
  const majB = MAJORS.has(b)
  if ((majA && stabB) || (stabA && majB)) return 'Medium'
  if (majA && majB) return 'Medium'
  if (majA || majB) return 'High'
  return 'Very High'
}

// ─── STON.fi (TON) ──────────────────────────────────────────────────────────

async function fetchSTONfi() {
  const [poolsRes, assetsRes] = await Promise.all([
    fetch('https://api.ston.fi/v1/pools?page_size=150&sort=by_apy_7d&order=desc'),
    fetch('https://api.ston.fi/v1/assets?page_size=500'),
  ])
  if (!poolsRes.ok || !assetsRes.ok) throw new Error('STON.fi fetch failed')

  const [poolsData, assetsData] = await Promise.all([poolsRes.json(), assetsRes.json()])

  const sym = {}
  for (const a of assetsData.asset_list) sym[a.contract_address] = a.symbol

  return poolsData.pool_list
    .filter(p => !p.deprecated && parseFloat(p.lp_total_supply_usd) > 100_000)
    .map((p, i) => {
      const s0 = sym[p.token0_address] || 'TKN'
      const s1 = sym[p.token1_address] || 'TKN'
      const pair = s1 === 'TON' ? `${s0}/TON` : `${s0}/${s1}`
      const apy  = Math.round(parseFloat(p.apy_7d) * 100 * 10) / 10
      return {
        id:       `ston-${i + 1}`,
        pair,
        chain:    'TON',
        dex:      'STON.fi',
        apy,
        tvl:      Math.round(parseFloat(p.lp_total_supply_usd)),
        vol24h:   Math.round(parseFloat(p.volume_24h_usd || 0)),
        ilRisk:   classifyIL(s0, s1),
        live:     true,
      }
    })
    .filter(p => p.apy > 0)
    .sort((a, b) => b.apy - a.apy)
}

// ─── DeFiLlama (EVM) ────────────────────────────────────────────────────────

const DEX_PROJECTS = {
  'uniswap-v3':         'Uniswap v3',
  'quickswap-dex':      'QuickSwap',
  'quickswap':          'QuickSwap',
  'aerodrome-v1':       'Aerodrome',
  'aerodrome':          'Aerodrome',
  'pancakeswap-amm-v3': 'PancakeSwap',
  'pancakeswap-amm':    'PancakeSwap',
  'pancakeswap-v3':     'PancakeSwap',
  'velodrome-v2':       'Velodrome',
  'balancer-v2':        'Balancer',
  'sushi':              'Sushi',
  'curve':              'Curve',
}

const CHAIN_MAP = { BSC: 'BNB', Polygon: 'Polygon', Base: 'Base' }

async function fetchDeFiLlama() {
  const res = await fetch('https://yields.llama.fi/pools')
  if (!res.ok) throw new Error('DeFiLlama fetch failed')
  const data = await res.json()

  return data.data
    .filter(p =>
      CHAIN_MAP[p.chain] &&
      DEX_PROJECTS[p.project] &&
      p.apy > 0 && p.apy < 500 &&
      p.tvlUsd > 500_000 &&
      p.exposure !== 'single'
    )
    .map((p, i) => {
      const chain = CHAIN_MAP[p.chain]
      const tokens = p.symbol.split('-')
      return {
        id:     `llama-${i + 1}`,
        pair:   p.symbol.replace(/-/g, '/'),
        chain,
        dex:    DEX_PROJECTS[p.project],
        apy:    Math.round(p.apy * 10) / 10,
        tvl:    Math.round(p.tvlUsd),
        vol24h: Math.round(p.volumeUsd1d || 0),
        ilRisk: classifyIL(tokens[0] || '', tokens[1] || ''),
        live:   true,
      }
    })
    .sort((a, b) => b.apy - a.apy)
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch live pools from both APIs.
 * Returns array of pools, or null if both APIs failed (caller should use static fallback).
 */
export async function fetchLivePools() {
  const now = Date.now()
  if (_cache && now - _cacheTime < CACHE_TTL) return _cache

  const [ton, evm] = await Promise.allSettled([fetchSTONfi(), fetchDeFiLlama()])

  const tonPools = ton.status === 'fulfilled' ? ton.value : []
  const evmPools = evm.status === 'fulfilled' ? evm.value : []
  const merged   = [...tonPools, ...evmPools]

  if (merged.length > 0) {
    _cache     = merged
    _cacheTime = now
    return merged
  }
  return null
}

/**
 * Get top N pools by APY for a given chain.
 */
export function getTopPools(pools, chain, n = 5) {
  return pools.filter(p => p.chain === chain).sort((a, b) => b.apy - a.apy).slice(0, n)
}
