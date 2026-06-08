import { encodeFunctionData } from 'viem'
import { POLYGON, BASE, BNB } from './contracts.js'
import { getERC20Balance, getNativeBalance, getQuickSwapPair, fetchPrices } from './balances.js'
export { ensurePolygon, ensureBase, ensureBNB, CHAIN_ENSURE, waitForReceipt } from './evmUtils.js'

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

// Aerodrome (Velodrome fork) — adds `stable` bool to addLiquidity/removeLiquidity
const AERODROME_ROUTER_ABI = [
  { name: 'addLiquidity', type: 'function', inputs: [
    { name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' },
    { name: 'stable', type: 'bool' },
    { name: 'amountADesired', type: 'uint256' }, { name: 'amountBDesired', type: 'uint256' },
    { name: 'amountAMin', type: 'uint256' }, { name: 'amountBMin', type: 'uint256' },
    { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' },
  ], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }] },
  { name: 'removeLiquidity', type: 'function', inputs: [
    { name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' },
    { name: 'stable', type: 'bool' },
    { name: 'liquidity', type: 'uint256' },
    { name: 'amountAMin', type: 'uint256' }, { name: 'amountBMin', type: 'uint256' },
    { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' },
  ], outputs: [{ type: 'uint256' }, { type: 'uint256' }] },
]

const AERODROME_FACTORY_ABI = [
  { name: 'getPool', type: 'function', inputs: [
    { name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }, { name: 'stable', type: 'bool' },
  ], outputs: [{ type: 'address' }] },
]

// PancakeSwap v2 — same interface as QuickSwap v2 (Uniswap v2 fork)
const PANCAKE_FACTORY_ABI = [
  { name: 'getPair', type: 'function', inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }], outputs: [{ type: 'address' }] },
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

// ─── IHYieldVault ABI (ERC-4626 + native helpers) ────────────────────────────

export const IH_VAULT_ABI = [
  // 1-signing deposit: send native token, get vault shares
  { name: 'depositNative',  type: 'function', stateMutability: 'payable',
    inputs: [], outputs: [{ name: 'shares', type: 'uint256' }] },
  // 1-signing withdrawal: burn shares, get native token back
  { name: 'withdrawNative', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'shares', type: 'uint256' }], outputs: [{ name: 'nativeOut', type: 'uint256' }] },
  // ERC-4626 standard reads
  { name: 'totalAssets',    type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalSupply',    type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf',      type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'sharePrice',     type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'positionValue',  type: 'function', stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
]

/**
 * Execute an IHYieldVault deposit in a single MetaMask confirmation.
 * @param {string} vaultAddress  - deployed IHBaseVault / IHPolygonVault / IHBNBVault address
 * @param {string} amountHex     - deposit amount in wei (hex string, e.g. "0xDE0B6B3A7640000" for 1 ETH)
 * @returns {string} txHash
 */
export async function executeVaultDeposit(vaultAddress, amountHex) {
  const calldata = encodeFunctionData({
    abi: IH_VAULT_ABI,
    functionName: 'depositNative',
    args: [],
  })
  const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' })
  return window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{
      from:  account,
      to:    vaultAddress,
      value: amountHex,
      data:  calldata,
    }],
  })
}

/**
 * Execute an IHYieldVault withdrawal in a single MetaMask confirmation.
 * @param {string} vaultAddress - deployed vault address
 * @param {bigint} shares       - vault share tokens to burn (from balanceOf)
 * @returns {string} txHash
 */
export async function executeVaultWithdraw(vaultAddress, shares) {
  const calldata = encodeFunctionData({
    abi: IH_VAULT_ABI,
    functionName: 'withdrawNative',
    args: [shares],
  })
  const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' })
  return window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{ from: account, to: vaultAddress, data: calldata }],
  })
}

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

// Generic AAVE supply/withdraw for any chain (Base, BNB)
function encAaveSupplyTo(pool, referral, asset, amount, onBehalfOf) {
  return { target: pool, allowFailure: false, callData: encodeFunctionData({ abi: AAVE_POOL_ABI, functionName: 'supply', args: [asset, amount, onBehalfOf, referral] }) }
}

function encAaveWithdrawFrom(pool, asset, amount, to) {
  return { target: pool, allowFailure: false, callData: encodeFunctionData({ abi: AAVE_POOL_ABI, functionName: 'withdraw', args: [asset, amount, to] }) }
}

// Aerodrome add/remove liquidity (Base)
function encAerodromeAddLiquidity(tokenA, tokenB, stable, amtA, amtB, to) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
  return {
    target: BASE.AERODROME_ROUTER, allowFailure: true,
    callData: encodeFunctionData({ abi: AERODROME_ROUTER_ABI, functionName: 'addLiquidity', args: [tokenA, tokenB, stable, amtA, amtB, amtA * 90n / 100n, amtB * 90n / 100n, to, deadline] }),
  }
}

function encAerodromeRemoveLiquidity(tokenA, tokenB, stable, lpAmt, to) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
  return {
    target: BASE.AERODROME_ROUTER, allowFailure: false,
    callData: encodeFunctionData({ abi: AERODROME_ROUTER_ABI, functionName: 'removeLiquidity', args: [tokenA, tokenB, stable, lpAmt, 0n, 0n, to, deadline] }),
  }
}

