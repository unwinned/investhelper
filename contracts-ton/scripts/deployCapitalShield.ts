import { toNano, Address } from '@ton/core'
import { IHCapitalShieldVault } from '../wrappers/IHCapitalShieldVault'
import { compile, NetworkProvider } from '@ton/blueprint'

export async function run(provider: NetworkProvider) {
  const ownerAddress = provider.sender().address
  if (!ownerAddress) throw new Error('No sender address — make sure your wallet is connected')

  console.log('Deploying IHCapitalShieldVault...')
  console.log('Owner:', ownerAddress.toString({ bounceable: false }))

  const code = await compile('IHCapitalShieldVault')
  const vault = provider.open(
    IHCapitalShieldVault.createFromConfig({ owner: ownerAddress }, code),
  )

  await vault.sendDeposit(provider.sender(), '0.05')
  await provider.waitForDeploy(vault.address)

  console.log('\n✅ IHCapitalShieldVault deployed!')
  console.log('Address:', vault.address.toString({ bounceable: true, urlSafe: true }))
  console.log('\nNext steps:')
  console.log('1. Find the vault\'s tsTON jetton wallet (call get_wallet_address on tsTON minter)')
  console.log('   tsTON master: EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav')
  console.log('   stTON master: EQDNhy-nxYFgUqzfUzImBEP67JqsyMIcyk2S5_RwNNEYku0k')
  console.log('2. Run: npm run set-wallets:shield')
  console.log('3. Update src/lib/contracts.js: TON.IH_CAPITAL_SHIELD_VAULT =', `'${vault.address.toString({ bounceable: true, urlSafe: true })}'`)
}
