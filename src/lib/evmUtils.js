// Low-level EVM helpers — no cross-module imports.
// Both balances.js and evmSigning.js import from here.

const CHAIN_CONFIGS = {
  '0x89': {
    chainId: '0x89',
    chainName: 'Polygon Mainnet',
    rpcUrls: ['https://polygon-rpc.com'],
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    blockExplorerUrls: ['https://polygonscan.com'],
  },
  '0x2105': {
    chainId: '0x2105',
    chainName: 'Base',
    rpcUrls: ['https://mainnet.base.org'],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrls: ['https://basescan.org'],
  },
  '0x38': {
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    rpcUrls: ['https://bsc-dataseed.binance.org'],
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    blockExplorerUrls: ['https://bscscan.com'],
  },
}

export async function ensureChain(hexChainId) {
  if (!window.ethereum) throw new Error('No wallet found')
  const current = await window.ethereum.request({ method: 'eth_chainId' })
  if (current.toLowerCase() === hexChainId.toLowerCase()) return
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexChainId }] })
  } catch (err) {
    if (err?.code === 4902) {
      const cfg = CHAIN_CONFIGS[hexChainId]
      if (!cfg) throw new Error(`Unknown chain ${hexChainId}`)
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [cfg] })
    } else {
      const name = CHAIN_CONFIGS[hexChainId]?.chainName ?? hexChainId
      throw new Error(`Please switch MetaMask to ${name}`)
    }
  }
}

export const ensurePolygon = () => ensureChain('0x89')
export const ensureBase    = () => ensureChain('0x2105')
export const ensureBNB     = () => ensureChain('0x38')

export const CHAIN_ENSURE = {
  Polygon: ensurePolygon,
  Base:    ensureBase,
  BNB:     ensureBNB,
}

export const CHAIN_EXPLORER = {
  Polygon: 'https://polygonscan.com',
  Base:    'https://basescan.org',
  BNB:     'https://bscscan.com',
}

export const CHAIN_NATIVE = {
  Polygon: 'MATIC',
  Base:    'ETH',
  BNB:     'BNB',
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
