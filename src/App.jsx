import { useState } from 'react'
import { useWallet } from './hooks/useWallet.js'
import Landing from './pages/Landing.jsx'
import Pools from './pages/Pools.jsx'
import Lending from './pages/Lending.jsx'
import Strategies from './pages/Strategies.jsx'
import Security from './pages/Security.jsx'
import Bridge from './pages/Bridge.jsx'

export default function App() {
  const {
    tonWallet, evmWallet,
    openTonModal, connectMetaMask,
    disconnectTon, disconnectEVM,
  } = useWallet()

  const [landed,         setLanded]         = useState(false)
  const [tab,            setTab]            = useState('Pools')
  const [activeStrategy, setActiveStrategy] = useState(null)

  const goHome = () => setLanded(false)

  if (!landed) {
    return (
      <Landing
        onEnter={(t) => { setTab(t); setLanded(true) }}
        tonWallet={tonWallet}
        evmWallet={evmWallet}
        onConnectTon={openTonModal}
        onConnectEVM={connectMetaMask}
        onDisconnectTon={disconnectTon}
        onDisconnectEVM={disconnectEVM}
      />
    )
  }

  const page = () => {
    switch (tab) {
      case 'Pools':      return <Pools onBack={goHome} />
      case 'Lending':    return <Lending onBack={goHome} />
      case 'Strategies': return (
        <Strategies
          onBack={goHome}
          tonWallet={tonWallet}
          evmWallet={evmWallet}
          activeStrategy={activeStrategy}
          setActiveStrategy={setActiveStrategy}
          onConnectTon={openTonModal}
          onConnectEVM={connectMetaMask}
        />
      )
      case 'Bridge': return (
        <Bridge
          onBack={goHome}
          tonWallet={tonWallet}
          evmWallet={evmWallet}
          onOpenWallets={() => { openTonModal(); connectMetaMask() }}
        />
      )
      case 'Security': return <Security onBack={goHome} />
      default:         return <Pools onBack={goHome} />
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 900, height: 900, borderRadius: '50%', top: '-350px', left: '-300px', background: 'radial-gradient(circle, rgba(130,71,229,0.15) 0%, transparent 65%)', filter: 'blur(110px)' }} />
        <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', bottom: '-250px', right: '-200px', background: 'radial-gradient(circle, rgba(0,152,234,0.13) 0%, transparent 65%)', filter: 'blur(110px)' }} />
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', bottom: '10%', left: '15%', background: 'radial-gradient(circle, rgba(245,158,11,0.09) 0%, transparent 65%)', filter: 'blur(100px)' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', top: '30%', right: '10%', background: 'radial-gradient(circle, rgba(130,71,229,0.10) 0%, transparent 65%)', filter: 'blur(90px)' }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <main className="max-w-7xl mx-auto px-6 pb-12 pt-8">
          {page()}
        </main>
      </div>
    </div>
  )
}
