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
  const { wallet, openTonModal, connectMetaMask, disconnect } = useWallet()
  const [tab, setTab]                   = useState('Pools')
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [activeStrategy, setActiveStrategy]   = useState(null)

  const openWalletModal = () => setWalletModalOpen(true)

  const page = () => {
    switch (tab) {
      case 'Pools':      return <Pools wallet={wallet} />
      case 'Lending':    return <Lending wallet={wallet} />
      case 'Strategies': return <Strategies wallet={wallet} activeStrategy={activeStrategy} setActiveStrategy={setActiveStrategy} onConnectWallet={openWalletModal} />
      case 'Bridge':     return <Bridge wallet={wallet} onConnectWallet={openWalletModal} />
      case 'Security':   return <Security />
      default:           return <Pools wallet={wallet} />
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0f1e' }}>
      <Header
        tab={tab}
        setTab={setTab}
        wallet={wallet}
        onConnectWallet={openWalletModal}
        onDisconnect={disconnect}
      />
      <main className="max-w-7xl mx-auto px-4 pb-12 pt-6">
        {page()}
      </main>
      {walletModalOpen && (
        <WalletModal
          onClose={() => setWalletModalOpen(false)}
          openTonModal={() => { openTonModal(); setWalletModalOpen(false) }}
          connectMetaMask={connectMetaMask}
          onConnected={() => setWalletModalOpen(false)}
        />
      )}
    </div>
  )
}
