import { useState, useEffect, useMemo } from 'react'
import { ArrowLeftRight, Clock, CheckCircle2, Loader2, Info, AlertCircle, Zap, Wifi, WifiOff } from 'lucide-react'
import { useRfq, useConnectionStatus } from '@ston-fi/omniston-sdk-react'
import { buildAssetId, DECIMALS, formatUnits } from '../lib/omniston.js'

const STEPS = ['Initiating', 'Source chain confirm', 'Omniston relay', 'Destination confirm', 'Complete']

const SUPPORTED = {
  TON:     ['USDC', 'USDT', 'TON', 'WETH', 'WBTC'],
  Polygon: ['USDC', 'USDT', 'WETH', 'WBTC', 'MATIC'],
}

function ConnectionBadge({ status }) {
  if (status === 'connected')
    return <span className="flex items-center gap-1 text-xs text-gain"><Wifi className="w-3 h-3" />Omniston connected</span>
  if (status === 'connecting')
    return <span className="flex items-center gap-1 text-xs text-warn"><Loader2 className="w-3 h-3 animate-spin" />Connecting…</span>
  return <span className="flex items-center gap-1 text-xs text-danger"><WifiOff className="w-3 h-3" />Omniston offline</span>
}

function ChainCard({ label, chain }) {
  const isTON = chain === 'TON'
  return (
    <div
      className="flex-1 rounded-xl p-4 flex flex-col gap-1"
      style={{
        background: isTON ? 'rgba(0,152,234,0.08)' : 'rgba(130,71,229,0.08)',
        border: `1px solid ${isTON ? 'rgba(0,152,234,0.25)' : 'rgba(130,71,229,0.25)'}`,
      }}
    >
      <span className="text-xs text-dim">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: isTON ? '#0098ea' : '#8247e5' }}
        >{isTON ? 'T' : 'P'}</span>
        <span className="font-semibold text-white">{chain}</span>
      </div>
      <span className="text-xs text-dim">{isTON ? 'TON Connect 2.0' : 'WalletConnect v2'}</span>
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
    const fallbackAmt = (parsedAmt * 0.999).toFixed(6)
    return (
      <div className="card-surface p-3 space-y-2 text-sm">
        <div className="flex items-center gap-1.5 text-warn text-xs mb-1">
          <AlertCircle className="w-3.5 h-3.5" />
          No Omniston resolver for this pair — showing LayerZero estimate
        </div>
        <div className="flex justify-between">
          <span className="text-dim">Est. received</span>
          <span className="mono text-gray-200">{fallbackAmt} {token}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-dim">Bridge fee</span>
          <span className="mono text-warn">~0.1%</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-dim">Route</span>
          <span className="text-gray-400">LayerZero · Orbiter fallback</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-dim">ETA</span>
          <span className="text-gray-400">~2 min</span>
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

export default function Bridge({ wallet, onConnectWallet }) {
  const connectionStatus = useConnectionStatus()

  const [fromChain,       setFromChain]       = useState('TON')
  const [token,           setToken]           = useState('USDC')
  const [amount,          setAmount]          = useState('')
  const [debouncedAmount, setDebouncedAmount] = useState('')
  const [step,            setStep]            = useState(null)

  const toChain = fromChain === 'TON' ? 'Polygon' : 'TON'

  // Debounce amount → avoids hammering Omniston on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(amount), 700)
    return () => clearTimeout(t)
  }, [amount])

  // Build QuoteRequest, memoised — only recomputes when inputs change
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

  // useRfq subscribes to Omniston Observable and exposes data via react-query
  const { data: quoteData, isLoading: quoteLoading } = useRfq(quoteRequest, {
    enabled: !!quoteRequest && connectionStatus === 'connected',
  })

  const swap = () => {
    setFromChain(c => c === 'TON' ? 'Polygon' : 'TON')
    setToken('USDC')
    setAmount('')
    setDebouncedAmount('')
  }

  const startBridge = () => {
    if (!parseFloat(amount)) return
    setStep(0)
    const advance = (i) => {
      if (i <= 4) setTimeout(() => { setStep(i); advance(i + 1) }, i === 4 ? 0 : 1600)
    }
    advance(1)
  }

  const reset = () => { setStep(null); setAmount(''); setDebouncedAmount('') }

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
            <div className="flex items-center gap-2">
              <ChainCard label="From" chain={fromChain} />
              <button
                onClick={swap}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
                style={{ background: '#1a2235', border: '1px solid #2a3a55' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#0098ea'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#2a3a55'}
              >
                <ArrowLeftRight className="w-4 h-4 text-dim" />
              </button>
              <ChainCard label="To" chain={toChain} />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-dim block mb-1.5">Asset</label>
                <select value={token} onChange={e => setToken(e.target.value)} className="input-field w-full">
                  {bridgeTokens.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-dim block mb-1.5">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="input-field w-full mono text-lg"
                />
              </div>
            </div>

            <QuotePanel
              quoteData={quoteData}
              quoteLoading={quoteLoading}
              token={token}
              fromChain={fromChain}
              toChain={toChain}
              inputAmount={debouncedAmount}
            />

            <div className="flex gap-2 text-xs text-dim">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <p>Quotes sourced live from Omniston (<code>wss://omni-ws.ston.fi</code>). Funds are locked in the source vault and released on destination — non-custodial.</p>
            </div>

            {wallet.connected ? (
              <button
                onClick={startBridge}
                disabled={!parseFloat(amount)}
                className="btn-primary w-full text-center"
              >
                Bridge {token} → {toChain}
              </button>
            ) : (
              <button onClick={onConnectWallet} className="btn-primary w-full text-center">
                Connect Wallet to Bridge
              </button>
            )}
          </>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              {step < 4
                ? <Loader2 className="w-10 h-10 text-ton animate-spin mx-auto mb-3" />
                : <CheckCircle2 className="w-10 h-10 text-gain mx-auto mb-3" />}
              <p className="font-semibold text-white">{step < 4 ? 'Bridging via Omniston…' : 'Bridge complete!'}</p>
              {step < 4 && <p className="text-xs text-dim mt-1">Do not close this window</p>}
            </div>
            <div className="space-y-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-3">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                    style={{
                      background:   i < step ? '#00d4aa' : i === step ? '#0098ea' : '#1a2235',
                      border: `1px solid ${i < step ? '#00d4aa' : i === step ? '#0098ea' : '#2a3a55'}`,
                    }}
                  >
                    {i < step ? '✓' : i === step ? <Loader2 className="w-3 h-3 animate-spin" /> : i + 1}
                  </div>
                  <span className="text-sm" style={{ color: i < step ? '#00d4aa' : i === step ? '#e2e8f0' : '#4a5e7a' }}>{s}</span>
                </div>
              ))}
            </div>
            {step === 4 && (
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
            ['TON → Polygon', 'USDC, USDT, TON, WETH, WBTC'],
            ['Polygon → TON', 'USDC, USDT, WETH, WBTC, MATIC'],
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
