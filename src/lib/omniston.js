import { Omniston } from '@ston-fi/omniston-sdk'

// In dev, proxy through Vite to avoid the Origin header being rejected by Omniston's server.
// In production (served from HTTPS), connect directly.
const isDev = import.meta.env.DEV
const wsOrigin = isDev
  ? `${window.location.origin.replace('http', 'ws')}/omniston-ws`
  : 'wss://omni-ws.ston.fi'

export const omniston = new Omniston({ apiUrl: wsOrigin })

// Token decimals
export const DECIMALS = {
  TON: 9, USDC: 6, USDT: 6, WETH: 18, WBTC: 8, CBBTC: 8,
  MATIC: 18, ETH: 18, BNB: 18, WBNB: 18, CBETH: 18,
  BTCB: 18, CAKE: 18, AERO: 18,
}

// Known jetton addresses on TON mainnet
const TON_JETTONS = {
  USDC: 'EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA',
  USDT: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
  WETH: 'EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmgikjxd6',
  WBTC: 'EQDcBkGHmC4pTf34x3Gm05XvepO5w60e9je5SQkLaL_yVEXk',
}

// EIP-55 checksummed ERC-20 addresses on Polygon mainnet
const POLYGON_ERC20 = {
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  WBTC: '0x1BFD67037B42Cf73acf2047067bd4F2C47D9BfD6',
}

// Base mainnet
const BASE_ERC20 = {
  WETH:  '0x4200000000000000000000000000000000000006',
  USDC:  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  CBETH: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
  CBBTC: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
  AERO:  '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
}

// BNB Smart Chain
const BNB_ERC20 = {
  USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  ETH:  '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
  BTCB: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
  CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
}

export function buildAssetId(chain, symbol) {
  if (chain === 'TON') {
    if (symbol === 'TON')
      return { chain: { $case: 'ton', value: { kind: { $case: 'native', value: {} } } } }
    const addr = TON_JETTONS[symbol]
    if (!addr) return null
    return { chain: { $case: 'ton', value: { kind: { $case: 'jetton', value: addr } } } }
  }

  if (chain === 'Polygon') {
    if (symbol === 'MATIC')
      return { chain: { $case: 'polygon', value: { kind: { $case: 'native', value: {} } } } }
    const addr = POLYGON_ERC20[symbol]
    if (!addr) return null
    return { chain: { $case: 'polygon', value: { kind: { $case: 'erc20', value: addr } } } }
  }

  if (chain === 'Base') {
    if (symbol === 'ETH')
      return { chain: { $case: 'base', value: { kind: { $case: 'native', value: {} } } } }
    const addr = BASE_ERC20[symbol]
    if (!addr) return null
    return { chain: { $case: 'base', value: { kind: { $case: 'erc20', value: addr } } } }
  }

  if (chain === 'BNB') {
    if (symbol === 'BNB')
      return { chain: { $case: 'bnb', value: { kind: { $case: 'native', value: {} } } } }
    const addr = BNB_ERC20[symbol]
    if (!addr) return null
    return { chain: { $case: 'bnb', value: { kind: { $case: 'erc20', value: addr } } } }
  }

  return null
}

// Format a bigint-string amount back to human-readable
export function formatUnits(units, decimals) {
  if (!units) return '0'
  const n = BigInt(units)
  const divisor = BigInt(10 ** decimals)
  const whole = n / divisor
  const frac = n % divisor
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 6)
  return fracStr ? `${whole}.${fracStr}` : `${whole}`
}
