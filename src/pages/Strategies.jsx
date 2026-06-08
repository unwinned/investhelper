import { useState, useCallback, useMemo, useEffect } from 'react'
import { useTonConnectUI } from '@tonconnect/ui-react'
import { CheckCircle2, AlertTriangle, X, Zap, Shield, TrendingUp, Flame, Loader2, ExternalLink, ArrowDownCircle, RefreshCw, ArrowLeft, ArrowRight, Wifi, WifiOff, Clock } from 'lucide-react'
import { useRfq, useConnectionStatus } from '@ston-fi/omniston-sdk-react'
import { TON_STRATEGIES, POLYGON_STRATEGIES, BASE_STRATEGIES, BNB_STRATEGIES } from '../data.js'
import { buildTonStrategyTx, buildVaultWithdraw } from '../lib/tonSigning.js'
import { checkStrategyApprovals, approveERC20, executePolygonStrategy, executeEVMStrategy, executeEVMWithdrawal, executeVaultDeposit, executeVaultWithdraw, IH_VAULT_ABI } from '../lib/evmSigning.js'
import { CHAIN_ENSURE, CHAIN_EXPLORER, waitForReceipt } from '../lib/evmUtils.js'
import { POLYGON, BASE, BNB, TON } from '../lib/contracts.js'
import { checkEVMBalances, fmtUSD } from '../lib/balances.js'
import { omniston, buildAssetId, DECIMALS, formatUnits } from '../lib/omniston.js'
import { toNano } from '@ton/core'
import { encodeAbiParameters } from 'viem'

const TIER_META = {
  'Super Safe':  { icon: Shield,     pillClass: 'pill-green'  },
  'Safe':        { icon: TrendingUp, pillClass: 'pill-blue'   },
  'Middle':      { icon: Zap,        pillClass: 'pill-orange' },
  'Alpha Seeker':{ icon: Flame,      pillClass: 'pill-red'    },
}

const CHAIN_TABS = [
  { id: 'TON',     label: 'TON Network', color: '#0098ea', bg: 'rgba(0,152,234,0.2)'    },
  { id: 'Polygon', label: 'Polygon',      color: '#8247e5', bg: 'rgba(130,71,229,0.2)'  },
  { id: 'Base',    label: 'Base',         color: '#2563eb', bg: 'rgba(37,99,235,0.2)'   },
  { id: 'BNB',     label: 'BNB Chain',    color: '#f59e0b', bg: 'rgba(245,158,11,0.2)'  },
]

const CHAIN_NATIVE_LABEL = { Polygon: 'MATIC', Base: 'ETH', BNB: 'BNB' }

const CHAIN_DESCS = {
  TON:     'Strategies use on-chain contracts: STON.fi v2.1 router · DeDust factory · Tonstakers/Bemo/Hipo pools · Evaa lending. One TON Connect signature per activation.',
  Polygon: 'Strategies use AAVE v3 · QuickSwap v2 · Balancer. EVM strategies are coming soon — vault contracts are being deployed.',
  Base:    'Strategies use AAVE v3 on Base · Aerodrome router. EVM strategies are coming soon — vault contracts are being deployed.',
  BNB:     'Strategies use AAVE v3 on BNB Chain · PancakeSwap v2. EVM strategies are coming soon — vault contracts are being deployed.',
}

// Omniston chain identifiers (match Bridge.jsx)
const OMNISTON_CHAIN_CASE = { TON: 'ton', Polygon: 'polygon', Base: 'base', BNB: 'bnb' }

// Tokens available for bridging from each EVM chain into TON
const EVM_BRIDGE_TOKENS = {
  Polygon: ['USDC', 'USDT', 'WETH', 'MATIC'],
  Base:    ['USDC', 'WETH', 'ETH'],
  BNB:     ['USDC', 'USDT', 'BNB'],
}

// Tokens available to receive on EVM when exiting a TON position
const EVM_EXIT_TOKENS = {
  Polygon: ['USDC', 'USDT', 'WETH'],
  Base:    ['USDC', 'WETH'],
  BNB:     ['USDC', 'USDT'],
}

const EVM_CHAINS = ['Polygon', 'Base', 'BNB']

const CHAIN_COLOR = {
  TON: '#0098ea', Polygon: '#8247e5', Base: '#2563eb', BNB: '#f59e0b',
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function OmnistonBadge({ status }) {
  if (status === 'connected')
    return <span className="flex items-center gap-1 text-xs" style={{ color: '#00d4aa' }}><Wifi className="w-3 h-3" />Live quotes</span>
  if (status === 'connecting' || status === 'ready')
    return <span className="flex items-center gap-1 text-xs" style={{ color: '#f59e0b' }}><Loader2 className="w-3 h-3 animate-spin" />Connecting…</span>
  return <span className="flex items-center gap-1 text-xs" style={{ color: '#ef4444' }}><WifiOff className="w-3 h-3" />Offline</span>
}

function RiskDots({ score }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4].map(n => (
        <span key={n} className="w-2.5 h-2.5 rounded-full" style={{
          background: n <= score
            ? score === 1 ? '#00d4aa' : score === 2 ? '#0098ea' : score === 3 ? '#f97316' : '#ef4444'
            : '#1e2d45',
        }} />
      ))}
    </div>
  )
}

