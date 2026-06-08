/**
 * After deploying IHCapitalShieldVault, run this script to register
 * the vault's tsTON and stTON jetton wallet addresses so it can
 * track and return those tokens correctly.
 *
 * Usage: VAULT_ADDRESS=EQ... npm run set-wallets:shield
 */

import { Address } from '@ton/core'
import { IHCapitalShieldVault } from '../wrappers/IHCapitalShieldVault'
import { NetworkProvider } from '@ton/blueprint'

const TSTON_MASTER = 'EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav'
const STON_MASTER  = 'EQDNhy-nxYFgUqzfUzImBEP67JqsyMIcyk2S5_RwNNEYku0k'

async function getJettonWallet(provider: NetworkProvider, master: string, owner: string): Promise<Address> {
  const url = `https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(master)}/methods/get_wallet_address?args=${encodeURIComponent(owner)}`
  const res = await fetch(url)
  const j = await res.json() as any
  if (j.decoded?.jetton_wallet_address) return Address.parseRaw(j.decoded.jetton_wallet_address)
  throw new Error(`Failed to resolve jetton wallet for master=${master} owner=${owner}: ${JSON.stringify(j)}`)
}

export async function run(provider: NetworkProvider) {
  const vaultAddrStr = process.env.VAULT_ADDRESS
  if (!vaultAddrStr) throw new Error('Set VAULT_ADDRESS env var to the deployed vault address')

  const vault = provider.open(IHCapitalShieldVault.createFromAddress(Address.parse(vaultAddrStr)))
  const vaultStr = vault.address.toString({ bounceable: true, urlSafe: true })

  console.log('Resolving jetton wallets for vault:', vaultStr)

  const [tstonWallet, stonWallet] = await Promise.all([
    getJettonWallet(provider, TSTON_MASTER, vaultStr),
    getJettonWallet(provider, STON_MASTER,  vaultStr),
  ])

  console.log('tsTON wallet:', tstonWallet.toString({ bounceable: true, urlSafe: true }))
  console.log('stTON wallet:', stonWallet.toString({ bounceable: true, urlSafe: true }))

  await vault.sendSetJettonWallets(provider.sender(), { tstonWallet, stonWallet })
  console.log('\n✅ SetJettonWallets sent — wait for confirmation on-chain.')
}
