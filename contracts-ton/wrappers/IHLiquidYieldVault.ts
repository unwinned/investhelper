import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
  toNano,
} from '@ton/core'

export type IHLiquidYieldVaultConfig = {
  owner: Address
}

export function liquidYieldVaultConfigToCell(cfg: IHLiquidYieldVaultConfig): Cell {
  return beginCell().storeAddress(cfg.owner).endCell()
}

export class IHLiquidYieldVault implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell },
  ) {}

  static createFromAddress(address: Address) {
    return new IHLiquidYieldVault(address)
  }

  static createFromConfig(cfg: IHLiquidYieldVaultConfig, code: Cell, workchain = 0) {
    const data = liquidYieldVaultConfigToCell(cfg)
    const init = { code, data }
    return new IHLiquidYieldVault(contractAddress(workchain, init), init)
  }

  /** Deposit TON — routes 45% Hipo, 35% DeDust LP, 20% Evaa */
  async sendDeposit(provider: ContractProvider, via: Sender, amountTon: string) {
    await provider.internal(via, {
      value: toNano(amountTon),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    })
  }

  /** Withdraw proportional hTON back to caller */
  async sendWithdraw(provider: ContractProvider, via: Sender) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().storeUint(0, 32).storeUint(0, 64).endCell(),
    })
  }

  /** Owner-only: register vault's hTON jetton wallet after deploy */
  async sendSetWallets(
    provider: ContractProvider,
    via: Sender,
    opts: { htonVaultWallet: Address },
  ) {
    await provider.internal(via, {
      value: toNano('0.02'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x53_57_41_4c, 32) // "SetWallets" opcode
        .storeUint(0, 64)
        .storeAddress(opts.htonVaultWallet)
        .storeBit(0) // no evaa wallet (optional)
        .endCell(),
    })
  }

  async getTotalDeposited(provider: ContractProvider): Promise<bigint> {
    const r = await provider.get('totalDeposited', [])
    return r.stack.readBigNumber()
  }

  async getDepositOf(provider: ContractProvider, user: Address): Promise<bigint> {
    const r = await provider.get('depositOf', [
      { type: 'slice', cell: beginCell().storeAddress(user).endCell() },
    ])
    return r.stack.readBigNumber()
  }
}
