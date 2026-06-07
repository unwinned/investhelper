import { useState, useCallback } from 'react'
import { useTonAddress, useTonWallet, useTonConnectUI } from '@tonconnect/ui-react'

export function useWallet() {
  const tonAddress     = useTonAddress(true)
  const tonWalletInfo  = useTonWallet()
  const [tonConnectUI] = useTonConnectUI()
  const [polyAddr, setPolyAddr] = useState(null)

  const tonWallet = tonAddress
    ? { connected: true,  address: tonAddress, walletName: tonWalletInfo?.name ?? 'TON Wallet', chain: 'TON' }
    : { connected: false, address: null,        walletName: null,                                chain: 'TON' }

  const evmWallet = polyAddr
    ? { connected: true,  address: polyAddr, walletName: 'MetaMask', chain: 'EVM' }
    : { connected: false, address: null,     walletName: null,       chain: 'EVM' }

  const openTonModal = useCallback(() => tonConnectUI.openModal(), [tonConnectUI])

  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum) throw new Error('MetaMask not detected. Install the extension and refresh.')
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    if (!accounts[0]) throw new Error('No account returned by MetaMask.')
    setPolyAddr(accounts[0])
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }],
      })
    } catch (_) {}
  }, [])

  const disconnectTon  = useCallback(() => tonConnectUI.disconnect(), [tonConnectUI])
  const disconnectEVM  = useCallback(() => setPolyAddr(null), [])

  return { tonWallet, evmWallet, openTonModal, connectMetaMask, disconnectTon, disconnectEVM }
}
