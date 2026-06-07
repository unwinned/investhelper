import { useState, useEffect, useMemo, useRef } from 'react'
import { ArrowLeftRight, Clock, CheckCircle2, Loader2, Info, AlertCircle, Zap, Wifi, WifiOff, ExternalLink } from 'lucide-react'
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

const ALL_CHAINS = ['TON', 'Polygon', 'Base', 'BNB']

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

const CHAIN_COLOR = {
  TON:     '#0098ea',
  Polygon: '#8247e5',
  Base:    '#2563eb',
  BNB:     '#f59e0b',
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
    const decimals = DECIMALS[token] ?? 6
    return Number(BigInt(res)) / 10 ** decimals
  } catch {
    return null
  }
}

function ConnectionBadge({ status }) {
  if (status === 'connected')
    return <span className="flex items-center gap-1 text-xs text-gain"><Wifi className="w-3 h-3" />Omniston connected</span>
  if (status === 'connecting')
    return <span className="flex items-center gap-1 text-xs text-warn"><Loader2 className="w-3 h-3 animate-spin" />Connecting…</span>
  return <span className="flex items-center gap-1 text-xs text-danger"><WifiOff className="w-3 h-3" />Omniston offline</span>
}

function ChainSelect({ label, value, onChange, exclude }) {
  const color = CHAIN_COLOR[value] ?? '#8b9dc3'
  return (
    <div className="flex-1 rounded-xl p-3 flex flex-col gap-1.5" style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
      <span className="text-xs text-dim">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent font-semibold text-white text-sm outline-none cursor-pointer"
        style={{ color }}
      >
        {ALL_CHAINS.filter(c => c !== exclude).map(c => (
          <option key={c} value={c} style={{ background: '#111827', color: '#e2e8f0' }}>{c}</option>
        ))}
      </select>
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

export default function Bridge({ tonWallet, evmWallet, onOpenWallets }) {
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

  // Reset token when chain changes
  const handleSetFromChain = (c) => {
    setFromChain(c)
    if (c === toChain) setToChain(c === 'TON' ? 'Polygon' : 'TON')
    setToken(SUPPORTED[c]?.[0] ?? 'USDC')
    setAmount('')
    setBalance(null)
  }

  const handleSetToChain = (c) => {
    setToChain(c)
    if (c === fromChain) setFromChain(c === 'TON' ? 'Polygon' : 'TON')
  }

  // Build QuoteRequest
  const quoteRequest = useMemo(() => {
    const parsedAmt = parseFloat(debouncedAmount)
    if (!parsedAmt || parsedAmt <= 0) return null
    const inputAsset  = buildAssetId(fromChain, token)
    const outputAsset = buildAssetId(toChain,   token)
    if (!inputAsset || !outputAsset) return null
    const decimals   = DECIMALS[token] ?? 6
    const inputUnits = BigInt(Math.round(parsedAmt * 10 ** decimals)).toString()
    return { inputAsset, outputAsset, amount: { $case: 'inputUnits', value: inputUnits } }
  }, [fromChain, toChain, token, debouncedAmount])

  const { data: quoteData, isLoading: quoteLoading } = useRfq(quoteRequest, {
    enabled: !!quoteRequest && connectionStatus === 'connected',
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
  const isOffline    = connectionStatus !== 'connected'
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
      <div className="card p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Bridge Asset</h2>
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
                <WifiOff className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-danger font-medium">Bridge unavailable</p>
                  <p className="text-xs text-dim mt-0.5">Omniston WebSocket is offline. Cross-chain routes require a live connection.</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <ChainSelect label="From" value={fromChain} onChange={handleSetFromChain} exclude={toChain} />
              <button
                onClick={swapChains}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
                style={{ background: '#1a2235', border: '1px solid #2a3a55' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#0098ea'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#2a3a55'}
              >
                <ArrowLeftRight className="w-4 h-4 text-dim" />
              </button>
              <ChainSelect label="To" value={toChain} onChange={handleSetToChain} exclude={fromChain} />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-dim block mb-1.5">Asset</label>
                <select value={token} onChange={e => setToken(e.target.value)} className="input-field w-full">
                  {bridgeTokens.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
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
                <p className="text-danger">{bridgeError}</p>
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
            ['TON ↔ Polygon', 'USDC, USDT, TON, WETH, WBTC'],
            ['TON ↔ Base',    'USDC, WETH, ETH, CBETH'],
            ['TON ↔ BNB',     'USDC, USDT, BNB, ETH, BTCB'],
            ['EVM ↔ EVM',     'Via TON relay (Polygon, Base, BNB)'],
          ].map(([route, assets]) => (
            <div key={route} className="card-surface p-2.5">
              <div className="font-medium text-gray-300 mb-1">{route}</div>
              <div className="text-dim">{assets}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
