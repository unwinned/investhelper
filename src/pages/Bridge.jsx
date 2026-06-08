import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ArrowLeftRight, ArrowLeft, Clock, CheckCircle2, Loader2, Info, AlertCircle, Zap, Wifi, WifiOff, ExternalLink, ChevronDown, RefreshCw } from 'lucide-react'
import { useRfq, useConnectionStatus } from '@ston-fi/omniston-sdk-react'
import { useTonConnectUI } from '@tonconnect/ui-react'
import { buildAssetId, DECIMALS, formatUnits, omniston } from '../lib/omniston.js'
import { encodeAbiParameters } from 'viem'
import { CHAIN_ENSURE, CHAIN_EXPLORER } from '../lib/evmUtils.js'

const STEPS = ['Initiating', 'Building tx', 'Signing & sending', 'Cross-chain relay', 'Complete']

const SUPPORTED = {
  TON:     ['TON', 'USDC', 'USDT', 'WETH', 'WBTC'],
  Polygon: ['MATIC', 'USDC', 'USDT', 'WETH', 'WBTC'],
  Base:    ['ETH', 'USDC', 'WETH', 'CBETH', 'CBBTC'],
  BNB:     ['BNB', 'USDC', 'USDT', 'ETH', 'BTCB'],
}

const ALL_CHAINS  = ['TON', 'Polygon', 'Base', 'BNB']
const EVM_CHAINS  = ['Polygon', 'Base', 'BNB']

// Omniston chain case name per chain
const OMNISTON_CHAIN_CASE = {
  TON:     'ton',
  Polygon: 'polygon',
  Base:    'base',
  BNB:     'bnb',
}

// Token contract addresses for EVM balance lookups
const EVM_TOKENS = {
  Polygon: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    WBTC: '0x1BFD67037B42Cf73acf2047067bd4F2C47D9BfD6',
  },
  Base: {
    USDC:  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    WETH:  '0x4200000000000000000000000000000000000006',
    CBETH: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    CBBTC: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
  },
  BNB: {
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    ETH:  '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    BTCB: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
  },
}

// TON jetton master addresses
const TON_JETTONS = {
  USDC: 'EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA',
  USDT: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
  WETH: 'EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmgikjxd6',
  WBTC: 'EQDcBkGHmC4pTf34x3Gm05XvepO5w60e9je5SQkLaL_yVEXk',
}

const NATIVE_TOKENS = { TON: 'TON', Polygon: 'MATIC', Base: 'ETH', BNB: 'BNB' }

// BNB chain pegged stablecoins use 18 decimals, not 6
const EVM_DECIMALS = {
  BNB: { USDC: 18, USDT: 18 },
}
function evmDecimals(chain, symbol) {
  return EVM_DECIMALS[chain]?.[symbol] ?? DECIMALS[symbol] ?? 18
}

const CHAIN_COLOR = {
  TON:     '#0098ea',
  Polygon: '#8247e5',
  Base:    '#2563eb',
  BNB:     '#f59e0b',
}

// Per-token accent color + display name
const TOKEN_META = {
  TON:   { color: '#0098ea', name: 'Toncoin'         },
  USDC:  { color: '#2775ca', name: 'USD Coin'         },
  USDT:  { color: '#26a17b', name: 'Tether USD'       },
  WETH:  { color: '#627eea', name: 'Wrapped ETH'      },
  ETH:   { color: '#627eea', name: 'Ether'            },
  WBTC:  { color: '#f7931a', name: 'Wrapped BTC'      },
  BTCB:  { color: '#f7931a', name: 'BTC (BNB)'        },
  CBBTC: { color: '#f7931a', name: 'Coinbase BTC'     },
  MATIC: { color: '#8247e5', name: 'Polygon'          },
  BNB:   { color: '#f59e0b', name: 'BNB'              },
  CBETH: { color: '#4ade80', name: 'Coinbase ETH'     },
}

