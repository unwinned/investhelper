import { encodeFunctionData } from 'viem'
import { POLYGON } from './contracts.js'
import { getERC20Balance, getNativeBalance, getQuickSwapPair, fetchPrices } from './balances.js'
export { ensurePolygon, waitForReceipt } from './evmUtils.js'

// ─── ABIs ──────────────────────────────────────────────────────────────────

export const ERC20_ABI = [
  { name: 'approve',    type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance',  type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf',  type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'transfer',   type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'transferFrom', type: 'function', inputs: [
    { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }
  ], outputs: [{ type: 'bool' }] },
]

const AAVE_POOL_ABI = [
  { name: 'supply',   type: 'function', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'onBehalfOf', type: 'address' }, { name: 'referralCode', type: 'uint16' }], outputs: [] },
  { name: 'withdraw', type: 'function', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'to', type: 'address' }], outputs: [{ type: 'uint256' }] },
]

const QUICKSWAP_ROUTER_ABI = [
  { name: 'addLiquidity', type: 'function', inputs: [
    { name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' },
    { name: 'amountADesired', type: 'uint256' }, { name: 'amountBDesired', type: 'uint256' },
    { name: 'amountAMin', type: 'uint256' }, { name: 'amountBMin', type: 'uint256' },
    { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' },
  ], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }] },
  { name: 'removeLiquidity', type: 'function', inputs: [
    { name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' },
    { name: 'liquidity', type: 'uint256' },
    { name: 'amountAMin', type: 'uint256' }, { name: 'amountBMin', type: 'uint256' },
    { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' },
  ], outputs: [{ type: 'uint256' }, { type: 'uint256' }] },
  // Native MATIC → token swap (payable)
  { name: 'swapExactETHForTokens', type: 'function', inputs: [
    { name: 'amountOutMin', type: 'uint256' },
    { name: 'path', type: 'address[]' },
    { name: 'to', type: 'address' },
    { name: 'deadline', type: 'uint256' },
  ], outputs: [{ name: 'amounts', type: 'uint256[]' }] },
]

const QUICKSWAP_LP_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve',   type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
]

const BALANCER_VAULT_ABI = [
  { name: 'joinPool', type: 'function', inputs: [
    { name: 'poolId', type: 'bytes32' }, { name: 'sender', type: 'address' }, { name: 'recipient', type: 'address' },
    { name: 'request', type: 'tuple', components: [
      { name: 'assets', type: 'address[]' }, { name: 'maxAmountsIn', type: 'uint256[]' },
      { name: 'userData', type: 'bytes' }, { name: 'fromInternalBalance', type: 'bool' },
    ]},
  ], outputs: [] },
  { name: 'exitPool', type: 'function', inputs: [
    { name: 'poolId', type: 'bytes32' }, { name: 'sender', type: 'address' }, { name: 'recipient', type: 'address' },
    { name: 'request', type: 'tuple', components: [
      { name: 'assets', type: 'address[]' }, { name: 'minAmountsOut', type: 'uint256[]' },
      { name: 'userData', type: 'bytes' }, { name: 'toInternalBalance', type: 'bool' },
    ]},
  ], outputs: [] },
]

// Multicall3 aggregate3 (no ETH per-call)
const AGGREGATE3_ABI = [
  { name: 'aggregate3', type: 'function', inputs: [{ name: 'calls', type: 'tuple[]', components: [
    { name: 'target', type: 'address' }, { name: 'allowFailure', type: 'bool' }, { name: 'callData', type: 'bytes' },
  ]}], outputs: [] },
]

// Multicall3 aggregate3Value (ETH per-call support)
const AGGREGATE3_VALUE_ABI = [
  { name: 'aggregate3Value', type: 'function', inputs: [{ name: 'calls', type: 'tuple[]', components: [
    { name: 'target', type: 'address' }, { name: 'allowFailure', type: 'bool' },
    { name: 'value', type: 'uint256' }, { name: 'callData', type: 'bytes' },
  ]}], outputs: [] },
]

// ─── eth_call helper ────────────────────────────────────────────────────────

async function ethCall(to, data, from) {
  if (!window.ethereum) return null
  try {
    const params = from ? [{ from, to, data }, 'latest'] : [{ to, data }, 'latest']
    return await window.ethereum.request({ method: 'eth_call', params })
  } catch (err) {
    throw err
  }
}

// ─── Individual call encoders ───────────────────────────────────────────────

function encERC20Approve(token, spender, amount = BigInt(POLYGON.MAX_UINT256)) {
  return { target: token, allowFailure: false, callData: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [spender, amount] }) }
}

