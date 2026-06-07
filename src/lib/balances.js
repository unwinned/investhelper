import { encodeFunctionData } from 'viem'
import { POLYGON } from './contracts.js'
import { ensurePolygon } from './evmUtils.js'

// ─── ABI fragments ─────────────────────────────────────────────────────────

const ERC20_BALANCE_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'decimals',  type: 'function', inputs: [], outputs: [{ type: 'uint8' }] },
]

const QS_FACTORY_ABI = [
  { name: 'getPair', type: 'function', inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }], outputs: [{ type: 'address' }] },
]

// ─── Low-level helpers ──────────────────────────────────────────────────────

async function ethCall(to, data) {
  if (!window.ethereum) return null
  try {
    return await window.ethereum.request({ method: 'eth_call', params: [{ to, data }, 'latest'] })
  } catch { return null }
}

export async function getERC20Balance(tokenAddress, ownerAddress) {
  const data = encodeFunctionData({ abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', args: [ownerAddress] })
  const raw = await ethCall(tokenAddress, data)
  return raw ? BigInt(raw) : 0n
}

export async function getNativeBalance(address) {
  if (!window.ethereum) return 0n
  try {
    const hex = await window.ethereum.request({ method: 'eth_getBalance', params: [address, 'latest'] })
    return BigInt(hex)
  } catch { return 0n }
}

// Fetch QuickSwap LP pair address for two tokens
export async function getQuickSwapPair(tokenA, tokenB) {
  const data = encodeFunctionData({ abi: QS_FACTORY_ABI, functionName: 'getPair', args: [tokenA, tokenB] })
  const raw = await ethCall(POLYGON.QUICKSWAP_FACTORY, data)
  if (!raw || raw === '0x' + '0'.repeat(64)) return null
  return '0x' + raw.slice(26) // extract address from padded bytes32
}

// ─── Price data ─────────────────────────────────────────────────────────────

let _priceCache = null
let _priceCacheTs = 0

export async function fetchPrices() {
  if (_priceCache && Date.now() - _priceCacheTs < 60_000) return _priceCache
  const fallback = { MATIC: 0.8, BTC: 65000, ETH: 3000, USDC: 1.0, USDT: 1.0, WBTC: 65000, WETH: 3000 }
  try {
    // Use CoinGecko proxy via allorigins to avoid CORS issues with the free endpoint
    const ids = 'matic-network,bitcoin,ethereum,usd-coin,tether,wrapped-bitcoin'
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = await r.json()
    _priceCache = {
      MATIC:  j['matic-network']?.usd   ?? fallback.MATIC,
      BTC:    j['bitcoin']?.usd         ?? fallback.BTC,
      ETH:    j['ethereum']?.usd        ?? fallback.ETH,
      USDC:   j['usd-coin']?.usd        ?? fallback.USDC,
      USDT:   j['tether']?.usd          ?? fallback.USDT,
      WBTC:   j['wrapped-bitcoin']?.usd ?? fallback.WBTC,
      WETH:   j['ethereum']?.usd        ?? fallback.WETH,
    }
  } catch {
    _priceCache = fallback
  }
  _priceCacheTs = Date.now()
  return _priceCache
}

// ─── Strategy balance requirements ──────────────────────────────────────────

// Returns what tokens are required for each strategy and in what proportions.
// amounts are fractions (0–1) of totalUSD.
const STRATEGY_TOKEN_REQS = {
  'poly-stablecoin-vault': [
    { token: POLYGON.USDC, symbol: 'USDC', decimals: 6, fraction: 0.63 },  // 55% AAVE + 8% LP
    { token: POLYGON.USDT, symbol: 'USDT', decimals: 6, fraction: 0.37 },  // 30% AAVE + 7% LP
  ],
  'poly-correlated-pairs': [
    { token: POLYGON.WBTC, symbol: 'WBTC', decimals: 8, fraction: 0.45 },
    { token: POLYGON.WETH, symbol: 'WETH', decimals: 18, fraction: 0.55 },
  ],
  'poly-yield-accelerator': [
    { token: POLYGON.USDC, symbol: 'USDC', decimals: 6, fraction: 0.40 },
    { token: POLYGON.WETH, symbol: 'WETH', decimals: 18, fraction: 0.35 },
    // MATIC is native — no ERC20 check needed
  ],
  'poly-alpha-hunt': [
    { token: POLYGON.WETH,  symbol: 'WETH',  decimals: 18, fraction: 0.35 },
    { token: POLYGON.WBTC,  symbol: 'WBTC',  decimals: 8,  fraction: 0.35 },
    { token: POLYGON.USDC,  symbol: 'USDC',  decimals: 6,  fraction: 0.15 },
    { token: POLYGON.QUICK, symbol: 'QUICK', decimals: 18, fraction: 0.15 },
  ],
}

// Strategies where MATIC (native) suffices — user can swap in 1 click
const MATIC_SWAPPABLE = {
  'poly-stablecoin-vault': true,  // only needs stablecoins = swappable from MATIC
  'poly-yield-accelerator': true, // needs USDC + WETH, MATIC = good for WMATIC portion
}

/**
 * Check Polygon balances for a strategy.
 *
 * Returns:
 *   {
 *     sufficient: bool,           // user has all needed tokens
 *     nativeBalanceUSD: number,   // MATIC balance in USD
 *     totalNeededUSD: number,
 *     missing: [{ symbol, haveUSD, needUSD }],  // tokens they're short on
 *     canSwapFromNative: bool,    // if native MATIC alone could cover the full amount
 *   }
 */
export async function checkPolygonBalances(strategyId, totalUSD, userAddress) {
  await ensurePolygon()
  const reqs = STRATEGY_TOKEN_REQS[strategyId] ?? []
  const prices = await fetchPrices()

  const nativeBal = await getNativeBalance(userAddress)
  const nativeUSD = Number(nativeBal) / 1e18 * prices.MATIC

  const missing = []
  let allSufficient = true

  for (const req of reqs) {
    const tokenBal = await getERC20Balance(req.token, userAddress)
    const needUnits = BigInt(Math.floor(totalUSD * req.fraction * 10 ** req.decimals))
    const haveUSD   = (Number(tokenBal) / 10 ** req.decimals) * (prices[req.symbol] ?? 1)
    const needUSD   = totalUSD * req.fraction

    if (tokenBal < needUnits) {
      allSufficient = false
      missing.push({ symbol: req.symbol, token: req.token, decimals: req.decimals, haveUSD, needUSD, shortfallUSD: needUSD - haveUSD })
    }
  }

  const totalShortfall = missing.reduce((s, m) => s + m.shortfallUSD, 0)
  const canSwapFromNative = MATIC_SWAPPABLE[strategyId] && nativeUSD >= totalUSD * 1.05

  return { sufficient: allSufficient, nativeBalanceUSD: nativeUSD, totalNeededUSD: totalUSD, missing, canSwapFromNative }
}

// ─── TON balance check ──────────────────────────────────────────────────────

export async function getTonBalances(userAddress) {
  try {
    const r = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(userAddress)}`)
    const j = await r.json()
    const tonBalance = BigInt(j.balance ?? '0')

    // Fetch jetton balances
    const jr = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(userAddress)}/jettons`)
    const jj = await jr.json()
    const jettons = jj.balances ?? []

    const find = (addr) => {
      const j = jettons.find(x => x.jetton?.address === addr || x.jetton?.address === Address_toRaw(addr))
      return j ? BigInt(j.balance) : 0n
    }

    return {
      ton:  tonBalance,
      tsTON: find('EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav'),
      stTON: find('EQDNhy-nxYFgUqzfUzImBEP67JqsyMIcyk2S5_RwNNEYku0k'),
      hTON:  find('EQDPdq8xjAhytYqfGSX8KcFWIReCufsB9Wdg0pLlYSO_h76w'),
    }
  } catch {
    return { ton: 0n, tsTON: 0n, stTON: 0n, hTON: 0n }
  }
}

function Address_toRaw(friendly) {
  // This is a no-op helper for the rare cases TonAPI returns raw addresses
  return friendly
}

// Format a balance for display
export function fmtBalance(units, decimals, symbol) {
  const n = Number(BigInt(units)) / 10 ** decimals
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${symbol}`
}

export function fmtUSD(usd) {
  return `$${usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}
