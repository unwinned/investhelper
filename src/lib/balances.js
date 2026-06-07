import { encodeFunctionData } from 'viem'
import { POLYGON, BASE, BNB } from './contracts.js'
import { ensurePolygon, CHAIN_ENSURE } from './evmUtils.js'

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

export async function getQuickSwapPair(tokenA, tokenB) {
  const data = encodeFunctionData({ abi: QS_FACTORY_ABI, functionName: 'getPair', args: [tokenA, tokenB] })
  const raw = await ethCall(POLYGON.QUICKSWAP_FACTORY, data)
  if (!raw || raw === '0x' + '0'.repeat(64)) return null
  return '0x' + raw.slice(26)
}

// ─── Price data ─────────────────────────────────────────────────────────────

let _priceCache = null
let _priceCacheTs = 0

export async function fetchPrices() {
  if (_priceCache && Date.now() - _priceCacheTs < 60_000) return _priceCache
  const fallback = {
    MATIC: 0.8, BTC: 65000, ETH: 3000, BNB: 600,
    USDC: 1.0, USDT: 1.0, WBTC: 65000, WETH: 3000,
    CBETH: 3100, CBBTC: 65000, AERO: 1.5, CAKE: 3.0,
    BTCB: 65000, QUICK: 0.05,
  }
  try {
    const ids = 'matic-network,bitcoin,ethereum,usd-coin,tether,wrapped-bitcoin,quickswap,binancecoin,coinbase-wrapped-eth,aerodrome-finance,pancakeswap-token'
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = await r.json()
    _priceCache = {
      MATIC:  j['matic-network']?.usd         ?? fallback.MATIC,
      BTC:    j['bitcoin']?.usd               ?? fallback.BTC,
      ETH:    j['ethereum']?.usd              ?? fallback.ETH,
      BNB:    j['binancecoin']?.usd           ?? fallback.BNB,
      USDC:   j['usd-coin']?.usd              ?? fallback.USDC,
      USDT:   j['tether']?.usd               ?? fallback.USDT,
      WBTC:   j['wrapped-bitcoin']?.usd       ?? fallback.WBTC,
      WETH:   j['ethereum']?.usd              ?? fallback.WETH,
      CBETH:  j['coinbase-wrapped-eth']?.usd  ?? fallback.CBETH,
      CBBTC:  j['bitcoin']?.usd               ?? fallback.CBBTC,
      BTCB:   j['bitcoin']?.usd               ?? fallback.BTCB,
      AERO:   j['aerodrome-finance']?.usd     ?? fallback.AERO,
      CAKE:   j['pancakeswap-token']?.usd     ?? fallback.CAKE,
      QUICK:  j['quickswap']?.usd             ?? fallback.QUICK,
    }
  } catch {
    _priceCache = fallback
  }
  _priceCacheTs = Date.now()
  return _priceCache
}

// ─── Strategy token requirements ────────────────────────────────────────────

const STRATEGY_TOKEN_REQS = {
  // ── Polygon ──
  'poly-stablecoin-vault': [
    { token: POLYGON.USDC, symbol: 'USDC', decimals: 6, fraction: 0.63 },
    { token: POLYGON.USDT, symbol: 'USDT', decimals: 6, fraction: 0.37 },
  ],
  'poly-correlated-pairs': [
    { token: POLYGON.WBTC, symbol: 'WBTC', decimals: 8,  fraction: 0.45 },
    { token: POLYGON.WETH, symbol: 'WETH', decimals: 18, fraction: 0.55 },
  ],
  'poly-yield-accelerator': [
    { token: POLYGON.USDC,   symbol: 'USDC',  decimals: 6,  fraction: 0.25 },
    { token: POLYGON.WETH,   symbol: 'WETH',  decimals: 18, fraction: 0.25 },
    { token: POLYGON.WMATIC, symbol: 'MATIC', decimals: 18, fraction: 0.50 },
  ],
  'poly-alpha-hunt': [
    { token: POLYGON.WETH,  symbol: 'WETH',  decimals: 18, fraction: 0.35 },
    { token: POLYGON.WBTC,  symbol: 'WBTC',  decimals: 8,  fraction: 0.35 },
    { token: POLYGON.USDC,  symbol: 'USDC',  decimals: 6,  fraction: 0.15 },
    { token: POLYGON.QUICK, symbol: 'QUICK', decimals: 18, fraction: 0.15 },
  ],
  // ── Base ──
  'base-stablecoin-vault': [
    { token: BASE.USDC,  symbol: 'USDC',  decimals: 6,  fraction: 0.80 },
    { token: BASE.USDBC, symbol: 'USDC',  decimals: 6,  fraction: 0.20 },
  ],
  'base-correlated-pairs': [
    { token: BASE.CBETH, symbol: 'CBETH', decimals: 18, fraction: 0.50 },
    { token: BASE.WETH,  symbol: 'WETH',  decimals: 18, fraction: 0.50 },
  ],
  'base-yield-accelerator': [
    { token: BASE.WETH, symbol: 'WETH', decimals: 18, fraction: 0.50 },
    { token: BASE.USDC, symbol: 'USDC', decimals: 6,  fraction: 0.50 },
  ],
  'base-alpha-hunt': [
    { token: BASE.WETH, symbol: 'WETH', decimals: 18, fraction: 0.60 },
    { token: BASE.AERO, symbol: 'AERO', decimals: 18, fraction: 0.40 },
  ],
  // ── BNB ──
  'bnb-stablecoin-vault': [
    { token: BNB.USDT, symbol: 'USDT', decimals: 18, fraction: 0.50 },
    { token: BNB.USDC, symbol: 'USDC', decimals: 18, fraction: 0.50 },
  ],
  'bnb-correlated-pairs': [
    { token: BNB.BTCB, symbol: 'BTCB', decimals: 18, fraction: 0.50 },
    { token: BNB.ETH,  symbol: 'ETH',  decimals: 18, fraction: 0.50 },
  ],
  'bnb-yield-accelerator': [
    { token: BNB.WBNB, symbol: 'BNB',  decimals: 18, fraction: 0.40 },
    { token: BNB.USDT, symbol: 'USDT', decimals: 18, fraction: 0.60 },
  ],
  'bnb-alpha-hunt': [
    { token: BNB.CAKE, symbol: 'CAKE', decimals: 18, fraction: 0.50 },
    { token: BNB.WBNB, symbol: 'BNB',  decimals: 18, fraction: 0.50 },
  ],
}

