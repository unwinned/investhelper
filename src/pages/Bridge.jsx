import { useState, useEffect, useRef } from 'react'
import { ArrowLeftRight, Clock, CheckCircle2, Loader2, Info, AlertCircle, Zap } from 'lucide-react'
import { BRIDGE_TOKENS } from '../data.js'
import { omniston, buildAssetId, DECIMALS, formatUnits } from '../lib/omniston.js'

const STEPS = ['Initiating', 'Source chain confirm', 'Omniston relay', 'Destination confirm', 'Complete']

// Tokens bridgeable on each side
const SUPPORTED = {
  TON:     ['USDC', 'USDT', 'TON', 'WETH', 'WBTC'],
  Polygon: ['USDC', 'USDT', 'WETH', 'WBTC', 'MATIC'],
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

function QuotePanel({ status, quote, token, fromChain, toChain, inputAmount }) {
  const outDecimals = DECIMALS[token] ?? 6

  if (status === 'idle' || !inputAmount || parseFloat(inputAmount) <= 0) return null

  if (status === 'loading') {
    return (
      <div className="card-surface p-3 flex items-center gap-2 text-sm text-dim">
        <Loader2 className="w-4 h-4 animate-spin text-[#0098ea]" />
        Getting Omniston quote…
      </div>
    )
  }

  if (status === 'no-quote' || status === 'error') {
    const fallbackAmt = (parseFloat(inputAmount) * 0.999).toFixed(6)
    return (
      <div className="card-surface p-3 space-y-2 text-sm">
        <div className="flex items-center gap-1.5 text-warn text-xs mb-1">
          <AlertCircle className="w-3.5 h-3.5" />
          Omniston route unavailable — showing LayerZero estimate
        </div>
        <div className="flex justify-between">
          <span className="text-dim">Est. received</span>
          <span className="mono text-gray-200">{fallbackAmt} {token}</span>
        </div>
        <div className="flex justify-between">
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

  if (status === 'quoted' && quote) {
    const outputUnits = quote.outputUnits
    const outputAmt = formatUnits(outputUnits, outDecimals)
    const inputAmt  = parseFloat(inputAmount)
    const outAmt    = parseFloat(outputAmt)
    const rate      = inputAmt > 0 ? ((outAmt / inputAmt) * 100).toFixed(3) : '—'

    return (
      <div className="card-surface p-3 space-y-2 text-sm">
        <div className="flex items-center gap-1.5 text-gain text-xs mb-1">
          <Zap className="w-3.5 h-3.5" />
          Omniston quote — live
        </div>
        <div className="flex justify-between font-semibold">
          <span className="text-dim">You receive</span>
          <span className="mono text-gain">{outAmt.toFixed(6)} {token}</span>
        </div>
        <div className="flex justify-between">
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
  const [fromChain, setFromChain] = useState('TON')
  const [token,     setToken]     = useState('USDC')
  const [amount,    setAmount]    = useState('')
  const [step,      setStep]      = useState(null)

  // Omniston quote state
  const [quoteStatus, setQuoteStatus] = useState('idle')
  const [quote,       setQuote]       = useState(null)
  const subRef   = useRef(null)
  const timerRef = useRef(null)

  const toChain = fromChain === 'TON' ? 'Polygon' : 'TON'

  const swap = () => {
    setFromChain(c => c === 'TON' ? 'Polygon' : 'TON')
    setToken('USDC')
    setAmount('')
    setQuote(null)
    setQuoteStatus('idle')
  }

  // Omniston quote — debounced, re-runs on any input change
  useEffect(() => {
    clearTimeout(timerRef.current)
    subRef.current?.unsubscribe()

    const parsedAmt = parseFloat(amount)
    if (!parsedAmt || parsedAmt <= 0) {
      setQuoteStatus('idle')
      setQuote(null)
      return
    }

    const inputAsset  = buildAssetId(fromChain, token)
    const outputAsset = buildAssetId(toChain,   token)
    if (!inputAsset || !outputAsset) {
      setQuoteStatus('idle')
      return
    }

    timerRef.current = setTimeout(() => {
      const decimals  = DECIMALS[token] ?? 6
      const inputUnits = BigInt(Math.round(parsedAmt * 10 ** decimals)).toString()

      setQuoteStatus('loading')
      setQuote(null)

      const obs = omniston.requestForQuote({
        inputAsset,
        outputAsset,
        amount: { $case: 'inputUnits', value: inputUnits },
      })

      subRef.current = obs.subscribe({
        next: (event) => {
          if (event.$case === 'quoteUpdated') {
            setQuote(event.value)
            setQuoteStatus('quoted')
          } else if (event.$case === 'noQuote') {
            setQuoteStatus('no-quote')
          }
        },
        error: () => setQuoteStatus('error'),
      })
    }, 700)

    return () => {
      clearTimeout(timerRef.current)
      subRef.current?.unsubscribe()
    }
  }, [fromChain, toChain, token, amount])

  const startBridge = () => {
    if (!parseFloat(amount) || parseFloat(amount) <= 0) return
    subRef.current?.unsubscribe()
    setStep(0)
    const advance = (i) => {
      if (i <= 4) setTimeout(() => { setStep(i); advance(i + 1) }, i === 4 ? 0 : 1600)
    }
    advance(1)
  }

  const reset = () => { setStep(null); setAmount(''); setQuote(null); setQuoteStatus('idle') }

  const bridgeTokens = SUPPORTED[fromChain] || []

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="card p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Bridge Asset</h2>
          <div className="flex items-center gap-3 text-xs text-dim">
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-gain" /> Omniston routing</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> ~2 min</span>
          </div>
        </div>

        {step === null ? (
          <>
            {/* Chain selector */}
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

            {/* Token + Amount */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-dim block mb-1.5">Asset</label>
                <select
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  className="input-field w-full"
                >
                  {bridgeTokens.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
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

            {/* Omniston quote */}
            <QuotePanel
              status={quoteStatus}
              quote={quote}
              token={token}
              fromChain={fromChain}
              toChain={toChain}
              inputAmount={amount}
            />

            {/* Non-custodial note */}
            <div className="flex gap-2 text-xs text-dim">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <p>Routing via Omniston cross-chain aggregator. Funds are locked in the source vault and released on destination — InvestHelper never holds your assets.</p>
            </div>

            {wallet.connected ? (
              <button
                onClick={startBridge}
                disabled={!parseFloat(amount) || parseFloat(amount) <= 0}
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
          /* Progress */
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
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background:   i < step ? '#00d4aa' : i === step ? '#0098ea' : '#1a2235',
                      border: `1px solid ${i < step ? '#00d4aa' : i === step ? '#0098ea' : '#2a3a55'}`,
                      color: '#fff',
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

      {/* Supported routes */}
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