function encERC20TransferFrom(token, from, to, amount) {
  return { target: token, allowFailure: false, callData: encodeFunctionData({ abi: ERC20_ABI, functionName: 'transferFrom', args: [from, to, amount] }) }
}

function encAaveSupply(asset, amount, onBehalfOf) {
  return { target: POLYGON.AAVE_POOL, allowFailure: false, callData: encodeFunctionData({ abi: AAVE_POOL_ABI, functionName: 'supply', args: [asset, amount, onBehalfOf, POLYGON.AAVE_REFERRAL] }) }
}

function encAaveWithdraw(asset, amount, to) {
  return { target: POLYGON.AAVE_POOL, allowFailure: false, callData: encodeFunctionData({ abi: AAVE_POOL_ABI, functionName: 'withdraw', args: [asset, amount, to] }) }
}

function encQuickswapAddLiquidity(tokenA, tokenB, amtA, amtB, to) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
  return {
    target: POLYGON.QUICKSWAP_ROUTER,
    allowFailure: true,
    callData: encodeFunctionData({ abi: QUICKSWAP_ROUTER_ABI, functionName: 'addLiquidity', args: [tokenA, tokenB, amtA, amtB, amtA * 90n / 100n, amtB * 90n / 100n, to, deadline] }),
  }
}

function encQuickswapRemoveLiquidity(tokenA, tokenB, lpAmt, to) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
  return {
    target: POLYGON.QUICKSWAP_ROUTER,
    allowFailure: false,
    callData: encodeFunctionData({ abi: QUICKSWAP_ROUTER_ABI, functionName: 'removeLiquidity', args: [tokenA, tokenB, lpAmt, 0n, 0n, to, deadline] }),
  }
}

// For native MATIC swap via aggregate3Value
function encSwapETHForTokens(amountOutMin, path, to, maticValue) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
  return {
    target: POLYGON.QUICKSWAP_ROUTER,
    allowFailure: false,
    value: maticValue,
    callData: encodeFunctionData({ abi: QUICKSWAP_ROUTER_ABI, functionName: 'swapExactETHForTokens', args: [amountOutMin, path, to, deadline] }),
  }
}

function encBalancerJoin(poolId, assets, amounts, recipient) {
  const userData = encodeBalancerUserData(1n, amounts, 0n) // EXACT_TOKENS_IN_FOR_BPT_OUT
  return {
    target: POLYGON.BALANCER_VAULT,
    allowFailure: true,
    callData: encodeFunctionData({ abi: BALANCER_VAULT_ABI, functionName: 'joinPool', args: [poolId, recipient, recipient, { assets, maxAmountsIn: amounts, userData, fromInternalBalance: false }] }),
  }
}

function encBalancerExit(poolId, assets, bptAmount, recipient) {
  // EXACT_BPT_IN_FOR_TOKENS_OUT: userData = abi.encode(1, bptAmount)
  const userData = '0x' + pad32(1n) + pad32(bptAmount)
  return {
    target: POLYGON.BALANCER_VAULT,
    allowFailure: false,
    callData: encodeFunctionData({ abi: BALANCER_VAULT_ABI, functionName: 'exitPool', args: [poolId, recipient, recipient, { assets, minAmountsOut: assets.map(() => 0n), userData, toInternalBalance: false }] }),
  }
}