// Strategies where native token swap covers full amount
const NATIVE_SWAPPABLE = {
  'poly-stablecoin-vault': true,
  'poly-yield-accelerator': true,
}

// Price key for native token per chain
const NATIVE_PRICE_KEY = {
  Polygon: 'MATIC',
  Base:    'ETH',
  BNB:     'BNB',
}

/**
 * Check EVM balances for any strategy on any supported chain.
 */
export async function checkEVMBalances(chain, strategyId, totalUSD, userAddress) {
  const ensureFn = CHAIN_ENSURE[chain]
  if (ensureFn) await ensureFn()

  const reqs   = STRATEGY_TOKEN_REQS[strategyId] ?? []
  const prices = await fetchPrices()
  const nativeKey = NATIVE_PRICE_KEY[chain] ?? 'ETH'

  const nativeBal = await getNativeBalance(userAddress)
  const nativeUSD = Number(nativeBal) / 1e18 * (prices[nativeKey] ?? 1)

  const missing = []
  let allSufficient = true

  for (const req of reqs) {
    const tokenBal   = await getERC20Balance(req.token, userAddress)
    const tokenPrice = prices[req.symbol] ?? 1
    const needUnits  = BigInt(Math.floor(totalUSD * req.fraction / tokenPrice * 10 ** req.decimals))
    const haveUSD    = (Number(tokenBal) / 10 ** req.decimals) * tokenPrice
    const needUSD    = totalUSD * req.fraction

    if (tokenBal < needUnits) {
      allSufficient = false
      missing.push({ symbol: req.symbol, token: req.token, decimals: req.decimals, haveUSD, needUSD, shortfallUSD: needUSD - haveUSD })
    }
  }

  const canSwapFromNative = NATIVE_SWAPPABLE[strategyId] && nativeUSD >= totalUSD * 1.05

  return { sufficient: allSufficient, nativeBalanceUSD: nativeUSD, nativePrice: prices[nativeKey] ?? 1, totalNeededUSD: totalUSD, missing, canSwapFromNative }
}

// Keep Polygon-specific export as alias for backward compat
export const checkPolygonBalances = (strategyId, totalUSD, userAddress) =>
  checkEVMBalances('Polygon', strategyId, totalUSD, userAddress)

// ─── TON balance check ──────────────────────────────────────────────────────

export async function getTonBalances(userAddress) {
  try {
    const r = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(userAddress)}`)
    const j = await r.json()
    const tonBalance = BigInt(j.balance ?? '0')

    const jr = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(userAddress)}/jettons`)
    const jj = await jr.json()
    const jettons = jj.balances ?? []

    const find = (addr) => {
      const jt = jettons.find(x => x.jetton?.address === addr)
      return jt ? BigInt(jt.balance) : 0n
    }

    return {
      ton:   tonBalance,
      tsTON: find('EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav'),
      stTON: find('EQDNhy-nxYFgUqzfUzImBEP67JqsyMIcyk2S5_RwNNEYku0k'),
      hTON:  find('EQDPdq8xjAhytYqfGSX8KcFWIReCufsB9Wdg0pLlYSO_h76w'),
    }
  } catch {
    return { ton: 0n, tsTON: 0n, stTON: 0n, hTON: 0n }
  }
}

export function fmtBalance(units, decimals, symbol) {
  const n = Number(BigInt(units)) / 10 ** decimals
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${symbol}`
}

export function fmtUSD(usd) {
  return `$${usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}
