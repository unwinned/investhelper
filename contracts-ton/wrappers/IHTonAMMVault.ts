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

export type IHTonAMMVaultConfig = {
  owner: Address
}

export function tonAMMVaultConfigToCell(cfg: IHTonAMMVaultConfig): Cell {
  return beginCell().storeAddress(cfg.owner).endCell()
}

export class IHTonAMMVault implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell },
  ) {}

  static createFromAddress(address: Address) {
    return new IHTonAMMVault(address)
  }

  static createFromConfig(cfg: IHTonAMMVaultConfig, code: Cell, workchain = 0) {
    const data = tonAMMVaultConfigToCell(cfg)
    const init = { code, data }
    return new IHTonAMMVault(contractAddress(workchain, init), init)
  }

  /** Deposit TON — 50% STON.fi LP + 50% DeDust LP */
  async sendDeposit(provider: ContractProvider, via: Sender, amountTon: string) {
    await provider.internal(via, {
      value: toNano(amountTon),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    })
  }

  /** Withdraw any refunded TON proportionally */
  async sendWithdraw(provider: ContractProvider, via: Sender) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().storeUint(0, 32).storeUint(0, 64).endCell(),
    })
  }

  /** Owner-only: set STON.fi router's USDT jetton wallet so PROVIDE_LP works */
  async sendSetRouterWallet(
    provider: ContractProvider,
    via: Sender,
    routerUsdtWallet: Address,
  ) {
    await provider.internal(via, {
      value: toNano('0.02'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x53_52_57_00, 32) // "SetRouterWallet" opcode
        .storeUint(0, 64)
        .storeAddress(routerUsdtWallet)
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