// PancakeSwap v2 add/remove liquidity (BNB) — same ABI as QuickSwap v2
function encPancakeAddLiquidity(tokenA, tokenB, amtA, amtB, to) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
  return {
    target: BNB.PANCAKE_ROUTER_V2, allowFailure: true,
    callData: encodeFunctionData({ abi: QUICKSWAP_ROUTER_ABI, functionName: 'addLiquidity', args: [tokenA, tokenB, amtA, amtB, amtA * 90n / 100n, amtB * 90n / 100n, to, deadline] }),
  }
}

function encPancakeRemoveLiquidity(tokenA, tokenB, lpAmt, to) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
  return {
    target: BNB.PANCAKE_ROUTER_V2, allowFailure: false,
    callData: encodeFunctionData({ abi: QUICKSWAP_ROUTER_ABI, functionName: 'removeLiquidity', args: [tokenA, tokenB, lpAmt, 0n, 0n, to, deadline] }),
  }
}

// Aerodrome factory pool lookup
async function getAerodromePool(tokenA, tokenB, stable) {
  const data = encodeFunctionData({ abi: AERODROME_FACTORY_ABI, functionName: 'getPool', args: [tokenA, tokenB, stable] })
  const raw = await ethCall(BASE.AERODROME_FACTORY, data)
  if (!raw || raw === '0x' + '0'.repeat(64)) return null
  return '0x' + raw.slice(26)
}

// PancakeSwap factory pair lookup
async function getPancakePair(tokenA, tokenB) {
  const data = encodeFunctionData({ abi: PANCAKE_FACTORY_ABI, functionName: 'getPair', args: [tokenA, tokenB] })
  const raw = await ethCall(BNB.PANCAKE_FACTORY_V2, data)
  if (!raw || raw === '0x' + '0'.repeat(64)) return null
  return '0x' + raw.slice(26)
}