async function fetchTonBalance(address, token) {
  try {
    if (token === 'TON') {
      const r = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(6000) })
      const d = await r.json()
      return d.balance ? Number(BigInt(d.balance)) / 1e9 : null
    }
    const jetton = TON_JETTONS[token]
    if (!jetton) return null
    const r = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/jettons/${encodeURIComponent(jetton)}`, { signal: AbortSignal.timeout(6000) })
    const d = await r.json()
    const bal = d.balance ?? d.jetton_balance ?? null
    if (bal == null) return null
    const decimals = DECIMALS[token] ?? 6
    return Number(BigInt(bal)) / 10 ** decimals
  } catch {
    return null
  }
}

async function fetchEVMBalance(chain, address, token) {
  try {
    if (!window.ethereum) return null
    const ensureFn = CHAIN_ENSURE[chain]
    if (ensureFn) await ensureFn()
    const nativeToken = NATIVE_TOKENS[chain]
    if (token === nativeToken) {
      const hex = await window.ethereum.request({ method: 'eth_getBalance', params: [address, 'latest'] })
      return Number(BigInt(hex)) / 1e18
    }
    const tokenAddr = EVM_TOKENS[chain]?.[token]
    if (!tokenAddr) return null
    const data = '0x70a08231' + address.slice(2).padStart(64, '0')
    const res = await window.ethereum.request({ method: 'eth_call', params: [{ to: tokenAddr, data }, 'latest'] })
    const decimals = evmDecimals(chain, token)
    return Number(BigInt(res)) / 10 ** decimals
  } catch {
    return null
  }
}

// Styled token picker — replaces the ugly native <select>
function TokenPicker({ value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const ref             = useRef(null)
  const meta            = TOKEN_META[value] ?? { color: '#8b9dc3', name: value }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: `${meta.color}12`,
          border: `1px solid ${open ? meta.color + '80' : meta.color + '35'}`,
          color: meta.color,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold"
            style={{ background: meta.color, fontSize: '8px' }}
          >
            {value.slice(0, 2)}
          </span>
          <span>{value}</span>
          <span className="text-xs font-normal" style={{ color: meta.color + 'aa' }}>{meta.name}</span>
        </div>
        <ChevronDown
          className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none', color: meta.color + '99' }}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-xl overflow-hidden"
          style={{ background: '#0d1929', border: '1px solid #1e2d45', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}
        >
          {options.map(sym => {
            const m       = TOKEN_META[sym] ?? { color: '#8b9dc3', name: sym }
            const isActive = sym === value
            return (
              <button
                key={sym}
                type="button"
                onClick={() => { onChange(sym); setOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-all"
                style={{
                  background: isActive ? `${m.color}18` : 'transparent',
                  borderLeft: isActive ? `2px solid ${m.color}` : '2px solid transparent',
                  color: isActive ? m.color : '#e2e8f0',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = `${m.color}0d` }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <span
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold"
                  style={{ background: m.color, fontSize: '8px' }}
                >
                  {sym.slice(0, 2)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold leading-none" style={{ color: isActive ? m.color : '#e2e8f0' }}>{sym}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#4a5e7a' }}>{m.name}</div>
                </div>
                {isActive && <span className="text-xs font-medium" style={{ color: m.color }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ConnectionBadge({ status }) {
  if (status === 'connected')
    return <span className="flex items-center gap-1 text-xs" style={{ color: '#00d4aa' }}><Wifi className="w-3 h-3" />Live</span>
  if (status === 'connecting' || status === 'ready')
    return <span className="flex items-center gap-1 text-xs" style={{ color: '#f59e0b' }}><Loader2 className="w-3 h-3 animate-spin" />Connecting…</span>
  return <span className="flex items-center gap-1 text-xs" style={{ color: '#ef4444' }}><WifiOff className="w-3 h-3" />Offline</span>
}

function ChainSelect({ label, value, onChange, options }) {
  const color = CHAIN_COLOR[value] ?? '#8b9dc3'
  const isLocked = options.length === 1
  return (
    <div className="flex-1 rounded-xl p-3 flex flex-col gap-1.5" style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
      <span className="text-xs text-dim">{label}</span>
      {isLocked ? (
        <span className="font-semibold text-sm" style={{ color }}>{value}</span>
      ) : (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-transparent font-semibold text-white text-sm outline-none cursor-pointer"
          style={{ color }}
        >
          {options.map(c => (
            <option key={c} value={c} style={{ background: '#111827', color: '#e2e8f0' }}>{c}</option>
          ))}
        </select>
      )}
      <span className="text-xs text-dim">{value === 'TON' ? 'TON Connect 2.0' : 'MetaMask'}</span>
    </div>
  )
}

function QuotePanel({ quoteData, quoteLoading, token, fromChain, toChain, inputAmount }) {
  const outDecimals = DECIMALS[token] ?? 6
  const parsedAmt   = parseFloat(inputAmount) || 0

  if (!inputAmount || parsedAmt <= 0) return null

  if (quoteLoading || quoteData?.$case === 'ack') {
    return (
      <div className="card-surface p-3 flex items-center gap-2 text-sm text-dim">
        <Loader2 className="w-4 h-4 animate-spin text-ton" />
        Getting Omniston quote…
      </div>
    )
  }

  if (quoteData?.$case === 'noQuote' || !quoteData) {
    return (
      <div className="card-surface p-3 space-y-2 text-sm">
        <div className="flex items-center gap-1.5 text-danger text-xs mb-1">
          <AlertCircle className="w-3.5 h-3.5" />
          No resolver for {fromChain} → {toChain} {token} — bridge unavailable for this pair
        </div>
      </div>
    )
  }

  if (quoteData.$case === 'quoteUpdated') {
    const quote     = quoteData.value
    const outputAmt = parseFloat(formatUnits(quote.outputUnits, outDecimals))
    const rate      = parsedAmt > 0 ? ((outputAmt / parsedAmt) * 100).toFixed(3) : '—'
    return (
      <div className="card-surface p-3 space-y-2 text-sm">
        <div className="flex items-center gap-1.5 text-gain text-xs mb-1">
          <Zap className="w-3.5 h-3.5" />
          Live Omniston quote
        </div>
        <div className="flex justify-between font-semibold">
          <span className="text-dim">You receive</span>
          <span className="mono text-gain">{outputAmt.toFixed(6)} {token}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-dim">Rate</span>
          <span className="mono text-gray-300">{rate}%</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-dim">Settlement</span>
          <span className="text-gray-400 capitalize">{quote.settlementData?.$case ?? 'swap'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-dim">Route</span>
          <span className="text-gray-400">Omniston · {fromChain} → {toChain}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-dim">Non-custodial</span>
          <span className="text-gain">Yes</span>
        </div>
      </div>
    )
  }

  return null
}

export default function Bridge({ tonWallet, evmWallet, onOpenWallets, onBack }) {
  const connectionStatus = useConnectionStatus()
  const [tonConnectUI] = useTonConnectUI()

  const [fromChain,       setFromChain]       = useState('TON')
  const [toChain,         setToChain]         = useState('Polygon')
  const [token,           setToken]           = useState('USDC')
  const [amount,          setAmount]          = useState('')
  const [debouncedAmount, setDebouncedAmount] = useState('')
  const [step,            setStep]            = useState(null)
  const [bridgeError,     setBridgeError]     = useState(null)
  const [balance,         setBalance]         = useState(null)
  const [balanceLoading,  setBalanceLoading]  = useState(false)
  const [explorerLink,    setExplorerLink]    = useState(null)

  const isFromTON = fromChain === 'TON'
  const sourceWallet = isFromTON ? tonWallet : evmWallet
  const destWallet   = isFromTON ? evmWallet : tonWallet

  // Eagerly open the Omniston WebSocket so connectionStatus reaches 'connected'
  // before the user types — avoids the 'ready' → never-connects deadlock.
  useEffect(() => {
    omniston.transport.connect()
  }, [])

  // Debounce amount
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(amount), 700)
    return () => clearTimeout(t)
  }, [amount])

  // Fetch balance when source wallet/token changes
  useEffect(() => {
    if (!sourceWallet?.connected || !sourceWallet.address) { setBalance(null); return }
    let cancelled = false
    setBalanceLoading(true)
    const fetcher = isFromTON ? fetchTonBalance : (addr, tok) => fetchEVMBalance(fromChain, addr, tok)
    fetcher(sourceWallet.address, token).then(b => {
      if (!cancelled) { setBalance(b); setBalanceLoading(false) }
    })
    return () => { cancelled = true }
  }, [fromChain, token, sourceWallet?.address, sourceWallet?.connected, isFromTON])

  // Omniston only supports TON ↔ EVM — enforce one side is always TON
  const handleSetFromChain = (c) => {
    setFromChain(c)
    if (c !== 'TON') setToChain('TON')
    else if (toChain === 'TON') setToChain('Polygon')
    setToken(SUPPORTED[c]?.[0] ?? 'USDC')
    setAmount('')
    setBalance(null)
  }

  const handleSetToChain = (c) => {
    setToChain(c)
    if (c !== 'TON') {
      setFromChain('TON')
      setToken(SUPPORTED['TON']?.[0] ?? 'USDC')
      setAmount('')
      setBalance(null)
    }
  }

  // Build QuoteRequest — must include settlementParams (required by SDK v0.8.x)
  const quoteRequest = useMemo(() => {
    const parsedAmt = parseFloat(debouncedAmount)
    if (!parsedAmt || parsedAmt <= 0) return null
    const inputAsset  = buildAssetId(fromChain, token)
    const outputAsset = buildAssetId(toChain,   token)
    if (!inputAsset || !outputAsset) return null
    const decimals   = isFromTON ? (DECIMALS[token] ?? 9) : evmDecimals(fromChain, token)
    const inputUnits = BigInt(Math.round(parsedAmt * 10 ** decimals)).toString()
    return {
      inputAsset,
      outputAsset,
      amount: { $case: 'inputUnits', value: inputUnits },
      // Allow both settlement types so resolvers can pick the best route:
      // swap = TON-only atomic swap, order = cross-chain HTLC escrow
      settlementParams: [
        { params: { $case: 'swap',  value: {} } },
        { params: { $case: 'order', value: {} } },
      ],
    }
  }, [fromChain, toChain, token, debouncedAmount])

  // Do NOT gate on connectionStatus === 'connected' — the SDK auto-connects
  // when requestForQuote is called; gating on 'connected' first creates a deadlock.
  const { data: quoteData, isLoading: quoteLoading } = useRfq(quoteRequest, {
    enabled: !!quoteRequest && connectionStatus !== 'error' && connectionStatus !== 'closed',
  })

  const swapChains = () => {
    const oldFrom = fromChain
    const oldTo   = toChain
    setFromChain(oldTo)
    setToChain(oldFrom)
    setToken(SUPPORTED[oldTo]?.[0] ?? 'USDC')
    setAmount('')
    setBalance(null)
    setBridgeError(null)
  }

  const parsedAmount = parseFloat(amount) || 0
  // 'ready' = not yet connected but will connect when RFQ fires — not truly offline
  const isOffline    = connectionStatus === 'error' || connectionStatus === 'closed'
  const isConnecting = connectionStatus === 'ready' || connectionStatus === 'connecting'
  const hasQuote     = quoteData?.$case === 'quoteUpdated'
  const insufficientBalance = balance !== null && parsedAmount > 0 && parsedAmount > balance
  const canBridge = !isOffline && hasQuote && parsedAmount > 0 && sourceWallet?.connected && !insufficientBalance

  const startBridge = async () => {
    if (!canBridge) return
    setBridgeError(null)
    setExplorerLink(null)
    setStep(1)

    try {
      const rfqId = quoteData.rfqId

      if (isFromTON) {
        if (!tonConnectUI) throw new Error('TON wallet not available')

        const srcAddr = { chain: { $case: 'ton', value: tonWallet.address } }
        const destChainCase = OMNISTON_CHAIN_CASE[toChain]
        const dstAddr = evmWallet?.connected && destChainCase
          ? { chain: { $case: destChainCase, value: evmWallet.address } }
          : undefined

        const settlementCase = quoteData.value?.settlementData?.$case
        setStep(2)

        let tonTx
        if (settlementCase === 'swap') {
          tonTx = await omniston.tonBuildSwap({
            quoteId: rfqId,
            transferSrcAddress: srcAddr,
            traderDstAddress:   dstAddr,
          })
        } else {
          tonTx = await omniston.tonBuildEscrowTransfer({
            quoteId:          rfqId,
            ownerSrcAddress:  srcAddr,
            traderDstAddress: dstAddr,
          })
        }

        setStep(3)

        const messages = tonTx.messages.map(m => ({
          address: m.targetAddress,
          amount:  m.sendAmount,
          ...(m.payload               ? { payload:   m.payload }               : {}),
          ...(m.jettonWalletStateInit ? { stateInit: m.jettonWalletStateInit } : {}),
        }))

        const result = await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 300,
          messages,
        })

        if (result?.boc) {
          setExplorerLink(`https://tonviewer.com/?search=${encodeURIComponent(result.boc)}`)
        }
        setStep(4)

      } else {
        // EVM source (Polygon / Base / BNB) → TON
        if (!window.ethereum) throw new Error('MetaMask not available')

        const ensureFn = CHAIN_ENSURE[fromChain]
        if (ensureFn) await ensureFn()

        const srcChainCase = OMNISTON_CHAIN_CASE[fromChain]
        const dstChainCase = OMNISTON_CHAIN_CASE[toChain]

        const srcAddr = { chain: { $case: srcChainCase, value: evmWallet.address } }
        const dstAddr = tonWallet?.connected && dstChainCase
          ? { chain: { $case: dstChainCase, value: tonWallet.address } }
          : undefined

        setStep(2)

        const payload = await omniston.evmBuildOrderPayload({
          quoteId:          rfqId,
          ownerSrcAddress:  srcAddr,
          traderDstAddress: dstAddr,
        })

        setStep(3)

        const signature = await window.ethereum.request({
          method: 'eth_signTypedData_v4',
          params: [evmWallet.address, payload.typedData],
        })

        const typedDataObj = JSON.parse(payload.typedData)
        const fieldDefs    = typedDataObj.types[typedDataObj.primaryType]
        const abiParams    = fieldDefs.map(f => ({ name: f.name, type: f.type }))
        const values       = fieldDefs.map(({ name, type }) => {
          const v = typedDataObj.message[name]
          if (type.startsWith('uint') || type.startsWith('int')) return BigInt(v)
          return v
        })
        const encodedHex  = encodeAbiParameters(abiParams, values)
        const encodedOrder = Uint8Array.from(Buffer.from(encodedHex.slice(2), 'hex'))
        const sigBytes     = Uint8Array.from(Buffer.from(signature.slice(2), 'hex'))

        await omniston.orderRegisterSignedOrder({
          quoteId:          rfqId,
          ownerSrcAddress:  srcAddr,
          signedOrder: {
            order: {
              $case: 'evmV1',
              value: {
                encodedOrder,
                signature:      sigBytes,
                orderExtension: payload.orderExtension,
              },
            },
          },
          serializedOrderDetails: payload.serializedOrderDetails,
        })

        const explorer = CHAIN_EXPLORER[fromChain]
        setExplorerLink(explorer ? `${explorer}/address/${evmWallet.address}` : null)
        setStep(4)
      }
    } catch (err) {
      const msg = err?.message || String(err)
      if (!msg.includes('User rejected') && !msg.includes('user rejected')) {
        setBridgeError(msg)
      }
      setStep(null)
    }
  }

  const reset = () => {
    setStep(null)
    setAmount('')
    setDebouncedAmount('')
    setBridgeError(null)
    setExplorerLink(null)
  }

  const bridgeTokens = SUPPORTED[fromChain] || []

  return (
    <div className="max-w-xl mx-auto space-y-4">
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
      <div className="card p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Cross-chain Swap</h2>
          <div className="flex items-center gap-3">
            <ConnectionBadge status={connectionStatus} />
            <span className="flex items-center gap-1 text-xs text-dim">
              <Clock className="w-3.5 h-3.5" />~2 min
            </span>
          </div>
        </div>

        {step === null ? (
          <>
            {isOffline && (
              <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <WifiOff className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <div>
                  <p className="font-medium" style={{ color: '#ef4444' }}>Bridge unavailable</p>
                  <p className="text-xs mt-0.5" style={{ color: '#4a5e7a' }}>Omniston WebSocket is unreachable. Try refreshing.</p>
                </div>
              </div>
            )}
            {isConnecting && !isOffline && (
              <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: '#f59e0b' }} />
                <p className="text-xs" style={{ color: '#f59e0b' }}>Connecting to Omniston resolver network… quotes will appear shortly</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <ChainSelect label="From" value={fromChain} onChange={handleSetFromChain} options={ALL_CHAINS} />
              <button
                onClick={swapChains}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
                style={{ background: '#1a2235', border: '1px solid #2a3a55' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#0098ea'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#2a3a55'}
              >
                <ArrowLeftRight className="w-4 h-4 text-dim" />
              </button>
              <ChainSelect
                label="To"
                value={toChain}
                onChange={handleSetToChain}
                options={isFromTON ? EVM_CHAINS : ['TON']}
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-dim block mb-1.5">Asset</label>
                <TokenPicker value={token} options={bridgeTokens} onChange={setToken} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-dim">Amount</label>
                  {sourceWallet?.connected && (
                    <span className="text-xs text-dim">
                      {balanceLoading ? (
                        <span className="flex items-center gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" />Loading…</span>
                      ) : balance !== null ? (
                        <button
                          onClick={() => setAmount(balance.toFixed(6))}
                          className="hover:text-white transition-colors"
                        >
                          Balance: {balance.toFixed(4)} {token}
                        </button>
                      ) : null}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="input-field w-full mono text-lg"
                  style={insufficientBalance ? { borderColor: 'rgba(239,68,68,0.5)' } : {}}
                />
                {insufficientBalance && !isOffline && (
                  <p className="text-xs text-danger mt-1">
                    Insufficient balance — you have {balance.toFixed(4)} {token}
                  </p>
                )}
              </div>
            </div>

            {!isOffline && (
              <QuotePanel
                quoteData={quoteData}
                quoteLoading={quoteLoading}
                token={token}
                fromChain={fromChain}
                toChain={toChain}
                inputAmount={debouncedAmount}
              />
            )}

            {bridgeError && (
              <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="w-3.5 h-3.5 text-danger flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-danger">
                    {/Object not found.*quote/i.test(bridgeError)
                      ? 'Quote expired — a fresh quote is loading automatically. Try again in a moment.'
                      : bridgeError}
                  </p>
                  {/Object not found.*quote/i.test(bridgeError) && (
                    <button
                      onClick={() => { setBridgeError(null); setDebouncedAmount(''); setTimeout(() => setDebouncedAmount(amount), 50) }}
                      className="mt-1.5 flex items-center gap-1 font-medium transition-colors"
                      style={{ color: '#0098ea' }}
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh quote
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-1.5 text-xs text-dim">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <p>Quotes sourced live from Omniston. Funds are locked in the source vault and released on destination — non-custodial.</p>
            </div>

            {!sourceWallet?.connected ? (
              <button onClick={onOpenWallets} className="btn-primary w-full text-center">
                Connect {fromChain} Wallet to Bridge
              </button>
            ) : (
              <button
                onClick={startBridge}
                disabled={!canBridge}
                className="btn-primary w-full text-center disabled:opacity-40 disabled:cursor-not-allowed"
                title={
                  isOffline           ? 'Omniston is offline' :
                  !hasQuote           ? 'No route available for this pair' :
                  insufficientBalance ? 'Insufficient balance' :
                  !parsedAmount       ? 'Enter an amount' : undefined
                }
              >
                {isOffline ? 'Bridge Unavailable (Offline)' :
                 !hasQuote && quoteData?.$case === 'noQuote' ? 'No Route Available' :
                 `Bridge ${token} → ${toChain}`}
              </button>
            )}
          </>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              {step < 4
                ? <Loader2 className="w-10 h-10 text-ton animate-spin mx-auto mb-3" />
                : <CheckCircle2 className="w-10 h-10 text-gain mx-auto mb-3" />}
              <p className="font-semibold text-white">
                {step < 4 ? 'Bridging via Omniston…' : 'Transaction submitted'}
              </p>
              {step < 4 && <p className="text-xs text-dim mt-1">Do not close this window</p>}
              {step >= 4 && (
                <p className="text-xs text-dim mt-1">
                  Awaiting cross-chain confirmation (~2 min). Track via explorer.
                </p>
              )}
            </div>

            <div className="space-y-2">
              {STEPS.map((s, i) => {
                const done    = i < step - 1
                const current = i === step - 1
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                      style={{
                        background:   done ? '#00d4aa' : current ? '#0098ea' : '#1a2235',
                        border: `1px solid ${done ? '#00d4aa' : current ? '#0098ea' : '#2a3a55'}`,
                      }}
                    >
                      {done ? '✓' : current ? <Loader2 className="w-3 h-3 animate-spin" /> : i + 1}
                    </div>
                    <span className="text-sm" style={{ color: done ? '#00d4aa' : current ? '#e2e8f0' : '#4a5e7a' }}>{s}</span>
                  </div>
                )
              })}
            </div>

            {explorerLink && step >= 4 && (
              <a
                href={explorerLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm transition-all"
                style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', color: '#00d4aa' }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Track transaction
              </a>
            )}

            {step >= 4 && (
              <button onClick={reset} className="btn-outline w-full text-center">Bridge another asset</button>
            )}
          </div>
        )}
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-gain" /> Omniston-supported routes
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            ['TON → Polygon', 'USDC, USDT, WETH, WBTC'],
            ['TON → Base',    'USDC, WETH, CBETH, CBBTC'],
            ['TON → BNB',     'USDC, USDT, ETH, BTCB'],
            ['EVM → TON',     'Any above pair in reverse'],
          ].map(([route, assets]) => (
            <div key={route} className="card-surface p-2.5">
              <div className="font-medium text-gray-300 mb-1">{route}</div>
              <div className="text-dim">{assets}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-dim mt-2.5">Omniston routes assets through TON liquidity pools — one side must always be TON.</p>
      </div>
    </div>
  )
}
