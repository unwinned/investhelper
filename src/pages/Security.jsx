import { Shield, Activity, Lock, CheckCircle2, AlertTriangle, Info, ExternalLink, Clock } from 'lucide-react'
import { SECURITY_DATA } from '../data.js'

function fmtNum(n) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toLocaleString()}`
}

function EventIcon({ type }) {
  if (type === 'warning') return <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0 mt-0.5" />
  if (type === 'success')  return <CheckCircle2  className="w-4 h-4 text-gain flex-shrink-0 mt-0.5" />
  return <Info className="w-4 h-4 text-dim flex-shrink-0 mt-0.5" />
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-dim mb-1">{label}</div>
      <div className="mono text-2xl font-bold" style={{ color: color || '#e2e8f0' }}>{value}</div>
      {sub && <div className="text-xs text-dim mt-0.5">{sub}</div>}
    </div>
  )
}

const d = SECURITY_DATA

export default function Security() {
  return (
    <div className="space-y-5">
      {/* TonSec status */}
      <div
        className="flex items-center justify-between px-5 py-4 rounded-xl"
        style={{ background: 'rgba(0,212,170,0.07)', border: '1px solid rgba(0,212,170,0.25)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,212,170,0.15)' }}>
            <Shield className="w-5 h-5 text-gain" />
          </div>
          <div>
            <div className="font-semibold text-white">TonSec — {d.tonsecStatus}</div>
            <div className="text-xs text-dim">Runtime screening · Formal verification · Anomaly detection</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gain animate-pulse" />
          <span className="text-xs font-semibold text-gain">All systems operational</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Vault health"
          value={`${d.vaultHealth}%`}
          sub="Across all active vaults"
          color="#00d4aa"
        />
        <MetricCard
          label="Insurance fund"
          value={fmtNum(d.insuranceFund)}
          sub="Covers smart contract exploits"
          color="#0098ea"
        />
        <MetricCard
          label="Transactions screened"
          value={d.totalScreened.toLocaleString()}
          sub={`${d.anomaliesDetected} anomalies detected`}
          color="#e2e8f0"
        />
        <MetricCard
          label="Paused contracts"
          value={d.pausedContracts}
          sub="Auto-pause on anomaly detection"
          color={d.pausedContracts > 0 ? '#ef4444' : '#00d4aa'}
        />
      </div>

      {/* Security model */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-ton" />
          Security architecture
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              title: 'Runtime transaction screening',
              body: 'Every transaction routed through InvestHelper vaults is screened by TonSec in real time. Suspicious patterns trigger an automatic pause.',
            },
            {
              title: 'Formal FunC contract verification',
              body: 'All TON (FunC) smart contracts are formally verified by TonSec before deployment. Properties like fund isolation and reentrancy safety are proven, not tested.',
            },
            {
              title: `${d.timelockHours}h timelock on parameter changes`,
              body: 'Any change to fee rates, rebalancing thresholds, or protocol integrations is subject to a 48-hour timelock. Users can exit before changes take effect.',
            },
            {
              title: `${d.multiSig} multisig for upgrades`,
              body: 'Contract upgrades require 3-of-5 multisig approval. Signers are distributed across separate infrastructure to prevent single-point compromise.',
            },
          ].map(({ title, body }) => (
            <div key={title} className="card-surface p-3">
              <div className="text-sm font-semibold text-gray-200 mb-1">{title}</div>
              <p className="text-xs text-dim leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Audits */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b" style={{ borderColor: '#1e293b' }}>
          <h3 className="font-semibold text-gray-200 flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-ton" />
            Audit reports
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Firm', 'Date', 'Scope', 'Status', 'Findings'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#4a5e7a' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.audits.map((a, i) => (
              <tr
                key={a.firm}
                style={{ borderBottom: '1px solid #111e31', background: i % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent' }}
              >
                <td className="px-4 py-2.5 font-medium text-gray-200">{a.firm}</td>
                <td className="px-4 py-2.5 mono text-dim text-xs">{a.date}</td>
                <td className="px-4 py-2.5 text-dim text-xs">{a.scope}</td>
                <td className="px-4 py-2.5">
                  <span className={`pill ${a.status === 'Passed' ? 'pill-green' : a.status === 'Active' ? 'pill-blue' : 'pill-yellow'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-dim">{a.findings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Event log */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-ton" />
          Recent security events
        </h3>
        <div className="space-y-3">
          {d.events.map((ev, i) => (
            <div key={i} className="flex gap-3">
              <EventIcon type={ev.type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300">{ev.msg}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 text-xs text-dim">
                <Clock className="w-3 h-3" />
                {ev.date}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-dim text-center">
        Security measures reduce risk but do not eliminate it. DeFi protocols carry inherent smart contract and market risks. InvestHelper vaults are non-custodial — your assets are never held by InvestHelper.
      </p>
    </div>
  )
}