// sender = address holding tokens (Multicall3 inside a batch)
// recipient = address that receives BPT (user)
function encBalancerJoin(poolId, assets, amounts, sender, recipient) {
  const userData = encodeBalancerUserData(1n, amounts, 0n) // EXACT_TOKENS_IN_FOR_BPT_OUT
  return {
    target: POLYGON.BALANCER_VAULT,
    allowFailure: true,
    callData: encodeFunctionData({ abi: BALANCER_VAULT_ABI, functionName: 'joinPool', args: [poolId, sender, recipient, { assets, maxAmountsIn: amounts, userData, fromInternalBalance: false }] }),
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

// Chain-agnostic Multicall3 builder (same MC3 address on all chains, but explicit is safer)
const CHAIN_MC3 = { Polygon: POLYGON.MULTICALL3, Base: BASE.MULTICALL3, BNB: BNB.MULTICALL3 }

function buildChainMulticall3Tx(chain, userAddress, calls) {
  const mc3 = CHAIN_MC3[chain] ?? POLYGON.MULTICALL3
  return {
    from: userAddress,
    to:   mc3,
    data: encodeFunctionData({ abi: AGGREGATE3_ABI, functionName: 'aggregate3', args: [calls] }),
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
      params: [{ ...txParams, from: userAddress, gas: '0x4C4B40' /* 5 M gas */ }, 'latest'],
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
  // ── Base ──
  'base-stablecoin-vault': [
    { token: BASE.USDC,  spender: BASE.MULTICALL3, label: 'USDC → Multicall3' },
    { token: BASE.USDBC, spender: BASE.MULTICALL3, label: 'USDbC → Multicall3' },
  ],
  'base-correlated-pairs': [
    { token: BASE.CBETH, spender: BASE.MULTICALL3, label: 'cbETH → Multicall3' },
    { token: BASE.WETH,  spender: BASE.MULTICALL3, label: 'WETH → Multicall3' },
  ],
  'base-yield-accelerator': [
    { token: BASE.WETH, spender: BASE.MULTICALL3, label: 'WETH → Multicall3' },
    { token: BASE.USDC, spender: BASE.MULTICALL3, label: 'USDC → Multicall3' },
  ],
  'base-alpha-hunt': [
    { token: BASE.WETH, spender: BASE.MULTICALL3, label: 'WETH → Multicall3' },
    { token: BASE.AERO, spender: BASE.MULTICALL3, label: 'AERO → Multicall3' },
  ],
  // ── BNB ──
  'bnb-stablecoin-vault': [
    { token: BNB.USDT, spender: BNB.MULTICALL3, label: 'USDT → Multicall3' },
    { token: BNB.USDC, spender: BNB.MULTICALL3, label: 'USDC → Multicall3' },
  ],
  'bnb-correlated-pairs': [
    { token: BNB.BTCB, spender: BNB.MULTICALL3, label: 'BTCB → Multicall3' },
    { token: BNB.ETH,  spender: BNB.MULTICALL3, label: 'ETH → Multicall3' },
  ],
  'bnb-yield-accelerator': [
    { token: BNB.WBNB, spender: BNB.MULTICALL3, label: 'WBNB → Multicall3' },
    { token: BNB.USDT, spender: BNB.MULTICALL3, label: 'USDT → Multicall3' },
  ],
  'bnb-alpha-hunt': [
    { token: BNB.CAKE, spender: BNB.MULTICALL3, label: 'CAKE → Multicall3' },
    { token: BNB.WBNB, spender: BNB.MULTICALL3, label: 'WBNB → Multicall3' },
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

async function buildDepositCalls(strategyId, totalUSD6, userAddress) {
  const totalUSD = Number(totalUSD6) / 1e6  // convert to plain dollar float
  const prices   = await fetchPrices()
  const mul      = POLYGON.MULTICALL3

  // Convert a USD amount to token units (BigInt) using the token's price and decimals
  const toUnits = (usdAmount, decimals, priceUSD) =>
    BigInt(Math.floor(usdAmount / priceUSD * 10 ** decimals))

  // Convenience: stablecoin units (price = $1, 6 dec)
  const toUsdc = (usd) => BigInt(Math.round(usd * 1e6))
  const toUsdt = (usd) => BigInt(Math.round(usd * 1e6))

  if (strategyId === 'poly-stablecoin-vault') {
    // 55% USDC → AAVE, 30% USDT → AAVE, 8% USDC + 7% USDT → QuickSwap LP
    const usdcAave = toUsdc(totalUSD * 0.55)
    const usdtAave = toUsdt(totalUSD * 0.30)
    const lpUsdc   = toUsdc(totalUSD * 0.08)
    const lpUsdt   = toUsdt(totalUSD * 0.07)
    return [
      encERC20TransferFrom(POLYGON.USDC, userAddress, mul, usdcAave + lpUsdc),
      encERC20Approve(POLYGON.USDC, POLYGON.AAVE_POOL, usdcAave),
      encAaveSupply(POLYGON.USDC, usdcAave, userAddress),
      encERC20TransferFrom(POLYGON.USDT, userAddress, mul, usdtAave + lpUsdt),
      encERC20Approve(POLYGON.USDT, POLYGON.AAVE_POOL, usdtAave),
      encAaveSupply(POLYGON.USDT, usdtAave, userAddress),
      encERC20Approve(POLYGON.USDC, POLYGON.QUICKSWAP_ROUTER, lpUsdc),
      encERC20Approve(POLYGON.USDT, POLYGON.QUICKSWAP_ROUTER, lpUsdt),
      encQuickswapAddLiquidity(POLYGON.USDC, POLYGON.USDT, lpUsdc, lpUsdt, userAddress),
    ]
  }

  if (strategyId === 'poly-correlated-pairs') {
    // 20% WETH → AAVE, 40% WBTC + 40% WETH → QuickSwap LP (equal USD value each side)
    const wethAave  = toUnits(totalUSD * 0.20, 18, prices.WETH)
    const wbtcLp    = toUnits(totalUSD * 0.40, 8,  prices.WBTC)
    const wethLp    = toUnits(totalUSD * 0.40, 18, prices.WETH)
    const wethTotal = wethAave + wethLp
    return [
      encERC20TransferFrom(POLYGON.WBTC, userAddress, mul, wbtcLp),
      encERC20TransferFrom(POLYGON.WETH, userAddress, mul, wethTotal),
      // AAVE supply WETH
      encERC20Approve(POLYGON.WETH, POLYGON.AAVE_POOL, wethAave),
      encAaveSupply(POLYGON.WETH, wethAave, userAddress),
      // QuickSwap WBTC/WETH LP — approve router, add liquidity
      encERC20Approve(POLYGON.WBTC, POLYGON.QUICKSWAP_ROUTER, wbtcLp),
      encERC20Approve(POLYGON.WETH, POLYGON.QUICKSWAP_ROUTER, wethLp),
      encQuickswapAddLiquidity(POLYGON.WBTC, POLYGON.WETH, wbtcLp, wethLp, userAddress),
    ]
  }

  if (strategyId === 'poly-yield-accelerator') {
    // 25% WMATIC + 25% USDC → QuickSwap LP (equal USD both sides)
    // 25% WETH + 25% WMATIC → QuickSwap LP (equal USD both sides)
    const wmaticUsdc  = toUnits(totalUSD * 0.25, 18, prices.MATIC)  // WMATIC for MATIC/USDC pair
    const usdcLp      = toUsdc(totalUSD * 0.25)
    const wethLp      = toUnits(totalUSD * 0.25, 18, prices.WETH)
    const wmaticWeth  = toUnits(totalUSD * 0.25, 18, prices.MATIC)  // WMATIC for WETH/MATIC pair
    const wmaticTotal = wmaticUsdc + wmaticWeth
    return [
      encERC20TransferFrom(POLYGON.USDC,   userAddress, mul, usdcLp),
      encERC20TransferFrom(POLYGON.WETH,   userAddress, mul, wethLp),
      encERC20TransferFrom(POLYGON.WMATIC, userAddress, mul, wmaticTotal),
      // WMATIC/USDC LP
      encERC20Approve(POLYGON.WMATIC, POLYGON.QUICKSWAP_ROUTER, wmaticUsdc),
      encERC20Approve(POLYGON.USDC,   POLYGON.QUICKSWAP_ROUTER, usdcLp),
      encQuickswapAddLiquidity(POLYGON.WMATIC, POLYGON.USDC, wmaticUsdc, usdcLp, userAddress),
      // WETH/WMATIC LP
      encERC20Approve(POLYGON.WETH,   POLYGON.QUICKSWAP_ROUTER, wethLp),
      encERC20Approve(POLYGON.WMATIC, POLYGON.QUICKSWAP_ROUTER, wmaticWeth),
      encQuickswapAddLiquidity(POLYGON.WETH, POLYGON.WMATIC, wethLp, wmaticWeth, userAddress),
    ]
  }

  if (strategyId === 'poly-alpha-hunt') {
    // Balancer WBTC/USDC/WETH pool: assets must be sorted by address ascending
    // Sorted: WBTC(0x1BFD) < USDC(0x2791) < WETH(0x7ceB)
    const wbtcBal  = toUnits(totalUSD * 0.20, 8,  prices.WBTC)
    const usdcBal  = toUsdc(totalUSD * 0.20)
    const wethBal  = toUnits(totalUSD * 0.20, 18, prices.WETH)
    // Balancer BAL/WETH pool: WETH(0x7ceB) < BAL(0x9a71) — single-sided WETH join
    const wethBal2 = toUnits(totalUSD * 0.15, 18, prices.WETH)
    // QuickSwap QUICK/WMATIC LP
    const quickLp  = toUnits(totalUSD * 0.125, 18, prices.QUICK)
    const wmaticLp = toUnits(totalUSD * 0.125, 18, prices.MATIC)
    const wethTotal = wethBal + wethBal2

    return [
      // Pull all tokens into Multicall3
      encERC20TransferFrom(POLYGON.WBTC,   userAddress, mul, wbtcBal),
      encERC20TransferFrom(POLYGON.USDC,   userAddress, mul, usdcBal),
      encERC20TransferFrom(POLYGON.WETH,   userAddress, mul, wethTotal),
      encERC20TransferFrom(POLYGON.QUICK,  userAddress, mul, quickLp),
      encERC20TransferFrom(POLYGON.WMATIC, userAddress, mul, wmaticLp),
      // Approve Balancer vault for WBTC/USDC/WETH
      encERC20Approve(POLYGON.WBTC, POLYGON.BALANCER_VAULT, wbtcBal),
      encERC20Approve(POLYGON.USDC, POLYGON.BALANCER_VAULT, usdcBal),
      encERC20Approve(POLYGON.WETH, POLYGON.BALANCER_VAULT, wethTotal),
      // Balancer WBTC/USDC/WETH join — sorted asset order: [WBTC, USDC, WETH]
      // sender = MULTICALL3 (holds tokens), recipient = user (receives BPT)
      encBalancerJoin(
        POLYGON.BALANCER_WETH_WBTC_USDC_POOL_ID,
        [POLYGON.WBTC, POLYGON.USDC, POLYGON.WETH],
        [wbtcBal, usdcBal, wethBal],
        mul, userAddress,
      ),
      // Balancer BAL/WETH join — sorted asset order: [WETH, BAL], single-sided WETH
      encBalancerJoin(
        POLYGON.BALANCER_BAL_WETH_POOL_ID,
        [POLYGON.WETH, POLYGON.BAL],
        [wethBal2, 0n],
        mul, userAddress,
      ),
      // QuickSwap QUICK/WMATIC LP
      encERC20Approve(POLYGON.QUICK,  POLYGON.QUICKSWAP_ROUTER, quickLp),
      encERC20Approve(POLYGON.WMATIC, POLYGON.QUICKSWAP_ROUTER, wmaticLp),
      encQuickswapAddLiquidity(POLYGON.QUICK, POLYGON.WMATIC, quickLp, wmaticLp, userAddress),
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

// ─── Base deposit calls ──────────────────────────────────────────────────────

async function buildBaseDepositCalls(strategyId, totalUSD6, userAddress) {
  const totalUSD = Number(totalUSD6) / 1e6
  const prices = await fetchPrices()
  const mul = BASE.MULTICALL3
  const MAX = BigInt(BASE.MAX_UINT256)

  const toWei18  = (usd, priceKey) => BigInt(Math.floor(usd / prices[priceKey] * 1e18))
  const toUsdc6  = (usd)           => BigInt(Math.round(usd * 1e6))

  if (strategyId === 'base-stablecoin-vault') {
    // 60% USDC → AAVE, 15% USDbC → AAVE, 12.5% USDC + 12.5% USDbC → Aerodrome stable LP
    const usdcAave  = toUsdc6(totalUSD * 0.60)
    const usdbcAave = toUsdc6(totalUSD * 0.15)
    const lpUsdc    = toUsdc6(totalUSD * 0.125)
    const lpUsdbc   = toUsdc6(totalUSD * 0.125)
    return [
      encERC20TransferFrom(BASE.USDC,  userAddress, mul, usdcAave + lpUsdc),
      encERC20TransferFrom(BASE.USDBC, userAddress, mul, usdbcAave + lpUsdbc),
      encERC20Approve(BASE.USDC,  BASE.AAVE_POOL, usdcAave),
      encAaveSupplyTo(BASE.AAVE_POOL, BASE.AAVE_REFERRAL, BASE.USDC, usdcAave, userAddress),
      encERC20Approve(BASE.USDBC, BASE.AAVE_POOL, usdbcAave),
      encAaveSupplyTo(BASE.AAVE_POOL, BASE.AAVE_REFERRAL, BASE.USDBC, usdbcAave, userAddress),
      encERC20Approve(BASE.USDC,  BASE.AERODROME_ROUTER, lpUsdc),
      encERC20Approve(BASE.USDBC, BASE.AERODROME_ROUTER, lpUsdbc),
      encAerodromeAddLiquidity(BASE.USDC, BASE.USDBC, true, lpUsdc, lpUsdbc, userAddress),
    ]
  }

  if (strategyId === 'base-correlated-pairs') {
    // 40% cbETH → AAVE, 10% cbETH + 50% WETH → Aerodrome stable LP
    const cbethAave = toWei18(totalUSD * 0.40, 'CBETH')
    const cbethLp   = toWei18(totalUSD * 0.10, 'CBETH')
    const wethLp    = toWei18(totalUSD * 0.50, 'WETH')
    return [
      encERC20TransferFrom(BASE.CBETH, userAddress, mul, cbethAave + cbethLp),
      encERC20TransferFrom(BASE.WETH,  userAddress, mul, wethLp),
      encERC20Approve(BASE.CBETH, BASE.AAVE_POOL, cbethAave),
      encAaveSupplyTo(BASE.AAVE_POOL, BASE.AAVE_REFERRAL, BASE.CBETH, cbethAave, userAddress),
      encERC20Approve(BASE.CBETH, BASE.AERODROME_ROUTER, cbethLp),
      encERC20Approve(BASE.WETH,  BASE.AERODROME_ROUTER, wethLp),
      encAerodromeAddLiquidity(BASE.CBETH, BASE.WETH, false, cbethLp, wethLp, userAddress),
    ]
  }

  if (strategyId === 'base-yield-accelerator') {
    // 20% WETH → AAVE, 30% WETH + 50% USDC → Aerodrome volatile LP
    const wethAave = toWei18(totalUSD * 0.20, 'WETH')
    const wethLp   = toWei18(totalUSD * 0.30, 'WETH')
    const usdcLp   = toUsdc6(totalUSD * 0.50)
    const wethTotal = wethAave + wethLp
    return [
      encERC20TransferFrom(BASE.WETH, userAddress, mul, wethTotal),
      encERC20TransferFrom(BASE.USDC, userAddress, mul, usdcLp),
      encERC20Approve(BASE.WETH, BASE.AAVE_POOL, wethAave),
      encAaveSupplyTo(BASE.AAVE_POOL, BASE.AAVE_REFERRAL, BASE.WETH, wethAave, userAddress),
      encERC20Approve(BASE.WETH, BASE.AERODROME_ROUTER, wethLp),
      encERC20Approve(BASE.USDC, BASE.AERODROME_ROUTER, usdcLp),
      encAerodromeAddLiquidity(BASE.WETH, BASE.USDC, false, wethLp, usdcLp, userAddress),
    ]
  }

  if (strategyId === 'base-alpha-hunt') {
    // 30% WETH → AAVE, 30% WETH + 40% AERO → Aerodrome volatile LP
    const wethAave  = toWei18(totalUSD * 0.30, 'WETH')
    const wethLp    = toWei18(totalUSD * 0.30, 'WETH')
    const aeroLp    = toWei18(totalUSD * 0.40, 'AERO')
    const wethTotal = wethAave + wethLp
    return [
      encERC20TransferFrom(BASE.WETH, userAddress, mul, wethTotal),
      encERC20TransferFrom(BASE.AERO, userAddress, mul, aeroLp),
      encERC20Approve(BASE.WETH, BASE.AAVE_POOL, wethAave),
      encAaveSupplyTo(BASE.AAVE_POOL, BASE.AAVE_REFERRAL, BASE.WETH, wethAave, userAddress),
      encERC20Approve(BASE.WETH, BASE.AERODROME_ROUTER, wethLp),
      encERC20Approve(BASE.AERO, BASE.AERODROME_ROUTER, aeroLp),
      encAerodromeAddLiquidity(BASE.WETH, BASE.AERO, false, wethLp, aeroLp, userAddress),
    ]
  }

  return []
}

// ─── BNB deposit calls ───────────────────────────────────────────────────────

async function buildBNBDepositCalls(strategyId, totalUSD6, userAddress) {
  const totalUSD = Number(totalUSD6) / 1e6
  const prices = await fetchPrices()
  const mul = BNB.MULTICALL3

  // BNB stablecoins (USDT, USDC) have 18 decimals on BSC
  const toWei18  = (usd, priceKey) => BigInt(Math.floor(usd / prices[priceKey] * 1e18))
  const toStable18 = (usd)         => BigInt(Math.round(usd * 1e18))  // BSC stablecoins = 18 dec

  if (strategyId === 'bnb-stablecoin-vault') {
    // 50% USDT → AAVE, 25% USDT + 25% USDC → PancakeSwap LP
    const usdtAave = toStable18(totalUSD * 0.50)
    const lpUsdt   = toStable18(totalUSD * 0.25)
    const lpUsdc   = toStable18(totalUSD * 0.25)
    return [
      encERC20TransferFrom(BNB.USDT, userAddress, mul, usdtAave + lpUsdt),
      encERC20TransferFrom(BNB.USDC, userAddress, mul, lpUsdc),
      encERC20Approve(BNB.USDT, BNB.AAVE_POOL, usdtAave),
      encAaveSupplyTo(BNB.AAVE_POOL, BNB.AAVE_REFERRAL, BNB.USDT, usdtAave, userAddress),
      encERC20Approve(BNB.USDT, BNB.PANCAKE_ROUTER_V2, lpUsdt),
      encERC20Approve(BNB.USDC, BNB.PANCAKE_ROUTER_V2, lpUsdc),
      encPancakeAddLiquidity(BNB.USDT, BNB.USDC, lpUsdt, lpUsdc, userAddress),
    ]
  }

  if (strategyId === 'bnb-correlated-pairs') {
    // 30% BTCB → AAVE, 20% BTCB + 50% ETH → PancakeSwap LP
    const btcbAave  = toWei18(totalUSD * 0.30, 'BTCB')
    const btcbLp    = toWei18(totalUSD * 0.20, 'BTCB')
    const ethLp     = toWei18(totalUSD * 0.50, 'ETH')
    const btcbTotal = btcbAave + btcbLp
    return [
      encERC20TransferFrom(BNB.BTCB, userAddress, mul, btcbTotal),
      encERC20TransferFrom(BNB.ETH,  userAddress, mul, ethLp),
      encERC20Approve(BNB.BTCB, BNB.AAVE_POOL, btcbAave),
      encAaveSupplyTo(BNB.AAVE_POOL, BNB.AAVE_REFERRAL, BNB.BTCB, btcbAave, userAddress),
      encERC20Approve(BNB.BTCB, BNB.PANCAKE_ROUTER_V2, btcbLp),
      encERC20Approve(BNB.ETH,  BNB.PANCAKE_ROUTER_V2, ethLp),
      encPancakeAddLiquidity(BNB.BTCB, BNB.ETH, btcbLp, ethLp, userAddress),
    ]
  }

  if (strategyId === 'bnb-yield-accelerator') {
    // 40% WBNB → AAVE, 20% WBNB + 40% USDT → PancakeSwap LP
    const wbnbAave  = toWei18(totalUSD * 0.40, 'BNB')
    const wbnbLp    = toWei18(totalUSD * 0.20, 'BNB')
    const usdtLp    = toStable18(totalUSD * 0.40)
    const wbnbTotal = wbnbAave + wbnbLp
    return [
      encERC20TransferFrom(BNB.WBNB, userAddress, mul, wbnbTotal),
      encERC20TransferFrom(BNB.USDT, userAddress, mul, usdtLp),
      encERC20Approve(BNB.WBNB, BNB.AAVE_POOL, wbnbAave),
      encAaveSupplyTo(BNB.AAVE_POOL, BNB.AAVE_REFERRAL, BNB.WBNB, wbnbAave, userAddress),
      encERC20Approve(BNB.WBNB, BNB.PANCAKE_ROUTER_V2, wbnbLp),
      encERC20Approve(BNB.USDT, BNB.PANCAKE_ROUTER_V2, usdtLp),
      encPancakeAddLiquidity(BNB.WBNB, BNB.USDT, wbnbLp, usdtLp, userAddress),
    ]
  }

  if (strategyId === 'bnb-alpha-hunt') {
    // 30% WBNB → AAVE, 20% WBNB + 50% CAKE → PancakeSwap LP
    const wbnbAave  = toWei18(totalUSD * 0.30, 'BNB')
    const wbnbLp    = toWei18(totalUSD * 0.20, 'BNB')
    const cakeLp    = toWei18(totalUSD * 0.50, 'CAKE')
    const wbnbTotal = wbnbAave + wbnbLp
    return [
      encERC20TransferFrom(BNB.WBNB, userAddress, mul, wbnbTotal),
      encERC20TransferFrom(BNB.CAKE, userAddress, mul, cakeLp),
      encERC20Approve(BNB.WBNB, BNB.AAVE_POOL, wbnbAave),
      encAaveSupplyTo(BNB.AAVE_POOL, BNB.AAVE_REFERRAL, BNB.WBNB, wbnbAave, userAddress),
      encERC20Approve(BNB.WBNB, BNB.PANCAKE_ROUTER_V2, wbnbLp),
      encERC20Approve(BNB.CAKE, BNB.PANCAKE_ROUTER_V2, cakeLp),
      encPancakeAddLiquidity(BNB.WBNB, BNB.CAKE, wbnbLp, cakeLp, userAddress),
    ]
  }

  return []
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
    const calls = await buildDepositCalls(strategyId, totalUSD6, userAddress)
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

// ─── Base withdrawal calls ───────────────────────────────────────────────────

async function buildBaseWithdrawalCalls(strategyId, userAddress) {
  const MAX = BigInt(BASE.MAX_UINT256)
  const calls = []

  if (strategyId === 'base-stablecoin-vault') {
    const [aUsdc, aUsdbc] = await Promise.all([
      getERC20Balance(BASE.A_USDC,  userAddress),
      getERC20Balance(BASE.A_USDBC, userAddress),
    ])
    if (aUsdc  > 0n) calls.push(encAaveWithdrawFrom(BASE.AAVE_POOL, BASE.USDC,  MAX, userAddress))
    if (aUsdbc > 0n) calls.push(encAaveWithdrawFrom(BASE.AAVE_POOL, BASE.USDBC, MAX, userAddress))
    const pool = await getAerodromePool(BASE.USDC, BASE.USDBC, true)
    if (pool) {
      const lpBal = await getERC20Balance(pool, userAddress)
      if (lpBal > 0n) {
        calls.push({ target: pool, allowFailure: true, callData: encodeFunctionData({ abi: QUICKSWAP_LP_ABI, functionName: 'approve', args: [BASE.AERODROME_ROUTER, lpBal] }) })
        calls.push(encAerodromeRemoveLiquidity(BASE.USDC, BASE.USDBC, true, lpBal, userAddress))
      }
    }
  }

  if (strategyId === 'base-correlated-pairs') {
    const aCbeth = await getERC20Balance(BASE.A_CBETH, userAddress)
    if (aCbeth > 0n) calls.push(encAaveWithdrawFrom(BASE.AAVE_POOL, BASE.CBETH, MAX, userAddress))
    const pool = await getAerodromePool(BASE.CBETH, BASE.WETH, false)
    if (pool) {
      const lpBal = await getERC20Balance(pool, userAddress)
      if (lpBal > 0n) {
        calls.push({ target: pool, allowFailure: true, callData: encodeFunctionData({ abi: QUICKSWAP_LP_ABI, functionName: 'approve', args: [BASE.AERODROME_ROUTER, lpBal] }) })
        calls.push(encAerodromeRemoveLiquidity(BASE.CBETH, BASE.WETH, false, lpBal, userAddress))
      }
    }
  }

  if (strategyId === 'base-yield-accelerator') {
    const aWeth = await getERC20Balance(BASE.A_WETH, userAddress)
    if (aWeth > 0n) calls.push(encAaveWithdrawFrom(BASE.AAVE_POOL, BASE.WETH, MAX, userAddress))
    const pool = await getAerodromePool(BASE.WETH, BASE.USDC, false)
    if (pool) {
      const lpBal = await getERC20Balance(pool, userAddress)
      if (lpBal > 0n) {
        calls.push({ target: pool, allowFailure: true, callData: encodeFunctionData({ abi: QUICKSWAP_LP_ABI, functionName: 'approve', args: [BASE.AERODROME_ROUTER, lpBal] }) })
        calls.push(encAerodromeRemoveLiquidity(BASE.WETH, BASE.USDC, false, lpBal, userAddress))
      }
    }
  }

  if (strategyId === 'base-alpha-hunt') {
    const aWeth = await getERC20Balance(BASE.A_WETH, userAddress)
    if (aWeth > 0n) calls.push(encAaveWithdrawFrom(BASE.AAVE_POOL, BASE.WETH, MAX, userAddress))
    const pool = await getAerodromePool(BASE.WETH, BASE.AERO, false)
    if (pool) {
      const lpBal = await getERC20Balance(pool, userAddress)
      if (lpBal > 0n) {
        calls.push({ target: pool, allowFailure: true, callData: encodeFunctionData({ abi: QUICKSWAP_LP_ABI, functionName: 'approve', args: [BASE.AERODROME_ROUTER, lpBal] }) })
        calls.push(encAerodromeRemoveLiquidity(BASE.WETH, BASE.AERO, false, lpBal, userAddress))
      }
    }
  }

  return calls
}

// ─── BNB withdrawal calls ────────────────────────────────────────────────────

async function buildBNBWithdrawalCalls(strategyId, userAddress) {
  const MAX = BigInt(BNB.MAX_UINT256)
  const calls = []

  if (strategyId === 'bnb-stablecoin-vault') {
    const aUsdt = await getERC20Balance(BNB.A_USDT, userAddress)
    if (aUsdt > 0n) calls.push(encAaveWithdrawFrom(BNB.AAVE_POOL, BNB.USDT, MAX, userAddress))
    const pair = await getPancakePair(BNB.USDT, BNB.USDC)
    if (pair) {
      const lpBal = await getERC20Balance(pair, userAddress)
      if (lpBal > 0n) {
        calls.push({ target: pair, allowFailure: true, callData: encodeFunctionData({ abi: QUICKSWAP_LP_ABI, functionName: 'approve', args: [BNB.PANCAKE_ROUTER_V2, lpBal] }) })
        calls.push(encPancakeRemoveLiquidity(BNB.USDT, BNB.USDC, lpBal, userAddress))
      }
    }
  }

  if (strategyId === 'bnb-correlated-pairs') {
    const aBtcb = await getERC20Balance(BNB.A_BTCB, userAddress)
    if (aBtcb > 0n) calls.push(encAaveWithdrawFrom(BNB.AAVE_POOL, BNB.BTCB, MAX, userAddress))
    const pair = await getPancakePair(BNB.BTCB, BNB.ETH)
    if (pair) {
      const lpBal = await getERC20Balance(pair, userAddress)
      if (lpBal > 0n) {
        calls.push({ target: pair, allowFailure: true, callData: encodeFunctionData({ abi: QUICKSWAP_LP_ABI, functionName: 'approve', args: [BNB.PANCAKE_ROUTER_V2, lpBal] }) })
        calls.push(encPancakeRemoveLiquidity(BNB.BTCB, BNB.ETH, lpBal, userAddress))
      }
    }
  }

  if (strategyId === 'bnb-yield-accelerator') {
    const aWbnb = await getERC20Balance(BNB.A_WBNB, userAddress)
    if (aWbnb > 0n) calls.push(encAaveWithdrawFrom(BNB.AAVE_POOL, BNB.WBNB, MAX, userAddress))
    const pair = await getPancakePair(BNB.WBNB, BNB.USDT)
    if (pair) {
      const lpBal = await getERC20Balance(pair, userAddress)
      if (lpBal > 0n) {
        calls.push({ target: pair, allowFailure: true, callData: encodeFunctionData({ abi: QUICKSWAP_LP_ABI, functionName: 'approve', args: [BNB.PANCAKE_ROUTER_V2, lpBal] }) })
        calls.push(encPancakeRemoveLiquidity(BNB.WBNB, BNB.USDT, lpBal, userAddress))
      }
    }
  }

  if (strategyId === 'bnb-alpha-hunt') {
    const aWbnb = await getERC20Balance(BNB.A_WBNB, userAddress)
    if (aWbnb > 0n) calls.push(encAaveWithdrawFrom(BNB.AAVE_POOL, BNB.WBNB, MAX, userAddress))
    const pair = await getPancakePair(BNB.WBNB, BNB.CAKE)
    if (pair) {
      const lpBal = await getERC20Balance(pair, userAddress)
      if (lpBal > 0n) {
        calls.push({ target: pair, allowFailure: true, callData: encodeFunctionData({ abi: QUICKSWAP_LP_ABI, functionName: 'approve', args: [BNB.PANCAKE_ROUTER_V2, lpBal] }) })
        calls.push(encPancakeRemoveLiquidity(BNB.WBNB, BNB.CAKE, lpBal, userAddress))
      }
    }
  }

  return calls
}

// ─── Generalized EVM strategy execution ─────────────────────────────────────

/**
 * Execute any EVM strategy on Polygon, Base, or BNB.
 * @param {string} chain        - 'Polygon' | 'Base' | 'BNB'
 * @param {string} strategyId   - e.g. 'base-stablecoin-vault'
 * @param {bigint} totalUSD6    - total investment in 6-decimal units
 * @param {string} userAddress  - connected wallet address
 * @param {boolean} skipSimulation - skip eth_call simulation check
 */
export async function executeEVMStrategy(chain, strategyId, totalUSD6, userAddress, skipSimulation = false) {
  if (!window.ethereum) throw new Error('No wallet found')

  let calls
  if (chain === 'Base') {
    calls = await buildBaseDepositCalls(strategyId, totalUSD6, userAddress)
  } else if (chain === 'BNB') {
    calls = await buildBNBDepositCalls(strategyId, totalUSD6, userAddress)
  } else {
    calls = await buildDepositCalls(strategyId, totalUSD6, userAddress)
  }

  if (calls.length === 0) throw new Error('No calls for this strategy')

  const tx = buildChainMulticall3Tx(chain, userAddress, calls)

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

/**
 * Execute strategy withdrawal for any EVM chain.
 */
export async function executeEVMWithdrawal(chain, strategyId, userAddress) {
  if (!window.ethereum) throw new Error('No wallet found')

  let calls
  if (chain === 'Base') {
    calls = await buildBaseWithdrawalCalls(strategyId, userAddress)
  } else if (chain === 'BNB') {
    calls = await buildBNBWithdrawalCalls(strategyId, userAddress)
  } else {
    calls = await buildWithdrawalCalls(strategyId, userAddress)
  }

  if (calls.length === 0) throw new Error('No positions found to withdraw')

  const tx = buildChainMulticall3Tx(chain, userAddress, calls)

  const sim = await simulateTx(tx, userAddress)
  if (!sim.ok) {
    const err = new Error(`Withdrawal simulation failed: ${sim.reason}`)
    err.simulation = true
    throw err
  }

  const txHash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [tx] })
  return { txHash }
}
