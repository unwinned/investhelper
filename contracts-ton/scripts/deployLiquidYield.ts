import { IHLiquidYieldVault } from '../wrappers/IHLiquidYieldVault'
import { compile, NetworkProvider } from '@ton/blueprint'
import { toNano } from '@ton/core'

export async function run(provider: NetworkProvider) {
  const ownerAddress = provider.sender().address
  if (!ownerAddress) throw new Error('No sender address')

  console.log('Deploying IHLiquidYieldVault...')

  const code = await compile('IHLiquidYieldVault')
  const vault = provider.open(
    IHLiquidYieldVault.createFromConfig({ owner: ownerAddress }, code),
  )

  await vault.sendDeposit(provider.sender(), '0.05')
  await provider.waitForDeploy(vault.address)

  console.log('\n✅ IHLiquidYieldVault deployed!')
  console.log('Address:', vault.address.toString({ bounceable: true, urlSafe: true }))
  console.log('\nNext steps:')
  console.log('1. Find vault\'s hTON wallet: call get_wallet_address on hTON master')
  console.log('   hTON master: EQDPdq8xjAhytYqfGSX8KcFWIReCufsB9Wdg0pLlYSO_h76w')
  console.log('2. Call sendSetWallets with the hTON wallet address')
  console.log('3. Update src/lib/contracts.js: TON.IH_LIQUID_YIELD_VAULT =', `'${vault.address.toString({ bounceable: true, urlSafe: true })}'`)
}
