// Low-level EVM helpers with no cross-module imports.
// Both balances.js and evmSigning.js import from here.

export async function ensurePolygon() {
  if (!window.ethereum) throw new Error('No wallet found')
  const chainId = await window.ethereum.request({ method: 'eth_chainId' })
  if (chainId === '0x89') return
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x89' }],
    })
  } catch (err) {
    if (err?.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x89',
          chainName: 'Polygon Mainnet',
          rpcUrls: ['https://polygon-rpc.com'],
          nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
          blockExplorerUrls: ['https://polygonscan.com'],
        }],
      })
    } else {
      throw new Error('Please switch MetaMask to Polygon network')
    }
  }
}

export async function waitForReceipt(txHash) {
  if (!window.ethereum) throw new Error('No wallet')
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const receipt = await window.ethereum.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    })
    if (receipt?.blockNumber) return receipt
  }
  throw new Error('Transaction not confirmed after 2 minutes')
}
