import { Omniston } from '@ston-fi/omniston-sdk'

export const omniston = new Omniston({ apiUrl: 'wss://omni-ws.ston.fi' })

// Token decimals
export const DECIMALS = {
  TON: 9, USDC: 6, USDT: 6, WETH: 18, WBTC: 8, MATIC: 18,
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

export function buildAssetId(chain, symbol) {
  if (chain === 'TON') {
    if (symbol === 'TON') {
      return { chain: { $case: 'ton', value: { kind: { $case: 'native', value: {} } } } }
    }
    const addr = TON_JETTONS[symbol]
    if (!addr) return null
    return { chain: { $case: 'ton', value: { kind: { $case: 'jetton', value: addr } } } }
  }

  if (chain === 'Polygon') {
    if (symbol === 'MATIC') {
      return { chain: { $case: 'polygon', value: { kind: { $case: 'native', value: {} } } } }
    }
    const addr = POLYGON_ERC20[symbol]
    if (!addr) return null
    return { chain: { $case: 'polygon', value: { kind: { $case: 'erc20', value: addr } } } }
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