function AllocationBar({ allocation }) {
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {allocation.map(a => (
          <div key={a.label} style={{ width: `${a.pct}%`, background: a.color }} />
        ))}
      </div>
      <div className="space-y-1">
        {allocation.map(a => (
          <div key={a.label} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: a.color }} />
              <span className="text-xs text-dim">{a.label}</span>
            </div>
            <span className="text-xs mono text-gray-400">{a.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Bridge & Enter Modal ─────────────────────────────────────────────────────
// Idea 1: Enter a TON strategy by bridging from an EVM chain via Omniston.
// Flow: pick EVM source → get live quote → sign EVM order → deposit into vault.

function BridgeAndEnterModal({ strategy, evmWallet, tonWallet, onClose, onActivate }) {
  const [tonConnectUI]      = useTonConnectUI()
  const connectionStatus    = useConnectionStatus()

  const [fromChain,         setFromChain]         = useState('Polygon')
  const [token,             setToken]             = useState('USDC')
  const [amount,            setAmount]            = useState('')
  const [debouncedAmount,   setDebouncedAmount]   = useState('')
  // quote | bridging | bridge_done | depositing | done | error
  const [step,              setStep]              = useState('quote')
  const [error,             setError]             = useState(null)
  // TON nanotons estimated from quote — used to pre-fill vault deposit
  const [estimatedNano,     setEstimatedNano]     = useState(null)
  const [depositAmount,     setDepositAmount]     = useState('5')

  useEffect(() => { omniston.transport.connect() }, [])

  // Debounce amount input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(amount), 700)
    return () => clearTimeout(t)
  }, [amount])

  // When chain changes, reset token
  const handleChainChange = useCallback((c) => {
    setFromChain(c)
    setToken(EVM_BRIDGE_TOKENS[c]?.[0] ?? 'USDC')
    setAmount('')
  }, [])

  // Build Omniston quote request: EVM token → native TON
  const quoteRequest = useMemo(() => {
    const parsed = parseFloat(debouncedAmount)
    if (!parsed || parsed <= 0) return null
    const inputAsset  = buildAssetId(fromChain, token)
    const outputAsset = buildAssetId('TON', 'TON')
    if (!inputAsset || !outputAsset) return null
    const dec        = DECIMALS[token] ?? 6
    const inputUnits = BigInt(Math.round(parsed * 10 ** dec)).toString()
    return {
      inputAsset,
      outputAsset,
      amount: { $case: 'inputUnits', value: inputUnits },
      settlementParams: [
        { params: { $case: 'swap',  value: {} } },
        { params: { $case: 'order', value: {} } },
      ],
    }
  }, [fromChain, token, debouncedAmount])

  const isOffline = connectionStatus === 'error' || connectionStatus === 'closed'

  const { data: quoteData, isLoading: quoteLoading } = useRfq(quoteRequest, {
    enabled: !!quoteRequest && !isOffline,
  })

  const hasQuote    = quoteData?.$case === 'quoteUpdated'
  const tonOutNano  = hasQuote ? BigInt(quoteData.value.outputUnits) : null
  const tonOutHuman = tonOutNano != null ? (Number(tonOutNano) / 1e9).toFixed(4) : null

  // Step 1: Execute EVM→TON bridge via Omniston
  const executeBridge = useCallback(async () => {
    if (!hasQuote || !evmWallet?.connected) return
    setStep('bridging')
    setError(null)
    try {
      await CHAIN_ENSURE[fromChain]?.()

      const rfqId        = quoteData.rfqId
      const srcChainCase = OMNISTON_CHAIN_CASE[fromChain]
      const srcAddr      = { chain: { $case: srcChainCase, value: evmWallet.address } }
      const dstAddr      = tonWallet?.connected
        ? { chain: { $case: 'ton', value: tonWallet.address } }
        : undefined

      const payload = await omniston.evmBuildOrderPayload({
        quoteId:          rfqId,
        ownerSrcAddress:  srcAddr,
        traderDstAddress: dstAddr,
      })

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
      const encodedHex   = encodeAbiParameters(abiParams, values)
      const encodedOrder = Uint8Array.from(Buffer.from(encodedHex.slice(2), 'hex'))
      const sigBytes     = Uint8Array.from(Buffer.from(signature.slice(2), 'hex'))

      await omniston.orderRegisterSignedOrder({
        quoteId:         rfqId,
        ownerSrcAddress: srcAddr,
        signedOrder: {
          order: {
            $case: 'evmV1',
            value: { encodedOrder, signature: sigBytes, orderExtension: payload.orderExtension },
          },
        },
        serializedOrderDetails: payload.serializedOrderDetails,
      })

      // Pre-fill vault deposit with estimated TON out
      if (tonOutNano != null) {
        setEstimatedNano(tonOutNano)
        setDepositAmount((Number(tonOutNano) / 1e9).toFixed(2))
      }
      setStep('bridge_done')
    } catch (e) {
      const msg = e?.message || String(e)
      if (!msg.toLowerCase().includes('user rejected')) setError(msg)
      setStep('quote')
    }
  }, [hasQuote, quoteData, evmWallet, tonWallet, fromChain, tonOutNano])

  // Step 2: Deposit into TON vault
  const executeDeposit = useCallback(async () => {
    if (!tonWallet?.connected) return
    setStep('depositing')
    setError(null)
    try {
      const nano = toNano(depositAmount || '1')
      const tx   = await buildTonStrategyTx(strategy.id, nano, tonWallet.address)
      await tonConnectUI.sendTransaction(tx)
      setStep('done')
      setTimeout(() => { onActivate(strategy.id); onClose() }, 1200)
    } catch (e) {
      setError(e?.message ?? 'Transaction rejected')
      setStep('error')
    }
  }, [depositAmount, strategy.id, tonWallet, tonConnectUI, onActivate, onClose])

  const bridgeTokens = EVM_BRIDGE_TOKENS[fromChain] ?? []
  const parsedAmt    = parseFloat(amount) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-y-auto" style={{ background: '#111827', border: '1px solid #1e293b', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#1e293b' }}>
          <div>
            <h2 className="font-semibold text-white">Bridge &amp; Enter</h2>
            <p className="text-xs mt-0.5" style={{ color: '#0098ea' }}>{strategy.name} · via Omniston</p>
          </div>
          <div className="flex items-center gap-3">
            <OmnistonBadge status={connectionStatus} />
            {step !== 'bridging' && step !== 'depositing' && (
              <button onClick={onClose} className="text-dim hover:text-white"><X className="w-4 h-4" /></button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* Step indicator */}
          {step !== 'done' && (
            <div className="flex items-center gap-2 text-xs">
              {['Bridge from EVM', 'Deposit into vault'].map((label, i) => {
                const active  = i === 0 ? ['quote','bridging','bridge_done'].includes(step) : ['depositing'].includes(step)
                const done    = i === 0 ? step === 'bridge_done' || step === 'depositing' || step === 'done' : step === 'done'
                return (
                  <div key={label} className="flex items-center gap-1.5">
                    {i > 0 && <ArrowRight className="w-3 h-3 text-dim" />}
                    <span style={{ color: done ? '#00d4aa' : active ? '#e2e8f0' : '#4a5e7a' }}>
                      {done ? '✓ ' : ''}{label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Quote step ── */}
          {step === 'quote' && (
            <>
              {/* Chain + token row */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-dim block mb-1.5">From chain</label>
                  <select
                    value={fromChain}
                    onChange={e => handleChainChange(e.target.value)}
                    className="input-field w-full text-sm"
                    style={{ color: CHAIN_COLOR[fromChain] }}
                  >
                    {EVM_CHAINS.map(c => (
                      <option key={c} value={c} style={{ background: '#111827', color: CHAIN_COLOR[c] }}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-dim block mb-1.5">Token</label>
                  <select
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    className="input-field w-full text-sm"
                  >
                    {bridgeTokens.map(t => (
                      <option key={t} value={t} style={{ background: '#111827' }}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-dim block mb-1.5">Amount ({token})</label>
                <input
                  type="number" min="0" step="any"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="input-field w-full mono text-lg"
                  placeholder="0.00"
                />
              </div>

              {/* Live quote */}
              {parsedAmt > 0 && (
                <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'rgba(0,152,234,0.06)', border: '1px solid rgba(0,152,234,0.2)' }}>
                  {quoteLoading || quoteData?.$case === 'ack' ? (
                    <div className="flex items-center gap-2 text-sm text-dim">
                      <Loader2 className="w-4 h-4 animate-spin text-ton" />
                      Getting Omniston quote…
                    </div>
                  ) : hasQuote ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-dim">You receive (est.)</span>
                        <span className="mono font-semibold text-gain">{tonOutHuman} TON</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dim">Route</span>
                        <span className="text-gray-400">Omniston · {fromChain} → TON</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-dim">Settlement</span>
                        <span className="text-gray-400 capitalize">{quoteData.value?.settlementData?.$case ?? 'order'}</span>
                      </div>
                    </>
                  ) : quoteData?.$case === 'noQuote' ? (
                    <p className="text-xs text-danger">No Omniston resolver for {fromChain} → TON {token}. Try USDC or a different chain.</p>
                  ) : (
                    <p className="text-xs text-dim">Enter an amount to see quote</p>
                  )}
                </div>
              )}

              {error && (
                <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-danger">{error}</p>
                </div>
              )}

              {!evmWallet?.connected ? (
                <p className="text-xs text-center text-dim">Connect an EVM wallet to continue</p>
              ) : (
                <button
                  onClick={executeBridge}
                  disabled={!hasQuote || isOffline}
                  className="btn-primary w-full text-center disabled:opacity-40"
                >
                  Bridge {amount || '?'} {token} via Omniston →
                </button>
              )}
              <p className="text-xs text-dim text-center">Step 1 of 2 · Omniston cross-chain order · non-custodial</p>
            </>
          )}

          {/* ── Bridging ── */}
          {step === 'bridging' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-ton animate-spin" />
              <p className="text-sm text-gray-300">Signing Omniston order…</p>
              <p className="text-xs text-dim">Confirm in MetaMask</p>
            </div>
          )}

          {/* ── Bridge done — prompt vault deposit ── */}
          {step === 'bridge_done' && (
            <>
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)' }}>
                <CheckCircle2 className="w-4 h-4 text-gain flex-shrink-0" />
                <p className="text-xs text-gain">Bridge submitted! ~{tonOutHuman} TON arriving in ~2 min.</p>
              </div>

              <div className="rounded-xl p-3 space-y-2 text-sm" style={{ background: 'rgba(0,152,234,0.06)', border: '1px solid rgba(0,152,234,0.2)' }}>
                <div className="flex justify-between">
                  <span className="text-dim">Strategy</span>
                  <span className="text-gray-200">{strategy.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">Est. APY</span>
                  <span className="mono font-semibold text-gain">{strategy.apyMin}–{strategy.apyMax}%</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-dim block mb-1.5">TON amount to deposit</label>
                <input
                  type="number" min="0.1" step="any"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  className="input-field w-full mono text-lg"
                />
                <p className="text-xs text-dim mt-1">Pre-filled from bridge estimate. Adjust once TON arrives.</p>
              </div>

              <AllocationBar allocation={strategy.allocation} />

              {!tonWallet?.connected ? (
                <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-warn">Connect your TON wallet to deposit into the strategy.</p>
                </div>
              ) : (
                <button
                  onClick={executeDeposit}
                  disabled={!parseFloat(depositAmount)}
                  className="btn-primary w-full text-center disabled:opacity-40"
                >
                  Deposit {depositAmount || '?'} TON → {strategy.name}
                </button>
              )}
              <p className="text-xs text-dim text-center">Step 2 of 2 · TON Connect signature · 1 message</p>
            </>
          )}

          {/* ── Depositing ── */}
          {step === 'depositing' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-ton animate-spin" />
              <p className="text-sm text-gray-300">Signing vault deposit…</p>
              <p className="text-xs text-dim">Check your TON wallet</p>
            </div>
          )}

          {/* ── Done ── */}
          {step === 'done' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <CheckCircle2 className="w-10 h-10 text-gain" />
              <p className="font-semibold text-gray-200">Strategy activated!</p>
              <p className="text-xs text-dim text-center">Bridged via Omniston · deposited into {strategy.name}.</p>
            </div>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                <p className="text-xs text-danger">{error}</p>
              </div>
              <button onClick={() => { setStep('quote'); setError(null) }} className="btn-outline w-full">Try again</button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── TON Withdraw + Cross-chain Exit Modal ────────────────────────────────────
// Idea 3: After withdrawing from a TON strategy, bridge proceeds to USDC on EVM.
// Two tabs: "Withdraw to TON wallet" (standard) | "Bridge to EVM" (Omniston exit).

function TonWithdrawAndBridgeModal({ strategy, tonWallet, evmWallet, onClose, onDeactivate }) {
  const [tonConnectUI]    = useTonConnectUI()
  const connectionStatus  = useConnectionStatus()

  // 'choice' | 'withdraw' | 'bridge_exit'
  const [mode,             setMode]             = useState('choice')
  // confirm | signing | done | error
  const [step,             setStep]             = useState('confirm')
  const [error,            setError]            = useState(null)

  // Bridge-exit state: TON → EVM USDC
  const [toChain,          setToChain]          = useState('Polygon')
  const [toToken,          setToToken]          = useState('USDC')
  const [tonAmount,        setTonAmount]        = useState('5')
  const [debouncedTon,     setDebouncedTon]     = useState('')
  const [explorerLink,     setExplorerLink]     = useState(null)

  useEffect(() => { omniston.transport.connect() }, [])

  // Debounce TON amount for bridge exit quote
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTon(tonAmount), 700)
    return () => clearTimeout(t)
  }, [tonAmount])

  // Quote: TON → token on selected EVM chain
  const quoteRequest = useMemo(() => {
    if (mode !== 'bridge_exit') return null
    const parsed = parseFloat(debouncedTon)
    if (!parsed || parsed <= 0) return null
    const inputAsset  = buildAssetId('TON', 'TON')
    const outputAsset = buildAssetId(toChain, toToken)
    if (!inputAsset || !outputAsset) return null
    const inputUnits  = toNano(parsed.toFixed(9)).toString()
    return {
      inputAsset,
      outputAsset,
      amount: { $case: 'inputUnits', value: inputUnits },
      settlementParams: [
        { params: { $case: 'swap',  value: {} } },
        { params: { $case: 'order', value: {} } },
      ],
    }
  }, [mode, debouncedTon, toChain, toToken])

  const isOffline = connectionStatus === 'error' || connectionStatus === 'closed'

  const { data: quoteData, isLoading: quoteLoading } = useRfq(quoteRequest, {
    enabled: !!quoteRequest && !isOffline,
  })

  const hasQuote     = quoteData?.$case === 'quoteUpdated'
  const outDecimals  = DECIMALS[toToken] ?? 6
  const exitOut      = hasQuote
    ? parseFloat(formatUnits(quoteData.value.outputUnits, outDecimals)).toFixed(4)
    : null

  // Standard TON vault withdrawal
  const executeWithdraw = useCallback(async () => {
    setStep('signing')
    setError(null)
    try {
      const vaultKey = strategy.id === 'ton-capital-shield' ? 'IH_CAPITAL_SHIELD_VAULT'
        : strategy.id === 'ton-liquid-yield' ? 'IH_LIQUID_YIELD_VAULT'
        : strategy.id === 'ton-amm-optimizer' ? 'IH_AMM_VAULT'
        : null

      const vaultAddr = vaultKey ? TON[vaultKey] : null
      if (!vaultAddr) throw new Error('Vault not deployed yet. Deploy with: cd contracts-ton && npm run deploy:shield/liquid/amm')

      const msg = buildVaultWithdraw(vaultAddr)
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [msg],
      })
      setStep('done')
      setTimeout(() => { onDeactivate(strategy.id); onClose() }, 1500)
    } catch (e) {
      setError(e?.message ?? 'Transaction rejected')
      setStep('error')
    }
  }, [strategy.id, tonConnectUI, onDeactivate, onClose])

  // Omniston bridge exit: TON → USDC on EVM
  const executeBridgeExit = useCallback(async () => {
    if (!hasQuote || !tonWallet?.connected) return
    setStep('signing')
    setError(null)
    try {
      const rfqId    = quoteData.rfqId
      const srcAddr  = { chain: { $case: 'ton', value: tonWallet.address } }
      const dstChain = OMNISTON_CHAIN_CASE[toChain]
      const dstAddr  = evmWallet?.connected && dstChain
        ? { chain: { $case: dstChain, value: evmWallet.address } }
        : undefined

      const settlementCase = quoteData.value?.settlementData?.$case

      let tonTx
      if (settlementCase === 'swap') {
        tonTx = await omniston.tonBuildSwap({
          quoteId:            rfqId,
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
      setStep('done')
    } catch (e) {
      const msg = e?.message || String(e)
      if (!msg.toLowerCase().includes('user rejected')) setError(msg)
      setStep('confirm')
    }
  }, [hasQuote, quoteData, tonWallet, evmWallet, toChain, tonConnectUI])

  const exitTokens = EVM_EXIT_TOKENS[toChain] ?? ['USDC']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-y-auto" style={{ background: '#111827', border: '1px solid #1e293b', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#1e293b' }}>
          <div>
            <h2 className="font-semibold text-white">
              {mode === 'choice' ? 'Exit Strategy' : mode === 'withdraw' ? 'Withdraw to TON' : 'Bridge & Exit to EVM'}
            </h2>
            <p className="text-xs text-dim mt-0.5">{strategy.name} · TON</p>
          </div>
          <div className="flex items-center gap-3">
            {mode === 'bridge_exit' && <OmnistonBadge status={connectionStatus} />}
            {step !== 'signing' && (
              <button onClick={onClose} className="text-dim hover:text-white"><X className="w-4 h-4" /></button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* ── Choice ── */}
          {mode === 'choice' && (
            <>
              <p className="text-sm text-dim">Choose how to exit your position:</p>

              <button
                onClick={() => setMode('withdraw')}
                className="w-full text-left p-4 rounded-xl transition-all"
                style={{ background: 'rgba(0,152,234,0.06)', border: '1px solid rgba(0,152,234,0.2)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,152,234,0.5)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(0,152,234,0.2)'}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-white text-sm">Withdraw to TON wallet</span>
                  <ArrowRight className="w-4 h-4 text-dim" />
                </div>
                <p className="text-xs text-dim">Returns tsTON / stTON / hTON to your TON wallet. Requires vault to be deployed.</p>
              </button>

              <button
                onClick={() => setMode('bridge_exit')}
                className="w-full text-left p-4 rounded-xl transition-all"
                style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,212,170,0.5)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(0,212,170,0.2)'}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-white text-sm">Bridge &amp; Exit to EVM</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(0,212,170,0.15)', color: '#00d4aa' }}>Omniston</span>
                </div>
                <p className="text-xs text-dim">Swap TON → USDC/USDT on Polygon · Base · BNB. Live quote, non-custodial, ~2 min.</p>
              </button>
            </>
          )}

          {/* ── Withdraw to TON ── */}
          {mode === 'withdraw' && (
            <>
              {step === 'confirm' && (
                <>
                  <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <ArrowDownCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-gray-300">
                      <p className="font-semibold text-danger mb-1">Withdraw from vault</p>
                      <p className="text-dim">Returns your proportional staked tokens to your TON wallet.</p>
                    </div>
                  </div>
                  <div className="card-surface p-3 text-xs space-y-1.5">
                    <p className="text-dim font-medium mb-1">Position breakdown</p>
                    {strategy.allocation.map(a => (
                      <div key={a.label} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm" style={{ background: a.color }} />
                        <span className="text-gray-300">{a.label}</span>
                        <span className="text-dim ml-auto">{a.pct}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setMode('choice')} className="btn-outline flex-1 text-sm">Back</button>
                    <button
                      onClick={executeWithdraw}
                      className="flex-1 text-sm py-2 rounded-lg font-semibold"
                      style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
                    >
                      Withdraw All
                    </button>
                  </div>
                </>
              )}

              {step === 'signing' && (
                <div className="py-10 flex flex-col items-center gap-4">
                  <Loader2 className="w-8 h-8 text-ton animate-spin" />
                  <p className="text-sm text-gray-300">Confirm withdrawal in TON wallet…</p>
                </div>
              )}

              {step === 'done' && (
                <div className="py-10 flex flex-col items-center gap-4">
                  <CheckCircle2 className="w-10 h-10 text-gain" />
                  <p className="font-semibold text-gray-200">Withdrawal submitted</p>
                  <p className="text-xs text-dim text-center">Funds will arrive in your TON wallet shortly.</p>
                </div>
              )}

              {step === 'error' && (
                <div className="space-y-4">
                  <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-danger">{error}</p>
                  </div>
                  <button onClick={() => { setStep('confirm'); setError(null) }} className="btn-outline w-full">Back</button>
                </div>
              )}
            </>
          )}

          {/* ── Bridge & Exit to EVM ── */}
          {mode === 'bridge_exit' && (
            <>
              {step === 'confirm' && (
                <>
                  {/* Chain + token selectors */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-dim block mb-1.5">To chain</label>
                      <select
                        value={toChain}
                        onChange={e => { setToChain(e.target.value); setToToken(EVM_EXIT_TOKENS[e.target.value]?.[0] ?? 'USDC') }}
                        className="input-field w-full text-sm"
                        style={{ color: CHAIN_COLOR[toChain] }}
                      >
                        {EVM_CHAINS.map(c => (
                          <option key={c} value={c} style={{ background: '#111827', color: CHAIN_COLOR[c] }}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-dim block mb-1.5">Receive</label>
                      <select
                        value={toToken}
                        onChange={e => setToToken(e.target.value)}
                        className="input-field w-full text-sm"
                      >
                        {exitTokens.map(t => (
                          <option key={t} value={t} style={{ background: '#111827' }}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-dim block mb-1.5">TON to bridge</label>
                    <input
                      type="number" min="0.1" step="any"
                      value={tonAmount}
                      onChange={e => setTonAmount(e.target.value)}
                      className="input-field w-full mono text-lg"
                      placeholder="5"
                    />
                  </div>

                  {/* Live quote */}
                  <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)' }}>
                    {quoteLoading || quoteData?.$case === 'ack' ? (
                      <div className="flex items-center gap-2 text-sm text-dim">
                        <Loader2 className="w-4 h-4 animate-spin text-gain" />
                        Getting Omniston quote…
                      </div>
                    ) : hasQuote ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-dim">You receive (est.)</span>
                          <span className="mono font-semibold text-gain">{exitOut} {toToken}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-dim">Route</span>
                          <span className="text-gray-400">Omniston · TON → {toChain}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-dim">Est. time</span>
                          <span className="text-gray-400">~2 min</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-dim">Non-custodial</span>
                          <span className="text-gain">Yes</span>
                        </div>
                      </>
                    ) : quoteData?.$case === 'noQuote' ? (
                      <p className="text-xs text-danger">No resolver for TON → {toToken} on {toChain}. Try USDC or a different chain.</p>
                    ) : (
                      <p className="text-xs text-dim">Enter an amount to see live quote</p>
                    )}
                  </div>

                  {!evmWallet?.connected && (
                    <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                      <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-warn">Connect an EVM wallet to receive funds on {toChain}.</p>
                    </div>
                  )}

                  {error && (
                    <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-danger">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => setMode('choice')} className="btn-outline flex-1 text-sm">Back</button>
                    <button
                      onClick={executeBridgeExit}
                      disabled={!hasQuote || !tonWallet?.connected || isOffline}
                      className="flex-1 text-sm py-2 rounded-lg font-semibold transition-all disabled:opacity-40"
                      style={{ background: 'rgba(0,212,170,0.15)', border: '1px solid rgba(0,212,170,0.4)', color: '#00d4aa' }}
                    >
                      Bridge {tonAmount || '?'} TON → {toToken}
                    </button>
                  </div>
                  <p className="text-xs text-dim text-center">Omniston · TON → {toChain} · 1 signature</p>
                </>
              )}

              {step === 'signing' && (
                <div className="py-10 flex flex-col items-center gap-4">
                  <Loader2 className="w-8 h-8 text-gain animate-spin" />
                  <p className="text-sm text-gray-300">Confirm Omniston swap in TON wallet…</p>
                </div>
              )}

              {step === 'done' && (
                <div className="py-10 flex flex-col items-center gap-4">
                  <CheckCircle2 className="w-10 h-10 text-gain" />
                  <p className="font-semibold text-gray-200">Bridge submitted!</p>
                  <p className="text-xs text-dim text-center">~{exitOut} {toToken} arriving on {toChain} in ~2 min.</p>
                  {explorerLink && (
                    <a href={explorerLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-ton">
                      Track on TON explorer <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── TON Activate Modal ───────────────────────────────────────────────────────

function TonActivateModal({ strategy, wallet, onClose, onActivate }) {
  const [tonConnectUI] = useTonConnectUI()
  const [step, setStep]     = useState('confirm')
  const [error, setError]   = useState(null)
  const [amount, setAmount] = useState('10')

  const proceed = useCallback(async () => {
    setStep('building')
    setError(null)
    try {
      const totalNano = toNano(amount || '1')
      const tx = await buildTonStrategyTx(strategy.id, totalNano, wallet.address)
      setStep('signing')
      await tonConnectUI.sendTransaction(tx)
      setStep('done')
      setTimeout(() => { onActivate(strategy.id); onClose() }, 1200)
    } catch (e) {
      setError(e?.message ?? 'Transaction rejected')
      setStep('error')
    }
  }, [amount, strategy.id, wallet.address, tonConnectUI, onActivate, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl" style={{ background: '#111827', border: '1px solid #1e293b' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#1e293b' }}>
          <div>
            <h2 className="font-semibold text-white">{strategy.name}</h2>
            <p className="text-xs text-dim mt-0.5">TON · {strategy.txMessages} messages · 1 signature</p>
          </div>
          {step !== 'signing' && <button onClick={onClose} className="text-dim hover:text-white"><X className="w-4 h-4" /></button>}
        </div>

        <div className="p-5 space-y-4">
          {step === 'confirm' && (
            <>
              <div className="card-surface p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-dim">Est. APY</span>
                  <span className="mono font-semibold" style={{ color: strategy.color }}>{strategy.apyMin}–{strategy.apyMax}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">Gas (est.)</span>
                  <span className="mono text-gray-300">{strategy.gasEstimate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">Protocols</span>
                  <span className="text-gray-300">{strategy.protocols.join(', ')}</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-dim block mb-1.5">Amount to invest (TON)</label>
                <input
                  type="number" min="1" step="any"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="input-field w-full mono text-lg"
                  placeholder="10"
                />
              </div>

              <AllocationBar allocation={strategy.allocation} />

              {strategy.ilRisk && (
                <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-warn">Impermanent loss risk. If pool assets diverge in price, position may be worth less than holding directly.</p>
                </div>
              )}
              {strategy.liquidationRisk && (
                <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-danger">High-risk pools. Full capital loss is possible.</p>
                </div>
              )}

              <p className="text-xs text-dim">One TON Connect signature sends {strategy.txMessages} messages to the protocol contracts simultaneously. Non-custodial.</p>

              <button
                onClick={proceed}
                disabled={!parseFloat(amount)}
                className="btn-primary w-full text-center disabled:opacity-50"
              >
                Sign &amp; Activate ({strategy.txMessages} msgs, 1 sig)
              </button>
            </>
          )}

          {step === 'building' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-ton animate-spin" />
              <p className="text-sm text-gray-300">Preparing transaction…</p>
            </div>
          )}

          {step === 'signing' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-ton animate-spin" />
              <p className="text-sm text-gray-300">Waiting for wallet signature…</p>
              <p className="text-xs text-dim">Check {wallet.walletName || 'TON wallet'} for approval</p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <CheckCircle2 className="w-10 h-10 text-gain" />
              <p className="text-sm font-semibold text-gray-200">Strategy activated!</p>
              <p className="text-xs text-dim text-center">Transaction submitted to TON chain.</p>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                <p className="text-xs text-danger">{error}</p>
              </div>
              <button onClick={() => setStep('confirm')} className="btn-outline w-full text-center">Try again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Vault Activate Modal (1 signing, native token, no approvals) ─────────────

const VAULT_BY_CHAIN = { Polygon: POLYGON.IH_VAULT, Base: BASE.IH_VAULT, BNB: BNB.IH_VAULT }

function VaultActivateModal({ strategy, wallet, onClose, onActivate }) {
  const [step,   setStep]   = useState('confirm')
  const [amount, setAmount] = useState('0.01')
  const [txHash, setTxHash] = useState(null)
  const [error,  setError]  = useState(null)

  const vaultAddress = VAULT_BY_CHAIN[strategy.chain]
  const sym          = strategy.nativeSymbol ?? 'ETH'

  const execute = useCallback(async () => {
    setStep('signing')
    setError(null)
    try {
      const ensureFn = CHAIN_ENSURE[strategy.chain]
      if (ensureFn) await ensureFn()

      const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e18))
      const amountHex = '0x' + amountWei.toString(16)

      if (!vaultAddress) throw new Error('Vault not yet deployed. Run: cd contracts && npm run deploy:' + strategy.chain.toLowerCase())

      const hash = await executeVaultDeposit(vaultAddress, amountHex)
      setTxHash(hash)
      setStep('done')
      setTimeout(() => { onActivate(strategy.id); onClose() }, 2000)
    } catch (e) {
      setError(e?.message ?? 'Transaction rejected')
      setStep('error')
    }
  }, [amount, strategy, vaultAddress, onActivate, onClose])

  const explorerUrl = txHash ? (CHAIN_EXPLORER[strategy.chain] + txHash) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-y-auto" style={{ background: '#111827', border: '1px solid #1e293b', maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#1e293b' }}>
          <div>
            <h2 className="font-semibold text-white">{strategy.name}</h2>
            <p className="text-xs mt-0.5" style={{ color: '#00d4aa' }}>IH Vault · 1 signature · 0 approvals</p>
          </div>
          {step !== 'signing' && <button onClick={onClose} style={{ color: '#4a5e7a' }} className="hover:text-white"><X className="w-4 h-4" /></button>}
        </div>

        <div className="p-5 space-y-4">
          {step === 'confirm' && (
            <>
              <div className="rounded-xl p-3 space-y-2 text-sm" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex justify-between">
                  <span style={{ color: '#4a5e7a' }}>Est. APY</span>
                  <span className="mono font-semibold" style={{ color: '#00d4aa' }}>{strategy.apyMin}–{strategy.apyMax}%</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#4a5e7a' }}>Deposit token</span>
                  <span className="mono" style={{ color: '#d1dce8' }}>Native {sym} (no wrapping step)</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#4a5e7a' }}>You receive</span>
                  <span className="mono" style={{ color: '#d1dce8' }}>ih{strategy.chain === 'Polygon' ? 'POLY' : strategy.chain === 'Base' ? 'BASE' : 'BNB'} vault shares</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#4a5e7a' }}>Signatures needed</span>
                  <span className="mono font-bold" style={{ color: '#00d4aa' }}>1 (send {sym})</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#4a5e7a' }}>Gas (est.)</span>
                  <span className="mono" style={{ color: '#8b9dc3' }}>{strategy.gasEstimate}</span>
                </div>
              </div>

              <AllocationBar allocation={strategy.allocation} />

              <div>
                <label className="text-xs block mb-1.5" style={{ color: '#4a5e7a' }}>Amount ({sym})</label>
                <input
                  type="number" min="0.001" step="0.001"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="input-field w-full mono text-lg"
                  placeholder="0.01"
                />
              </div>

              {!vaultAddress && (
                <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-400">Vault not yet deployed. Run <code className="font-mono">cd contracts && npm run deploy:{strategy.chain.toLowerCase()}</code> to deploy.</p>
                </div>
              )}

              <button
                onClick={execute}
                disabled={!parseFloat(amount) || !vaultAddress}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40"
                style={{ background: '#00d4aa20', border: '1px solid #00d4aa50', color: '#00d4aa' }}
              >
                Deposit {amount || '?'} {sym} → Activate
              </button>
            </>
          )}

          {step === 'signing' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#00d4aa' }} />
              <p className="text-sm" style={{ color: '#d1dce8' }}>Confirm in wallet…</p>
              <p className="text-xs" style={{ color: '#4a5e7a' }}>Vault wraps, swaps, and supplies to AAVE atomically</p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <CheckCircle2 className="w-10 h-10" style={{ color: '#00d4aa' }} />
              <p className="font-semibold" style={{ color: '#d1dce8' }}>Strategy activated!</p>
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs" style={{ color: '#0098ea' }}>
                  View on explorer <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
              <button onClick={() => setStep('confirm')} className="w-full py-2.5 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.05)', color: '#d1dce8', border: '1px solid rgba(255,255,255,0.1)' }}>Try Again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── EVM Activate Modal (Polygon / Base / BNB) ────────────────────────────────

function EvmActivateModal({ strategy, wallet, chain, onClose, onActivate }) {
  const [step,               setStep]               = useState('confirm')
  const [error,              setError]              = useState(null)
  const [simWarning,         setSimWarning]         = useState(null)
  const [amount,             setAmount]             = useState('100')
  const [balResult,          setBalResult]          = useState(null)
  const [needed,             setNeeded]             = useState([])
  const [currentApproval,    setCurrentApproval]    = useState(null)
  const [confirmingApproval, setConfirmingApproval] = useState(false)
  const [swapFromNative,     setSwapFromNative]     = useState(false)

  const nativeLabel = CHAIN_NATIVE_LABEL[chain] ?? 'native'

  const handleCheckAndProceed = useCallback(async () => {
    setStep('balcheck')
    setError(null)
    try {
      const ensureFn = CHAIN_ENSURE[chain]
      if (ensureFn) await ensureFn()
      const usdAmount = parseFloat(amount || '0')
      const result = await checkEVMBalances(chain, strategy.id, usdAmount, wallet.address)
      setBalResult(result)

      if (!result.sufficient) {
        if (result.canSwapFromNative && chain === 'Polygon') {
          setStep('swappath')
        } else {
          setStep('insufficient')
        }
        return
      }

      const pending = await checkStrategyApprovals(strategy.id, wallet.address)
      setNeeded(pending)
      setStep(pending.length > 0 ? 'approving' : 'ready')
    } catch (e) {
      setError(e?.message ?? 'Balance check failed')
      setStep('error')
    }
  }, [amount, chain, strategy.id, wallet.address])

  const runApproval = useCallback(async (approval) => {
    setCurrentApproval(approval.label)
    setConfirmingApproval(false)
    try {
      const txHash = await approveERC20(approval.token, approval.spender)
      setConfirmingApproval(true)
      await waitForReceipt(txHash)
      setConfirmingApproval(false)
      setNeeded(prev => {
        const next = prev.filter(a => !(a.token === approval.token && a.spender === approval.spender))
        if (next.length === 0) setStep('ready')
        return next
      })
    } catch (e) {
      setConfirmingApproval(false)
      setError(e?.message ?? 'Approval rejected or timed out')
    } finally {
      setCurrentApproval(null)
    }
  }, [])

  const execute = useCallback(async (forceSwap = false) => {
    setStep('signing')
    setError(null)
    setSimWarning(null)
    const useSwap = forceSwap || swapFromNative
    try {
      const usd6 = BigInt(Math.round(parseFloat(amount || '0') * 1e6))
      if (chain === 'Polygon' && useSwap) {
        const maticWei = balResult ? BigInt(Math.floor(balResult.nativeBalanceUSD / (balResult.nativePrice ?? 0.8) * 0.95 * 1e18)) : 0n
        await executePolygonStrategy(strategy.id, usd6, wallet.address, true, maticWei)
      } else {
        await executeEVMStrategy(chain, strategy.id, usd6, wallet.address)
      }
      setStep('done')
      setTimeout(() => { onActivate(strategy.id); onClose() }, 1200)
    } catch (e) {
      if (e?.simulation) {
        setSimWarning(e.message.replace('Simulation failed: ', ''))
        setStep('simwarn')
      } else {
        setError(e?.message ?? 'Transaction rejected')
        setStep('error')
      }
    }
  }, [amount, balResult, chain, swapFromNative, strategy.id, wallet.address, onActivate, onClose])

  const proceedDespiteSimulation = useCallback(async () => {
    setStep('signing')
    setError(null)
    try {
      const usd6 = BigInt(Math.round(parseFloat(amount || '0') * 1e6))
      await executeEVMStrategy(chain, strategy.id, usd6, wallet.address, true)
      setStep('done')
      setTimeout(() => { onActivate(strategy.id); onClose() }, 1200)
    } catch (e) {
      setError(e?.message ?? 'Transaction rejected')
      setStep('error')
    }
  }, [amount, chain, strategy.id, wallet.address, onActivate, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-y-auto" style={{ background: '#111827', border: '1px solid #1e293b', maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#1e293b' }}>
          <div>
            <h2 className="font-semibold text-white">{strategy.name}</h2>
            <p className="text-xs text-dim mt-0.5">{chain} · Multicall3 · 1 main signature</p>
          </div>
          {step !== 'signing' && <button onClick={onClose} className="text-dim hover:text-white"><X className="w-4 h-4" /></button>}
        </div>

        <div className="p-5 space-y-4">

          {step === 'confirm' && (
            <>
              <div className="card-surface p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-dim">Est. APY</span>
                  <span className="mono font-semibold" style={{ color: strategy.color }}>{strategy.apyMin}–{strategy.apyMax}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">Gas (est.)</span>
                  <span className="mono text-gray-300">{strategy.gasEstimate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">Protocols</span>
                  <span className="text-gray-300">{strategy.protocols.join(', ')}</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-dim block mb-1.5">Amount to invest (USD)</label>
                <input
                  type="number" min="1" step="any"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="input-field w-full mono text-lg"
                  placeholder="100"
                />
              </div>

              <AllocationBar allocation={strategy.allocation} />

              {strategy.ilRisk && (
                <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-warn">Impermanent loss risk if pooled assets diverge in price.</p>
                </div>
              )}

              <button
                onClick={handleCheckAndProceed}
                disabled={!parseFloat(amount)}
                className="btn-primary w-full text-center disabled:opacity-50"
              >
                Check Balances &amp; Activate
              </button>
            </>
          )}

          {step === 'balcheck' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-poly animate-spin" />
              <p className="text-sm text-gray-300">Checking your wallet balances…</p>
              <p className="text-xs text-dim">Querying on-chain + CoinGecko prices</p>
            </div>
          )}

          {step === 'insufficient' && balResult && (
            <div className="space-y-4">
              <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                <div className="text-xs text-danger">
                  <p className="font-semibold mb-1">Insufficient token balance</p>
                  <p className="text-dim">You need {fmtUSD(balResult.totalNeededUSD)} worth of strategy tokens.</p>
                </div>
              </div>
              <div className="card-surface p-3 space-y-2 text-xs">
                <div className="text-dim font-medium mb-2">What you're missing</div>
                {balResult.missing.map(m => (
                  <div key={m.symbol} className="flex justify-between items-center">
                    <span className="text-gray-300 font-medium">{m.symbol}</span>
                    <div className="text-right">
                      <span className="text-dim">Have: {fmtUSD(m.haveUSD)}</span>
                      <span className="text-dim mx-1">·</span>
                      <span className="text-danger">Need: {fmtUSD(m.needUSD)}</span>
                    </div>
                  </div>
                ))}
                <div className="border-t mt-2 pt-2" style={{ borderColor: '#1e293b' }}>
                  <div className="flex justify-between">
                    <span className="text-dim">Your {nativeLabel}</span>
                    <span className="text-gray-300">{fmtUSD(balResult.nativeBalanceUSD)}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setStep('confirm')} className="btn-outline w-full text-center">Back</button>
            </div>
          )}

          {step === 'swappath' && balResult && (
            <div className="space-y-4">
              <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(130,71,229,0.08)', border: '1px solid rgba(130,71,229,0.3)' }}>
                <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#8247e5' }} />
                <div className="text-xs" style={{ color: '#a78bfa' }}>
                  <p className="font-semibold mb-1">You don't have the required tokens</p>
                  <p className="text-dim">But you have <span className="text-white font-medium">{fmtUSD(balResult.nativeBalanceUSD)}</span> in {nativeLabel} — enough to swap and invest in one transaction.</p>
                </div>
              </div>
              <div className="card-surface p-3 space-y-2 text-xs">
                <div className="text-dim font-medium mb-2">Missing tokens</div>
                {balResult.missing.map(m => (
                  <div key={m.symbol} className="flex justify-between items-center">
                    <span className="text-gray-300 font-medium">{m.symbol}</span>
                    <span className="text-danger">−{fmtUSD(m.shortfallUSD)}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('confirm')} className="btn-outline flex-1 text-center text-sm">Back</button>
                <button
                  onClick={() => { setSwapFromNative(true); execute(true) }}
                  className="flex-1 text-center text-sm py-2 rounded-lg font-semibold transition-all"
                  style={{ background: 'rgba(130,71,229,0.2)', border: '1px solid rgba(130,71,229,0.5)', color: '#a78bfa' }}
                >
                  Swap {nativeLabel} &amp; Invest
                </button>
              </div>
            </div>
          )}

          {step === 'approving' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-300 font-medium">Token approvals required</p>
              <p className="text-xs text-dim">Approve Multicall3 to pull tokens on your behalf for the batch transaction. One-time per token.</p>
              {needed.map(a => {
                const isActive = currentApproval === a.label
                return (
                  <div key={a.token + a.spender} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#1a2235', border: '1px solid #2a3a55' }}>
                    <span className="text-sm text-gray-200">{a.label}</span>
                    <button
                      onClick={() => runApproval(a)}
                      disabled={!!currentApproval}
                      className="text-xs py-1 px-3 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                      style={{ background: 'rgba(130,71,229,0.2)', border: '1px solid rgba(130,71,229,0.4)', color: '#8247e5' }}
                    >
                      {isActive && <Loader2 className="w-3 h-3 animate-spin" />}
                      {isActive ? (confirmingApproval ? 'Confirming…' : 'Signing…') : 'Approve'}
                    </button>
                  </div>
                )
              })}
              {error && <p className="text-xs text-danger">{error}</p>}
            </div>
          )}

          {step === 'ready' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)' }}>
                <CheckCircle2 className="w-4 h-4 text-gain flex-shrink-0" />
                <p className="text-xs text-gain">Balances ✓ · Approvals ✓ — ready to activate via Multicall3</p>
              </div>
              <div className="card-surface p-3 text-xs space-y-1">
                <div className="text-dim font-medium mb-1">Multicall3 contract</div>
                <div className="mono text-gray-400 break-all">0xcA11bde05977b3631167028862bE2a173976CA11</div>
                <div className="text-dim mt-2">
                  Calls: <span className="text-gray-200">transferFrom</span> → <span className="text-gray-200">approve</span> → <span className="text-gray-200">supply/addLiquidity</span>
                </div>
              </div>
              <button onClick={() => execute(false)} className="btn-primary w-full text-center">
                Sign &amp; Activate (1 tx via Multicall3)
              </button>
            </div>
          )}

          {step === 'simwarn' && (
            <div className="space-y-4">
              <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
                <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0 mt-0.5" />
                <div className="text-xs text-warn">
                  <p className="font-semibold mb-1">Simulation warning</p>
                  <p className="text-dim break-words">{simWarning}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('ready')} className="btn-outline flex-1 text-sm">Back</button>
                <button
                  onClick={proceedDespiteSimulation}
                  className="flex-1 text-sm py-2 rounded-lg font-semibold"
                  style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24' }}
                >
                  Send anyway
                </button>
              </div>
            </div>
          )}

          {step === 'signing' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-poly animate-spin" />
              <p className="text-sm text-gray-300">Waiting for MetaMask signature…</p>
              <p className="text-xs text-dim">Multicall3 will execute all strategy calls atomically</p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <CheckCircle2 className="w-10 h-10 text-gain" />
              <p className="text-sm font-semibold text-gray-200">Strategy activated!</p>
              <p className="text-xs text-dim text-center">Transaction submitted to {chain}.</p>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                <p className="text-xs text-danger">{error}</p>
              </div>
              <button onClick={() => { setStep('confirm'); setError(null) }} className="btn-outline w-full text-center">Try again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── EVM Withdrawal Modal ─────────────────────────────────────────────────────

function WithdrawalModal({ strategy, wallet, onClose, onDeactivate }) {
  const [step,   setStep]   = useState('confirm')
  const [error,  setError]  = useState(null)
  const [txHash, setTxHash] = useState(null)

  const explorer = CHAIN_EXPLORER[strategy.chain]

  const execute = useCallback(async () => {
    setStep('withdrawing')
    setError(null)
    try {
      const { txHash: hash } = await executeEVMWithdrawal(strategy.chain, strategy.id, wallet.address)
      setTxHash(hash)
      setStep('done')
      setTimeout(() => { onDeactivate(strategy.id); onClose() }, 2000)
    } catch (e) {
      setError(e?.message ?? 'Withdrawal failed')
      setStep('error')
    }
  }, [strategy.id, strategy.chain, wallet.address, onDeactivate, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl" style={{ background: '#111827', border: '1px solid #1e293b' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#1e293b' }}>
          <div>
            <h2 className="font-semibold text-white">Deactivate Strategy</h2>
            <p className="text-xs text-dim mt-0.5">{strategy.name} · {strategy.chain}</p>
          </div>
          {step !== 'withdrawing' && <button onClick={onClose} className="text-dim hover:text-white"><X className="w-4 h-4" /></button>}
        </div>

        <div className="p-5 space-y-4">
          {step === 'confirm' && (
            <>
              <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <ArrowDownCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                <div className="text-xs text-gray-300">
                  <p className="font-semibold text-danger mb-1">Withdraw all funds</p>
                  <p className="text-dim">This will exit all positions and return tokens to your wallet.</p>
                </div>
              </div>
              <div className="card-surface p-3 text-xs space-y-1.5">
                <p className="text-dim font-medium">What gets withdrawn</p>
                {strategy.allocation.map(a => (
                  <div key={a.label} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{ background: a.color }} />
                    <span className="text-gray-300">{a.label}</span>
                    <span className="text-dim ml-auto">{a.pct}%</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="btn-outline flex-1 text-sm">Cancel</button>
                <button
                  onClick={execute}
                  className="flex-1 text-sm py-2 rounded-lg font-semibold"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
                >
                  Withdraw All
                </button>
              </div>
            </>
          )}

          {step === 'withdrawing' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-gain animate-spin" />
              <p className="text-sm text-gray-300">Withdrawing funds…</p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <CheckCircle2 className="w-10 h-10 text-gain" />
              <p className="text-sm font-semibold text-gray-200">Funds returned to wallet</p>
              {txHash && explorer && (
                <a href={`${explorer}/tx/${txHash}`} target="_blank" rel="noreferrer" className="text-xs text-ton flex items-center gap-1">
                  View on explorer <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                <p className="text-xs text-danger">{error}</p>
              </div>
              <button onClick={() => { setStep('confirm'); setError(null) }} className="btn-outline w-full text-center">Back</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Strategy Card ────────────────────────────────────────────────────────────

function StrategyCard({ s, isActive, tonWallet, evmWallet, onActivate, onDeactivate, onConnectTon, onConnectEVM }) {
  const [showActivate,     setShowActivate]     = useState(false)
  const [showWithdraw,     setShowWithdraw]     = useState(false)
  const [showBridgeEnter,  setShowBridgeEnter]  = useState(false)
  const { icon: Icon, pillClass } = TIER_META[s.tier] || {}
  const isTON     = s.chain === 'TON'
  const wallet    = isTON ? tonWallet : evmWallet
  const chainColor = CHAIN_TABS.find(c => c.id === s.chain)?.color ?? '#8247e5'

  // TON strategy: show "Bridge & Enter from EVM" button when EVM wallet is connected
  const canBridgeEnter = isTON && evmWallet?.connected

  return (
    <>
      <div
        className="p-5 flex flex-col gap-4 transition-all rounded-2xl"
        style={{
          background: `${chainColor}07`,
          border: `1px solid ${isActive ? s.color : `${chainColor}25`}`,
          boxShadow: isActive ? `0 0 0 1px ${s.color}25` : 'none',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`pill ${pillClass}`}>
                {Icon && <Icon className="w-3 h-3 mr-1 inline" />}
                {s.tier}
              </span>
              {isActive && <span className="pill pill-green">Active</span>}
            </div>
            <h3 className="text-base font-bold text-white">{s.name}</h3>
          </div>
          <div className="text-right">
            <div className="mono font-bold text-xl" style={{ color: s.color }}>{s.apyMin}–{s.apyMax}%</div>
            <div className="text-xs text-dim">Est. APY</div>
          </div>
        </div>

        <p className="text-xs text-dim leading-relaxed">{s.description}</p>

        <AllocationBar allocation={s.allocation} />

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-dim">Risk</span>
            <RiskDots score={s.riskScore} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-dim">IL risk</span>
            <span className={s.ilRisk ? 'text-warn' : 'text-gain'}>{s.ilRisk ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-dim">Liquidation</span>
            <span className={s.liquidationRisk ? 'text-danger' : 'text-gain'}>{s.liquidationRisk ? 'Possible' : 'No'}</span>
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {s.protocols.map(p => <span key={p} className="pill pill-gray">{p}</span>)}
          <span
            className="pill"
            style={{ background: `${chainColor}20`, border: `1px solid ${chainColor}50`, color: chainColor }}
          >
            {s.chain}
          </span>
        </div>

        {/* ── Action buttons ── */}
        {s.comingSoon ? (
          <div
            className="w-full text-center text-sm py-2 rounded-lg mt-auto flex items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', color: '#8b9dc3' }}
          >
            <Clock className="w-3.5 h-3.5" />
            Coming Soon
          </div>
        ) : isActive ? (
          <button
            onClick={() => setShowWithdraw(true)}
            className="w-full text-center text-sm py-2 rounded-lg font-semibold transition-all mt-auto"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
          >
            Deactivate &amp; Withdraw
          </button>
        ) : wallet?.connected ? (
          <div className="flex flex-col gap-2 mt-auto">
            <button
              onClick={() => setShowActivate(true)}
              className="w-full text-center text-sm py-2 rounded-lg font-semibold transition-all"
              style={{ background: s.color + '20', border: `1px solid ${s.color}60`, color: s.color }}
              onMouseEnter={e => { e.currentTarget.style.background = s.color + '35' }}
              onMouseLeave={e => { e.currentTarget.style.background = s.color + '20' }}
            >
              Activate Strategy
            </button>
            {/* Bridge & Enter: secondary option for TON strategies when EVM wallet also connected */}
            {canBridgeEnter && (
              <button
                onClick={() => setShowBridgeEnter(true)}
                className="w-full text-center text-xs py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5"
                style={{ background: 'rgba(0,152,234,0.08)', border: '1px solid rgba(0,152,234,0.2)', color: '#0098ea' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,152,234,0.5)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(0,152,234,0.2)'}
              >
                <ArrowRight className="w-3 h-3" />
                Bridge &amp; Enter from EVM · Omniston
              </button>
            )}
          </div>
        ) : isTON && !tonWallet?.connected && canBridgeEnter ? (
          // EVM connected but TON not — offer Bridge & Enter as primary action
          <div className="flex flex-col gap-2 mt-auto">
            <button
              onClick={() => setShowBridgeEnter(true)}
              className="w-full text-center text-sm py-2 rounded-lg font-semibold transition-all"
              style={{ background: 'rgba(0,152,234,0.15)', border: '1px solid rgba(0,152,234,0.4)', color: '#0098ea' }}
            >
              Bridge &amp; Enter from EVM · Omniston
            </button>
            <button onClick={onConnectTon} className="btn-outline w-full text-center text-xs py-1.5">
              Connect TON wallet instead
            </button>
          </div>
        ) : (
          <button
            onClick={isTON ? onConnectTon : onConnectEVM}
            className="btn-outline w-full text-center text-sm mt-auto"
          >
            Connect {isTON ? 'TON' : 'EVM'} Wallet
          </button>
        )}
      </div>

      {/* Modals */}
      {showActivate && (
        isTON
          ? <TonActivateModal
              strategy={s} wallet={wallet}
              onClose={() => setShowActivate(false)}
              onActivate={onActivate}
            />
          : s.useVault
            ? <VaultActivateModal
                strategy={s} wallet={wallet}
                onClose={() => setShowActivate(false)}
                onActivate={onActivate}
              />
            : <EvmActivateModal
                strategy={s} wallet={wallet} chain={s.chain}
                onClose={() => setShowActivate(false)}
                onActivate={onActivate}
              />
      )}

      {showWithdraw && (
        isTON
          ? <TonWithdrawAndBridgeModal
              strategy={s} tonWallet={tonWallet} evmWallet={evmWallet}
              onClose={() => setShowWithdraw(false)}
              onDeactivate={onDeactivate}
            />
          : <WithdrawalModal
              strategy={s} wallet={wallet}
              onClose={() => setShowWithdraw(false)}
              onDeactivate={onDeactivate}
            />
      )}

      {showBridgeEnter && (
        <BridgeAndEnterModal
          strategy={s} evmWallet={evmWallet} tonWallet={tonWallet}
          onClose={() => setShowBridgeEnter(false)}
          onActivate={onActivate}
        />
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const STRATEGIES_BY_CHAIN = {
  TON:     TON_STRATEGIES,
  Polygon: POLYGON_STRATEGIES,
  Base:    BASE_STRATEGIES,
  BNB:     BNB_STRATEGIES,
}

const ALL_STRATEGIES = [...TON_STRATEGIES, ...POLYGON_STRATEGIES, ...BASE_STRATEGIES, ...BNB_STRATEGIES]

export default function Strategies({ onBack, tonWallet, evmWallet, activeStrategy, setActiveStrategy, onConnectTon, onConnectEVM }) {
  const [chainTab, setChainTab] = useState('TON')

  const handleDeactivate = () => setActiveStrategy(null)

  const strategies = STRATEGIES_BY_CHAIN[chainTab] ?? []
  const activeS    = ALL_STRATEGIES.find(s => s.id === activeStrategy)

  return (
    <div className="space-y-5">
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
      {activeStrategy && activeS && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.25)' }}>
          <CheckCircle2 className="w-4 h-4 text-gain flex-shrink-0" />
          <p className="text-sm text-gray-200">
            <span className="font-semibold text-gain">{activeS.name}</span>
            {' '}({activeS.chain}) is active — rebalancing automatically.
          </p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {CHAIN_TABS.map(({ id, label, color }) => (
          <button
            key={id}
            onClick={() => setChainTab(id)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
            style={{
              background: chainTab === id ? `${color}18` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${chainTab === id ? `${color}50` : 'rgba(255,255,255,0.07)'}`,
              color: chainTab === id ? color : '#4a5e7a',
            }}
            onMouseEnter={e => { if (chainTab !== id) { e.currentTarget.style.color = color; e.currentTarget.style.borderColor = `${color}35` } }}
            onMouseLeave={e => { if (chainTab !== id) { e.currentTarget.style.color = '#4a5e7a'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' } }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="text-xs text-dim px-1">{CHAIN_DESCS[chainTab]}</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strategies.map(s => (
          <StrategyCard
            key={s.id}
            s={s}
            isActive={activeStrategy === s.id}
            tonWallet={tonWallet}
            evmWallet={evmWallet}
            onActivate={setActiveStrategy}
            onDeactivate={handleDeactivate}
            onConnectTon={onConnectTon}
            onConnectEVM={onConnectEVM}
          />
        ))}
      </div>

      <p className="text-xs text-dim text-center">
        APY ranges are estimates based on current pool conditions and may change significantly. Not financial advice. All strategies are non-custodial — funds interact directly with protocol contracts.
      </p>
    </div>
  )
}
