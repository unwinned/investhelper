import { useState } from 'react'
import { CheckCircle2, AlertTriangle, X, Zap, Shield, TrendingUp, Flame, Loader2 } from 'lucide-react'
import { STRATEGIES } from '../data.js'

const TIER_META = {
  'Super Safe':  { icon: Shield,     pillClass: 'pill-green'  },
  'Safe':        { icon: TrendingUp, pillClass: 'pill-blue'   },
  'Middle':      { icon: Zap,        pillClass: 'pill-orange' },
  'Alpha Seeker':{ icon: Flame,      pillClass: 'pill-red'    },
}

function RiskDots({ score }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4].map(n => (
        <span
          key={n}
          className="w-2.5 h-2.5 rounded-full"
          style={{
            background: n <= score
              ? score === 1 ? '#00d4aa' : score === 2 ? '#0098ea' : score === 3 ? '#f97316' : '#ef4444'
              : '#1e2d45',
          }}
        />
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

function ActivateModal({ strategy, wallet, onClose, onActivate }) {
  const [step, setStep]       = useState('confirm') // confirm | signing | done
  const [chain, setChain]     = useState(strategy.chains[0])

  const proceed = () => {
    setStep('signing')
    setTimeout(() => {
      setStep('done')
      setTimeout(() => {
        onActivate(strategy.id)
        onClose()
      }, 1200)
    }, 1800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl" style={{ background: '#111827', border: '1px solid #1e293b' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#1e293b' }}>
          <h2 className="font-semibold text-white">Activate {strategy.name}</h2>
          {step !== 'signing' && <button onClick={onClose} className="text-dim hover:text-white"><X className="w-4 h-4" /></button>}
        </div>

        <div className="p-5">
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="card-surface p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-dim">Strategy</span>
                  <span className="text-gray-200 font-medium">{strategy.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-dim">Est. APY</span>
                  <span className="font-semibold mono" style={{ color: strategy.color }}>{strategy.apyMin}–{strategy.apyMax}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-dim">Protocols</span>
                  <span className="text-gray-200">{strategy.protocols.join(', ')}</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-dim block mb-1.5">Entry chain</label>
                <div className="flex gap-2">
                  {strategy.chains.map(c => (
                    <button
                      key={c}
                      onClick={() => setChain(c)}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: chain === c ? (c === 'TON' ? 'rgba(0,152,234,0.2)' : 'rgba(130,71,229,0.2)') : '#1a2235',
                        border: `1px solid ${chain === c ? (c === 'TON' ? '#0098ea' : '#8247e5') : '#2a3a55'}`,
                        color: chain === c ? (c === 'TON' ? '#0098ea' : '#8247e5') : '#8b9dc3',
                      }}
                    >{c}</button>
                  ))}
                </div>
              </div>

              {strategy.ilRisk && (
                <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-warn">This strategy exposes you to impermanent loss. When pool assets diverge in price, your position may be worth less than holding assets directly.</p>
                </div>
              )}
              {strategy.liquidationRisk && (
                <div className="flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-danger">Leveraged positions in this strategy can be liquidated. Full capital loss is possible.</p>
                </div>
              )}

              <p className="text-xs text-dim">One wallet signature per chain to authorize the vault. Rebalancing is automated — no further actions needed.</p>

              <button onClick={proceed} className="btn-primary w-full text-center">
                Sign &amp; Activate on {chain}
              </button>
            </div>
          )}

          {step === 'signing' && (
            <div className="py-8 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-ton animate-spin" />
              <p className="text-sm text-gray-300">Waiting for wallet signature…</p>
              <p className="text-xs text-dim">Check your {wallet.walletName || 'wallet'} for a signature request</p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-8 flex flex-col items-center gap-4">
              <CheckCircle2 className="w-10 h-10 text-gain" />
              <p className="text-sm font-semibold text-gray-200">Strategy activated!</p>
              <p className="text-xs text-dim text-center">Your vault is live. InvestHelper will rebalance automatically based on yield opportunities.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Strategies({ wallet, activeStrategy, setActiveStrategy, onConnectWallet }) {
  const [modalStrategy, setModalStrategy] = useState(null)

  const handleActivate = (id) => {
    setActiveStrategy(id)
  }

  const handleDeactivate = (id) => {
    setActiveStrategy(prev => prev === id ? null : prev)
  }

  return (
    <div className="space-y-5">
      {activeStrategy && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.25)' }}>
          <CheckCircle2 className="w-4 h-4 text-gain flex-shrink-0" />
          <p className="text-sm text-gray-200">
            <span className="font-semibold text-gain">{STRATEGIES.find(s => s.id === activeStrategy)?.name}</span>
            {' '}is active — rebalancing automatically.
          </p>
          <button onClick={() => handleDeactivate(activeStrategy)} className="ml-auto text-xs btn-outline py-1">Deactivate</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STRATEGIES.map(s => {
          const { icon: Icon, pillClass } = TIER_META[s.tier] || {}
          const isActive = activeStrategy === s.id

          return (
            <div
              key={s.id}
              className="card p-5 flex flex-col gap-4 transition-all"
              style={isActive ? { borderColor: s.color, boxShadow: `0 0 0 1px ${s.color}30` } : {}}
            >
              {/* Header */}
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
                  <div className="mono font-bold text-xl" style={{ color: s.color }}>
                    {s.apyMin}–{s.apyMax}%
                  </div>
                  <div className="text-xs text-dim">Est. APY</div>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-dim leading-relaxed">{s.description}</p>

              {/* Allocation */}
              <AllocationBar allocation={s.allocation} />

              {/* Meta */}
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

              {/* Protocols */}
              <div className="flex gap-1.5 flex-wrap">
                {s.protocols.map(p => (
                  <span key={p} className="pill pill-gray">{p}</span>
                ))}
                {s.chains.map(c => (
                  <span key={c} className={`pill ${c === 'TON' ? 'pill-ton' : 'pill-poly'}`}>{c}</span>
                ))}
              </div>

              {/* Action */}
              {isActive ? (
                <button
                  onClick={() => handleDeactivate(s.id)}
                  className="btn-outline w-full text-center text-sm mt-auto"
                >
                  Deactivate
                </button>
              ) : wallet.connected ? (
                <button
                  onClick={() => setModalStrategy(s)}
                  className="w-full text-center text-sm py-2 rounded-lg font-semibold transition-all mt-auto"
                  style={{ background: s.color + '20', border: `1px solid ${s.color}60`, color: s.color }}
                  onMouseEnter={e => { e.currentTarget.style.background = s.color + '35' }}
                  onMouseLeave={e => { e.currentTarget.style.background = s.color + '20' }}
                >
                  Activate Strategy
                </button>
              ) : (
                <button onClick={onConnectWallet} className="btn-outline w-full text-center text-sm mt-auto">
                  Connect Wallet to Activate
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-dim text-center">
        All four strategies are identical for every user — no personalization. APY ranges are estimates based on current pool conditions and may change. Not financial advice.
      </p>

      {modalStrategy && (
        <ActivateModal
          strategy={modalStrategy}
          wallet={wallet}
          onClose={() => setModalStrategy(null)}
          onActivate={handleActivate}
        />
      )}
    </div>
  )
}
