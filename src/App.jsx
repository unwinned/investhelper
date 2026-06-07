import { useState } from 'react'
import { useWallet } from './hooks/useWallet.js'
import Header from './components/Header.jsx'
import WalletModal from './components/WalletModal.jsx'
import Pools from './pages/Pools.jsx'
import Lending from './pages/Lending.jsx'
import Strategies from './pages/Strategies.jsx'
import Bridge from './pages/Bridge.jsx'
import Security from './pages/Security.jsx'

export default function App() {
  const {
    tonWallet, evmWallet,
    openTonModal, connectMetaMask,
    disconnectTon, disconnectEVM,
  } = useWallet()

  const [tab,             setTab]             = useState('Pools')
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [activeStrategy,  setActiveStrategy]  = useState(null)

  const page = () => {
    switch (tab) {
      case 'Pools':      return <Pools tonWallet={tonWallet} evmWallet={evmWallet} />
      case 'Lending':    return <Lending tonWallet={tonWallet} evmWallet={evmWallet} />
      case 'Strategies': return (
        <Strategies
          tonWallet={tonWallet}
          evmWallet={evmWallet}
          activeStrategy={activeStrategy}
          setActiveStrategy={setActiveStrategy}
          onConnectTon={() => { setWalletModalOpen(false); openTonModal() }}
          onConnectEVM={() => setWalletModalOpen(true)}
        />
      )
      case 'Bridge':   return <Bridge tonWallet={tonWallet} evmWallet={evmWallet} onOpenWallets={() => setWalletModalOpen(true)} />
      case 'Security': return <Security />
      default:         return <Pools tonWallet={tonWallet} evmWallet={evmWallet} />
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0f1e' }}>
      <Header
        tab={tab}
        setTab={setTab}
        tonWallet={tonWallet}
        evmWallet={evmWallet}
        onConnectTon={openTonModal}
        onConnectEVM={connectMetaMask}
        onDisconnectTon={disconnectTon}
        onDisconnectEVM={disconnectEVM}
      />
      <main className="max-w-7xl mx-auto px-4 pb-12 pt-6">
        {page()}
      </main>
      {walletModalOpen && (
        <WalletModal
          onClose={() => setWalletModalOpen(false)}
          tonWallet={tonWallet}
          evmWallet={evmWallet}
          onConnectTon={() => { setWalletModalOpen(false); openTonModal() }}
          onConnectEVM={connectMetaMask}
          onDisconnectTon={disconnectTon}
          onDisconnectEVM={disconnectEVM}
        />
      )}
    </div>
  )
}
