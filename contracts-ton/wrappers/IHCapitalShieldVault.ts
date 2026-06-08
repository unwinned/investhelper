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

// ─── Message opcodes (must match Tact contract) ───────────────────────────────

const OP_WITHDRAW             = 0x4e_57_49_54  // text opcode for "Withdraw" message
const OP_SET_JETTON_WALLETS   = 0x53_4a_57_00  // "SetJettonWallets"

// ─── Init data ───────────────────────────────────────────────────────────────

export type IHCapitalShieldVaultConfig = {
  owner: Address
}

export function capitalShieldVaultConfigToCell(cfg: IHCapitalShieldVaultConfig): Cell {
  return beginCell().storeAddress(cfg.owner).endCell()
}

// ─── Wrapper ──────────────────────────────────────────────────────────────────

export class IHCapitalShieldVault implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell },
  ) {}

  static createFromAddress(address: Address) {
    return new IHCapitalShieldVault(address)
  }

  static createFromConfig(cfg: IHCapitalShieldVaultConfig, code: Cell, workchain = 0) {
    const data = capitalShieldVaultConfigToCell(cfg)
    const init = { code, data }
    return new IHCapitalShieldVault(contractAddress(workchain, init), init)
  }

  /** Deposit TON — vault routes 60% to Tonstakers, 40% to Bemo */
  async sendDeposit(provider: ContractProvider, via: Sender, amountTon: string) {
    await provider.internal(via, {
      value: toNano(amountTon),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    })
  }

  /** Withdraw — vault sends proportional tsTON + stTON back */
  async sendWithdraw(provider: ContractProvider, via: Sender) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0, 32)           // op = 0 → text comment or raw
        .storeUint(0, 64)           // query_id
        .endCell(),
    })
  }

  /** Owner-only: register vault's tsTON and stTON jetton wallet addresses */
  async sendSetJettonWallets(
    provider: ContractProvider,
    via: Sender,
    opts: { tstonWallet: Address; stonWallet: Address },
  ) {
    await provider.internal(via, {
      value: toNano('0.02'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(OP_SET_JETTON_WALLETS, 32)
        .storeUint(0, 64)
        .storeAddress(opts.tstonWallet)
        .storeAddress(opts.stonWallet)
        .endCell(),
    })
  }

  // ── Getters ─────────────────────────────────────────────────────────────────

  async getTotalDeposited(provider: ContractProvider): Promise<bigint> {
    const result = await provider.get('totalDeposited', [])
    return result.stack.readBigNumber()
  }

  async getDepositOf(provider: ContractProvider, user: Address): Promise<bigint> {
    const result = await provider.get('depositOf', [
      { type: 'slice', cell: beginCell().storeAddress(user).endCell() },
    ])
    return result.stack.readBigNumber()
  }

  async getTstonBalance(provider: ContractProvider): Promise<bigint> {
    const result = await provider.get('tstonBalance', [])
    return result.stack.readBigNumber()
  }

  async getStonBalance(provider: ContractProvider): Promise<bigint> {
    const result = await provider.get('stonBalance', [])
    return result.stack.readBigNumber()
  }
}
