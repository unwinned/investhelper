import { useState, useCallback } from 'react'
import { useTonConnectUI } from '@tonconnect/ui-react'
import { CheckCircle2, AlertTriangle, X, Zap, Shield, TrendingUp, Flame, Loader2, ExternalLink, ArrowDownCircle, RefreshCw } from 'lucide-react'
import { TON_STRATEGIES, POLYGON_STRATEGIES, BASE_STRATEGIES, BNB_STRATEGIES } from '../data.js'
import { buildTonStrategyTx } from '../lib/tonSigning.js'
import { checkStrategyApprovals, approveERC20, executePolygonStrategy, executeEVMStrategy, executeEVMWithdrawal } from '../lib/evmSigning.js'
import { CHAIN_ENSURE, CHAIN_EXPLORER, waitForReceipt } from '../lib/evmUtils.js'
import { checkEVMBalances, fmtUSD } from '../lib/balances.js'
import { toNano } from '@ton/core'

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
  Polygon: 'Strategies use AAVE v3 pool · QuickSwap v2 router · Balancer vault. Tokens are approved to Multicall3 which pulls, re-approves protocols, and deposits — all in one transaction.',
  Base:    'Strategies use AAVE v3 on Base · Aerodrome (Velodrome fork) router. Tokens are approved to Multicall3 — all positions deployed in one transaction.',
  BNB:     'Strategies use AAVE v3 on BNB Chain · PancakeSwap v2 router. Tokens are approved to Multicall3 — all positions deployed in one transaction.',
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

// ─── TON Activate Modal ───────────────────────────────────────────────────

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

// ─── EVM Activate Modal (Polygon / Base / BNB) ────────────────────────────

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

// ─── Withdrawal Modal ─────────────────────────────────────────────────────

function WithdrawalModal({ strategy, wallet, onClose, onDeactivate }) {
  const [step,   setStep]   = useState('confirm')
  const [error,  setError]  = useState(null)
  const [txHash, setTxHash] = useState(null)

  const isTON    = strategy.chain === 'TON'
  const explorer = CHAIN_EXPLORER[strategy.chain]

  const execute = useCallback(async () => {
    setStep('withdrawing')
    setError(null)
    try {
      if (isTON) {
        throw new Error('TON withdrawal UI coming soon — use your wallet directly.')
      }
      const { txHash: hash } = await executeEVMWithdrawal(strategy.chain, strategy.id, wallet.address)
      setTxHash(hash)
      setStep('done')
      setTimeout(() => { onDeactivate(strategy.id); onClose() }, 2000)
    } catch (e) {
      setError(e?.message ?? 'Withdrawal failed')
      setStep('error')
    }
  }, [strategy.id, strategy.chain, wallet.address, isTON, onDeactivate, onClose])

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
                  <p className="text-dim">This will exit all positions in this strategy and return tokens to your wallet.</p>
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

              {isTON && (
                <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(0,152,234,0.06)', border: '1px solid rgba(0,152,234,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 text-ton flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-dim">TON liquid staking protocols may have an unbonding period before funds are available.</p>
                </div>
              )}

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
              <p className="text-xs text-dim">Querying positions and preparing exit transaction</p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <CheckCircle2 className="w-10 h-10 text-gain" />
              <p className="text-sm font-semibold text-gray-200">Funds returned to wallet</p>
              {txHash && explorer && (
                <a
                  href={`${explorer}/tx/${txHash}`}
                  target="_blank" rel="noreferrer"
                  className="text-xs text-ton flex items-center gap-1"
                >
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

// ─── Strategy Card ────────────────────────────────────────────────────────

function StrategyCard({ s, isActive, tonWallet, evmWallet, onActivate, onDeactivate, onConnectTon, onConnectEVM }) {
  const [showActivate, setShowActivate] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const { icon: Icon, pillClass } = TIER_META[s.tier] || {}
  const isTON  = s.chain === 'TON'
  const wallet = isTON ? tonWallet : evmWallet

  const chainColor = CHAIN_TABS.find(c => c.id === s.chain)?.color ?? '#8247e5'

  return (
    <>
      <div
        className="card p-5 flex flex-col gap-4 transition-all"
        style={isActive ? { borderColor: s.color, boxShadow: `0 0 0 1px ${s.color}30` } : {}}
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

        {isActive ? (
          <button
            onClick={() => setShowWithdraw(true)}
            className="w-full text-center text-sm py-2 rounded-lg font-semibold transition-all mt-auto"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
          >
            Deactivate &amp; Withdraw
          </button>
        ) : wallet.connected ? (
          <button
            onClick={() => setShowActivate(true)}
            className="w-full text-center text-sm py-2 rounded-lg font-semibold transition-all mt-auto"
            style={{ background: s.color + '20', border: `1px solid ${s.color}60`, color: s.color }}
            onMouseEnter={e => { e.currentTarget.style.background = s.color + '35' }}
            onMouseLeave={e => { e.currentTarget.style.background = s.color + '20' }}
          >
            Activate Strategy
          </button>
        ) : (
          <button
            onClick={isTON ? onConnectTon : onConnectEVM}
            className="btn-outline w-full text-center text-sm mt-auto"
          >
            Connect {isTON ? 'TON' : 'EVM'} Wallet
          </button>
        )}
      </div>

      {showActivate && (
        isTON
          ? <TonActivateModal
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
        <WithdrawalModal
          strategy={s} wallet={wallet}
          onClose={() => setShowWithdraw(false)}
          onDeactivate={onDeactivate}
        />
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

const STRATEGIES_BY_CHAIN = {
  TON:     TON_STRATEGIES,
  Polygon: POLYGON_STRATEGIES,
  Base:    BASE_STRATEGIES,
  BNB:     BNB_STRATEGIES,
}

const ALL_STRATEGIES = [...TON_STRATEGIES, ...POLYGON_STRATEGIES, ...BASE_STRATEGIES, ...BNB_STRATEGIES]

export default function Strategies({ tonWallet, evmWallet, activeStrategy, setActiveStrategy, onConnectTon, onConnectEVM }) {
  const [chainTab, setChainTab] = useState('TON')

  const handleDeactivate = () => setActiveStrategy(null)

  const strategies = STRATEGIES_BY_CHAIN[chainTab] ?? []
  const activeS    = ALL_STRATEGIES.find(s => s.id === activeStrategy)

  return (
    <div className="space-y-5">
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
        {CHAIN_TABS.map(({ id, label, color, bg }) => (
          <button
            key={id}
            onClick={() => setChainTab(id)}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: chainTab === id ? bg : '#1a2235',
              border: `1px solid ${chainTab === id ? color : '#2a3a55'}`,
              color: chainTab === id ? color : '#8b9dc3',
            }}
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
