import { IHTonAMMVault } from '../wrappers/IHTonAMMVault'
import { compile, NetworkProvider } from '@ton/blueprint'
import { toNano, Address } from '@ton/core'

// STON.fi router v2.1 — fetch its USDT wallet after deploy and call setRouterWallet
const STONFI_ROUTER_V2_1 = 'EQBCl1JANkTpMpJ9N3lZktPMpp2btRe2vVwHon0la8ibRied'
const JUSDT_MASTER       = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'

export async function run(provider: NetworkProvider) {
  const ownerAddress = provider.sender().address
  if (!ownerAddress) throw new Error('No sender address')

  console.log('Deploying IHTonAMMVault...')

  const code = await compile('IHTonAMMVault')
  const vault = provider.open(
    IHTonAMMVault.createFromConfig({ owner: ownerAddress }, code),
  )

  await vault.sendDeposit(provider.sender(), '0.05')
  await provider.waitForDeploy(vault.address)

  const vaultAddr = vault.address.toString({ bounceable: true, urlSafe: true })
  console.log('\n✅ IHTonAMMVault deployed!')
  console.log('Address:', vaultAddr)
  console.log('\nNext steps:')
  console.log('1. Resolve STON.fi router\'s USDT jetton wallet:')
  console.log('   GET https://tonapi.io/v2/blockchain/accounts/' + STONFI_ROUTER_V2_1 + '/methods/get_wallet_address')
  console.log('   args: jUSDT master =', JUSDT_MASTER)
  console.log('2. Call sendSetRouterWallet with the resolved address')
  console.log('3. Update src/lib/contracts.js: TON.IH_AMM_VAULT =', `'${vaultAddr}'`)
}