// ─── ABI helpers ───────────────────────────────────────────────────────────

function pad32(bn) { return BigInt(bn).toString(16).padStart(64, '0') }

function encodeBalancerUserData(joinKind, amounts, minBPT) {
  const n = amounts.length
  const parts = [pad32(joinKind), pad32(96n), pad32(minBPT), pad32(BigInt(n)), ...amounts.map(a => pad32(a))]
  return '0x' + parts.join('')
}

// ─── Multicall3 dispatch ────────────────────────────────────────────────────

function buildMulticall3Tx(userAddress, calls) {
  return {
    from: userAddress,
    to:   POLYGON.MULTICALL3,
    data: encodeFunctionData({ abi: AGGREGATE3_ABI, functionName: 'aggregate3', args: [calls] }),
  }
}

function buildMulticall3ValueTx(userAddress, calls, totalValue) {
  return {
    from:  userAddress,
    to:    POLYGON.MULTICALL3,
    value: '0x' + totalValue.toString(16),
    data:  encodeFunctionData({ abi: AGGREGATE3_VALUE_ABI, functionName: 'aggregate3Value', args: [calls] }),
  }
}

// ─── Simulation ─────────────────────────────────────────────────────────────

/**
 * Simulate a transaction via eth_call.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export async function simulateTx(txParams, userAddress) {
  if (!window.ethereum) return { ok: false, reason: 'No wallet' }
  try {
    await window.ethereum.request({
      method: 'eth_call',
      params: [{ ...txParams, from: userAddress }, 'latest'],
    })
    return { ok: true }
  } catch (err) {
    const msg = err?.data?.message ?? err?.message ?? 'Simulation failed'
    return { ok: false, reason: msg }
  }
}

// ─── ERC-20 approval helpers ─────────────────────────────────────────────────

export async function checkAllowance(tokenAddress, ownerAddress, spenderAddress) {
  const data = encodeFunctionData({ abi: ERC20_ABI, functionName: 'allowance', args: [ownerAddress, spenderAddress] })
  const raw = await ethCall(tokenAddress, data).catch(() => null)
  return raw ? BigInt(raw) : 0n
}

export async function approveERC20(tokenAddress, spenderAddress) {
  if (!window.ethereum) throw new Error('No wallet found')
  const accounts = await window.ethereum.request({ method: 'eth_accounts' })
  const from = accounts[0]
  const data = encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [spenderAddress, BigInt(POLYGON.MAX_UINT256)] })
  return window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from, to: tokenAddress, data }] })
}

// Approvals point to Multicall3 (not to AAVE/QuickSwap directly)
// because the batch does transferFrom(user → multicall3) first, then internally approves the protocol.
const STRATEGY_APPROVALS = {
  'poly-stablecoin-vault': [
    { token: POLYGON.USDC, spender: POLYGON.MULTICALL3, label: 'USDC → Multicall3' },
    { token: POLYGON.USDT, spender: POLYGON.MULTICALL3, label: 'USDT → Multicall3' },
  ],
  'poly-correlated-pairs': [
    { token: POLYGON.WBTC, spender: POLYGON.MULTICALL3, label: 'WBTC → Multicall3' },
    { token: POLYGON.WETH, spender: POLYGON.MULTICALL3, label: 'WETH → Multicall3' },
  ],
  'poly-yield-accelerator': [
    { token: POLYGON.USDC,   spender: POLYGON.MULTICALL3, label: 'USDC → Multicall3' },
    { token: POLYGON.WETH,   spender: POLYGON.MULTICALL3, label: 'WETH → Multicall3' },
    { token: POLYGON.WMATIC, spender: POLYGON.MULTICALL3, label: 'WMATIC → Multicall3' },
  ],
  'poly-alpha-hunt': [
    { token: POLYGON.WETH,   spender: POLYGON.MULTICALL3, label: 'WETH → Multicall3' },
    { token: POLYGON.WBTC,   spender: POLYGON.MULTICALL3, label: 'WBTC → Multicall3' },
    { token: POLYGON.USDC,   spender: POLYGON.MULTICALL3, label: 'USDC → Multicall3' },
    { token: POLYGON.QUICK,  spender: POLYGON.MULTICALL3, label: 'QUICK → Multicall3' },
    { token: POLYGON.WMATIC, spender: POLYGON.MULTICALL3, label: 'WMATIC → Multicall3' },
  ],
}

export async function checkStrategyApprovals(strategyId, userAddress) {
  const required = STRATEGY_APPROVALS[strategyId] ?? []
  const needed = []
  for (const req of required) {
    const allowance = await checkAllowance(req.token, userAddress, req.spender)
    if (allowance === 0n) needed.push(req)
  }
  return needed
}

// ─── Strategy deposit — existing-token path (user has all tokens) ──────────
// Architecture:
//   Each token: transferFrom(user → Multicall3) → approve(protocol) → protocol.supply(...)
// This means user approves tokens TO Multicall3 once (see checkStrategyApprovals above).

function buildDepositCalls(strategyId, totalUSD6, userAddress) {
  const mul = POLYGON.MULTICALL3

  if (strategyId === 'poly-stablecoin-vault') {
    const usdcAmt = totalUSD6 * 55n / 100n
    const usdtAmt = totalUSD6 * 30n / 100n
    const lpUsdc  = totalUSD6 * 8n  / 100n
    const lpUsdt  = totalUSD6 - usdcAmt - usdtAmt - lpUsdc
    return [
      // Pull USDC from user → Multicall3, approve AAVE, supply on behalf of user
      encERC20TransferFrom(POLYGON.USDC, userAddress, mul, usdcAmt + lpUsdc),
      encERC20Approve(POLYGON.USDC, POLYGON.AAVE_POOL, usdcAmt),
      encAaveSupply(POLYGON.USDC, usdcAmt, userAddress),
      // Pull USDT
      encERC20TransferFrom(POLYGON.USDT, userAddress, mul, usdtAmt + lpUsdt),
      encERC20Approve(POLYGON.USDT, POLYGON.AAVE_POOL, usdtAmt),
      encAaveSupply(POLYGON.USDT, usdtAmt, userAddress),
      // USDC/USDT LP — approve QuickSwap, addLiquidity (LP tokens go to user)
      encERC20Approve(POLYGON.USDC, POLYGON.QUICKSWAP_ROUTER, lpUsdc),
      encERC20Approve(POLYGON.USDT, POLYGON.QUICKSWAP_ROUTER, lpUsdt),
      encQuickswapAddLiquidity(POLYGON.USDC, POLYGON.USDT, lpUsdc, lpUsdt, userAddress),
    ]
  }

  if (strategyId === 'poly-correlated-pairs') {
    const wbtcAmt = totalUSD6 * 45n / 100n  // approximate; real amt depends on WBTC price
    const wethAmt = totalUSD6 - wbtcAmt
    return [
      encERC20TransferFrom(POLYGON.WBTC, userAddress, mul, wbtcAmt),
      encERC20TransferFrom(POLYGON.WETH, userAddress, mul, wethAmt),
      encERC20Approve(POLYGON.WETH, POLYGON.AAVE_POOL, wethAmt * 20n / 55n),
      encAaveSupply(POLYGON.WETH, wethAmt * 20n / 55n, userAddress),
      encERC20Approve(POLYGON.WBTC, POLYGON.UNI_POSITION_MGR, wbtcAmt),
      encERC20Approve(POLYGON.WETH, POLYGON.UNI_POSITION_MGR, wethAmt * 35n / 55n),
      // Uniswap v3 LP via QuickSwap as fallback (v2 interface is simpler for batching)
      encQuickswapAddLiquidity(POLYGON.WBTC, POLYGON.WETH, wbtcAmt, wethAmt * 35n / 55n, userAddress),
    ]
  }

  if (strategyId === 'poly-yield-accelerator') {
    const maticUsdcAmt = totalUSD6 * 40n / 100n
    const wethMaticAmt = totalUSD6 * 35n / 100n
    const uniAmt       = totalUSD6 - maticUsdcAmt - wethMaticAmt
    return [
      encERC20TransferFrom(POLYGON.USDC,   userAddress, mul, maticUsdcAmt + uniAmt),
      encERC20TransferFrom(POLYGON.WETH,   userAddress, mul, wethMaticAmt),
      encERC20TransferFrom(POLYGON.WMATIC, userAddress, mul, maticUsdcAmt + wethMaticAmt),
      encERC20Approve(POLYGON.WMATIC, POLYGON.QUICKSWAP_ROUTER, maticUsdcAmt + wethMaticAmt),
      encERC20Approve(POLYGON.USDC,   POLYGON.QUICKSWAP_ROUTER, maticUsdcAmt + uniAmt),
      encERC20Approve(POLYGON.WETH,   POLYGON.QUICKSWAP_ROUTER, wethMaticAmt),
      encQuickswapAddLiquidity(POLYGON.WMATIC, POLYGON.USDC, maticUsdcAmt, maticUsdcAmt, userAddress),
      encQuickswapAddLiquidity(POLYGON.WETH,   POLYGON.WMATIC, wethMaticAmt, wethMaticAmt, userAddress),
      encQuickswapAddLiquidity(POLYGON.WMATIC, POLYGON.USDC, uniAmt, uniAmt, userAddress),
    ]
  }

  if (strategyId === 'poly-alpha-hunt') {
    const balAmt   = totalUSD6 * 35n / 100n
    const quickAmt = totalUSD6 * 30n / 100n
    const balBal2  = totalUSD6 * 20n / 100n
    return [
      encERC20TransferFrom(POLYGON.USDC,   userAddress, mul, balAmt),
      encERC20TransferFrom(POLYGON.WBTC,   userAddress, mul, balAmt),
      encERC20TransferFrom(POLYGON.WETH,   userAddress, mul, balAmt + balBal2),
      encERC20TransferFrom(POLYGON.QUICK,  userAddress, mul, quickAmt),
      encERC20TransferFrom(POLYGON.WMATIC, userAddress, mul, quickAmt),
      encERC20Approve(POLYGON.USDC,  POLYGON.BALANCER_VAULT, balAmt),
      encERC20Approve(POLYGON.WBTC,  POLYGON.BALANCER_VAULT, balAmt),
      encERC20Approve(POLYGON.WETH,  POLYGON.BALANCER_VAULT, balAmt + balBal2),
      encBalancerJoin(POLYGON.BALANCER_WETH_WBTC_USDC_POOL_ID, [POLYGON.USDC, POLYGON.WBTC, POLYGON.WETH], [balAmt, balAmt, balAmt], userAddress),
      encBalancerJoin(POLYGON.BALANCER_BAL_WETH_POOL_ID, [POLYGON.WETH, POLYGON.BAL], [balBal2, 0n], userAddress),
      encERC20Approve(POLYGON.QUICK,  POLYGON.QUICKSWAP_ROUTER, quickAmt),
      encERC20Approve(POLYGON.WMATIC, POLYGON.QUICKSWAP_ROUTER, quickAmt),
      encQuickswapAddLiquidity(POLYGON.QUICK, POLYGON.WMATIC, quickAmt, quickAmt, userAddress),
    ]
  }

  return []
}

// ─── Strategy deposit — swap-from-MATIC path (1-click, no prior tokens) ────
// Uses aggregate3Value so each call can carry its own ETH value.
// The MATIC swaps land in Multicall3, then Multicall3 approves AAVE / QuickSwap internally.

async function buildSwapAndDepositValueCalls(strategyId, totalMaticWei, userAddress) {
  const prices = await fetchPrices()
  const maticPrice = prices.MATIC

  if (strategyId === 'poly-stablecoin-vault') {
    const usdcFraction = 0.63  // 55% AAVE + 8% LP
    const usdtFraction = 0.37  // 30% AAVE + 7% LP

    const maticForUsdc = totalMaticWei * 63n / 100n
    const maticForUsdt = totalMaticWei - maticForUsdc

    // Estimate minimum out (95% of expected, accounting for slippage)
    const expectedUsdc6 = BigInt(Math.floor(Number(maticForUsdc) / 1e18 * maticPrice * 0.95 * 1e6))
    const expectedUsdt6 = BigInt(Math.floor(Number(maticForUsdt) / 1e18 * maticPrice * 0.95 * 1e6))

    const usdcAmt55 = expectedUsdc6 * 55n / 63n  // portion for AAVE
    const lpUsdc    = expectedUsdc6 - usdcAmt55
    const usdtAmt30 = expectedUsdt6 * 30n / 37n  // portion for AAVE
    const lpUsdt    = expectedUsdt6 - usdtAmt30

    return {
      calls: [
        // Swap MATIC → USDC (output to Multicall3 itself)
        encSwapETHForTokens(expectedUsdc6, [POLYGON.WMATIC, POLYGON.USDC], POLYGON.MULTICALL3, maticForUsdc),
        // Swap MATIC → USDT
        encSwapETHForTokens(expectedUsdt6, [POLYGON.WMATIC, POLYGON.USDT], POLYGON.MULTICALL3, maticForUsdt),
        // Approve AAVE for USDC and supply
        encERC20Approve(POLYGON.USDC, POLYGON.AAVE_POOL, usdcAmt55),
        encAaveSupply(POLYGON.USDC, usdcAmt55, userAddress),
        // Approve AAVE for USDT and supply
        encERC20Approve(POLYGON.USDT, POLYGON.AAVE_POOL, usdtAmt30),
        encAaveSupply(POLYGON.USDT, usdtAmt30, userAddress),
        // Remaining USDC + USDT → QuickSwap LP
        encERC20Approve(POLYGON.USDC, POLYGON.QUICKSWAP_ROUTER, lpUsdc),
        encERC20Approve(POLYGON.USDT, POLYGON.QUICKSWAP_ROUTER, lpUsdt),
        encQuickswapAddLiquidity(POLYGON.USDC, POLYGON.USDT, lpUsdc, lpUsdt, userAddress),
      ],
      totalValue: totalMaticWei,
    }
  }

  if (strategyId === 'poly-yield-accelerator') {
    const maticForUsdc = totalMaticWei * 40n / 100n
    const maticForWeth = totalMaticWei * 35n / 100n
    const maticDirect  = totalMaticWei - maticForUsdc - maticForWeth  // direct MATIC for LP

    const expUsdc = BigInt(Math.floor(Number(maticForUsdc) / 1e18 * maticPrice * 0.95 * 1e6))
    const expWeth = BigInt(Math.floor(Number(maticForWeth) / 1e18 * maticPrice / prices.WETH * 0.95 * 1e18))

    return {
      calls: [
        encSwapETHForTokens(expUsdc, [POLYGON.WMATIC, POLYGON.USDC], POLYGON.MULTICALL3, maticForUsdc),
        encSwapETHForTokens(expWeth, [POLYGON.WMATIC, POLYGON.WETH],  POLYGON.MULTICALL3, maticForWeth),
        // Wrap remaining MATIC to WMATIC for LP
        encSwapETHForTokens(maticDirect * 95n / 100n, [POLYGON.WMATIC], POLYGON.MULTICALL3, maticDirect),
        // LP pairs
        encERC20Approve(POLYGON.WMATIC, POLYGON.QUICKSWAP_ROUTER, maticDirect),
        encERC20Approve(POLYGON.USDC,   POLYGON.QUICKSWAP_ROUTER, expUsdc),
        encERC20Approve(POLYGON.WETH,   POLYGON.QUICKSWAP_ROUTER, expWeth),
        encQuickswapAddLiquidity(POLYGON.WMATIC, POLYGON.USDC, maticDirect * 40n / 100n, expUsdc, userAddress),
        encQuickswapAddLiquidity(POLYGON.WETH,   POLYGON.WMATIC, expWeth, maticDirect * 35n / 100n, userAddress),
      ],
      totalValue: totalMaticWei,
    }
  }

  // Other strategies: fallback to stablecoin vault
  return buildSwapAndDepositValueCalls('poly-stablecoin-vault', totalMaticWei, userAddress)
}

// ─── Execute strategy ────────────────────────────────────────────────────────

/**
 * Execute a Polygon strategy.
 * @param {string}  strategyId    - e.g. 'poly-stablecoin-vault'
 * @param {bigint}  totalUSD6     - total investment in 6-decimal units ($1 = 1_000_000n)
 * @param {string}  userAddress   - connected wallet
 * @param {boolean} swapFromMatic - true = use aggregate3Value path (swap native MATIC first)
 * @param {bigint}  maticWei      - total native MATIC to send (only used when swapFromMatic=true)
 */
