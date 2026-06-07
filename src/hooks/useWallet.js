import { useState, useCallback } from 'react'
import { useTonAddress, useTonWallet, useTonConnectUI } from '@tonconnect/ui-react'

export function useWallet() {
  const tonAddress  = useTonAddress(true)  // user-friendly format (EQ.../UQ...)
  const tonWallet   = useTonWallet()
  const [tonConnectUI] = useTonConnectUI()
  const [polyAddr, setPolyAddr] = useState(null)

  const wallet = tonAddress
    ? { connected: true, address: tonAddress, chain: 'TON',     walletName: tonWallet?.name ?? 'TON Wallet' }
    : polyAddr
    ? { connected: true, address: polyAddr,   chain: 'Polygon', walletName: 'MetaMask' }
    : { connected: false, address: null, chain: null, walletName: null }

  const openTonModal = useCallback(() => {
    tonConnectUI.openModal()
  }, [tonConnectUI])

  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum) throw new Error('MetaMask not detected. Install the extension and refresh.')
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    if (!accounts[0]) throw new Error('No account returned by MetaMask.')
    setPolyAddr(accounts[0])
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }], // Polygon
      })
    } catch (_) { /* user may decline chain switch */ }
  }, [])

  const disconnect = useCallback(() => {
    if (tonAddress) {
      tonConnectUI.disconnect()
    } else {
      setPolyAddr(null)
    }
  }, [tonAddress, tonConnectUI])

  return { wallet, openTonModal, connectMetaMask, disconnect }
}