export async function executePolygonStrategy(strategyId, totalUSD6, userAddress, swapFromMatic = false, maticWei = 0n, skipSimulation = false) {
  if (!window.ethereum) throw new Error('No wallet found')

  let tx

  if (swapFromMatic) {
    const { calls, totalValue } = await buildSwapAndDepositValueCalls(strategyId, maticWei, userAddress)
    tx = buildMulticall3ValueTx(userAddress, calls, totalValue)
  } else {
    const calls = buildDepositCalls(strategyId, totalUSD6, userAddress)
    if (calls.length === 0) throw new Error('No calls for this strategy')
    tx = buildMulticall3Tx(userAddress, calls)
  }

  if (!skipSimulation) {
    const sim = await simulateTx(tx, userAddress)
    if (!sim.ok) {
      const err = new Error(`Simulation failed: ${sim.reason}`)
      err.simulation = true
      throw err
    }
  }

  return window.ethereum.request({ method: 'eth_sendTransaction', params: [tx] })
}

// ─── Withdrawal (deactivation) ────────────────────────────────────────────────

/**
 * Build withdrawal calls for each strategy.
 * Returns { calls, tx } — a Multicall3 batch that exits all positions.
 */
async function buildWithdrawalCalls(strategyId, userAddress) {
  if (strategyId === 'poly-stablecoin-vault') {
    const [aUsdcBal, aUsdtBal] = await Promise.all([
      getERC20Balance(POLYGON.A_USDC, userAddress),
      getERC20Balance(POLYGON.A_USDT, userAddress),
    ])
    const calls = []
    if (aUsdcBal > 0n) calls.push(encAaveWithdraw(POLYGON.USDC, BigInt(POLYGON.MAX_UINT256), userAddress))
    if (aUsdtBal > 0n) calls.push(encAaveWithdraw(POLYGON.USDT, BigInt(POLYGON.MAX_UINT256), userAddress))

    // QuickSwap LP
    const lpPair = await getQuickSwapPair(POLYGON.USDC, POLYGON.USDT)
    if (lpPair) {
      const lpBal = await getERC20Balance(lpPair, userAddress)
      if (lpBal > 0n) {
        // Approve LP for router, then remove liquidity
        calls.push({
          target: lpPair, allowFailure: true,
          callData: encodeFunctionData({ abi: QUICKSWAP_LP_ABI, functionName: 'approve', args: [POLYGON.QUICKSWAP_ROUTER, lpBal] }),
        })
        calls.push(encQuickswapRemoveLiquidity(POLYGON.USDC, POLYGON.USDT, lpBal, userAddress))
      }
    }
    return calls
  }

  if (strategyId === 'poly-correlated-pairs') {
    const aWethBal = await getERC20Balance(POLYGON.A_WETH, userAddress)
    const aWbtcBal = await getERC20Balance(POLYGON.A_WBTC, userAddress)
    const calls = []
    if (aWethBal > 0n) calls.push(encAaveWithdraw(POLYGON.WETH, BigInt(POLYGON.MAX_UINT256), userAddress))
    if (aWbtcBal > 0n) calls.push(encAaveWithdraw(POLYGON.WBTC, BigInt(POLYGON.MAX_UINT256), userAddress))

    const lpPair = await getQuickSwapPair(POLYGON.WBTC, POLYGON.WETH)
    if (lpPair) {
      const lpBal = await getERC20Balance(lpPair, userAddress)
      if (lpBal > 0n) {
        calls.push({ target: lpPair, allowFailure: true, callData: encodeFunctionData({ abi: QUICKSWAP_LP_ABI, functionName: 'approve', args: [POLYGON.QUICKSWAP_ROUTER, lpBal] }) })
        calls.push(encQuickswapRemoveLiquidity(POLYGON.WBTC, POLYGON.WETH, lpBal, userAddress))
      }
    }
    return calls
  }

  if (strategyId === 'poly-yield-accelerator') {
    const calls = []
    for (const [tA, tB] of [[POLYGON.WMATIC, POLYGON.USDC], [POLYGON.WETH, POLYGON.WMATIC], [POLYGON.WMATIC, POLYGON.USDC]]) {
      const lpPair = await getQuickSwapPair(tA, tB)
      if (!lpPair) continue
      const lpBal = await getERC20Balance(lpPair, userAddress)
      if (lpBal > 0n) {
        calls.push({ target: lpPair, allowFailure: true, callData: encodeFunctionData({ abi: QUICKSWAP_LP_ABI, functionName: 'approve', args: [POLYGON.QUICKSWAP_ROUTER, lpBal] }) })
        calls.push(encQuickswapRemoveLiquidity(tA, tB, lpBal, userAddress))
      }
    }
    return calls
  }

  if (strategyId === 'poly-alpha-hunt') {
    const calls = []
    // Exit both Balancer pools
    calls.push(encBalancerExit(POLYGON.BALANCER_WETH_WBTC_USDC_POOL_ID, [POLYGON.USDC, POLYGON.WBTC, POLYGON.WETH], BigInt(POLYGON.MAX_UINT256), userAddress))
    calls.push(encBalancerExit(POLYGON.BALANCER_BAL_WETH_POOL_ID, [POLYGON.WETH, POLYGON.BAL], BigInt(POLYGON.MAX_UINT256), userAddress))
    // Exit QuickSwap LP
    const lpPair = await getQuickSwapPair(POLYGON.QUICK, POLYGON.WMATIC)
    if (lpPair) {
      const lpBal = await getERC20Balance(lpPair, userAddress)
      if (lpBal > 0n) {
        calls.push({ target: lpPair, allowFailure: true, callData: encodeFunctionData({ abi: QUICKSWAP_LP_ABI, functionName: 'approve', args: [POLYGON.QUICKSWAP_ROUTER, lpBal] }) })
        calls.push(encQuickswapRemoveLiquidity(POLYGON.QUICK, POLYGON.WMATIC, lpBal, userAddress))
      }
    }
    return calls
  }

  return []
}

/**
 * Execute strategy withdrawal (deactivation).
 * Sends all exit calls in one Multicall3 transaction.
 * Returns { txHash, positions } where positions summarises what was withdrawn.
 */
export async function executeWithdrawal(strategyId, userAddress) {
  if (!window.ethereum) throw new Error('No wallet found')

  const calls = await buildWithdrawalCalls(strategyId, userAddress)
  if (calls.length === 0) throw new Error('No positions found to withdraw')

  const tx = buildMulticall3Tx(userAddress, calls)

  // Simulate
  const sim = await simulateTx(tx, userAddress)
  if (!sim.ok) {
    const err = new Error(`Withdrawal simulation failed: ${sim.reason}`)
    err.simulation = true
    throw err
  }

  const txHash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [tx] })
  return { txHash }
}
