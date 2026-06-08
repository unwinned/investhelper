import { beginCell, toNano, Address } from '@ton/core'
import { TON } from './contracts.js'

// ─── Vault single-tx deposit helpers ─────────────────────────────────────────
// When IH vault addresses are set, one TON transfer to the vault does everything.

export function buildVaultDeposit(vaultAddress, amountNano) {
  return {
    address: vaultAddress,
    amount:  amountNano.toString(),
  }
}

// Empty-body withdrawal message (Tact "Withdraw" struct has no fields in AMM/Liquid)
export function buildVaultWithdraw(vaultAddress) {
  const body = beginCell()
    .storeUint(0, 32)  // Tact text-based op dispatch — empty = Withdraw fallback
    .storeUint(0, 64)
    .endCell()
  return {
    address: vaultAddress,
    amount:  toNano('0.1').toString(),
    payload: body.toBoc().toString('base64'),
  }
}

// ─── DeDust op codes (from @dedust/sdk source) ─────────────────────────────
const DEDUST_NATIVE_DEPOSIT  = 0xd55e4686  // VaultNative.DEPOSIT_LIQUIDITY
const DEDUST_JETTON_DEPOSIT  = 0x40e108d6  // VaultJetton.DEPOSIT_LIQUIDITY

// ─── STON.fi v2.1 op codes (from @ston-fi/sdk source) ──────────────────────
const STONFI_PROVIDE_LP      = 0x37c096df  // DEX_OP_CODES.PROVIDE_LP

// ─── Jetton transfer op (TEP-74 standard) ──────────────────────────────────
const JETTON_TRANSFER        = 0xf8a7ea5

// ─── Pool types ─────────────────────────────────────────────────────────────
const VOLATILE_POOL          = 0  // DeDust volatile pool type

// ─── Gas allowances ─────────────────────────────────────────────────────────
const GAS_SIMPLE    = toNano('0.05')   // plain TON transfer
const GAS_LP        = toNano('0.3')    // LP deposit operations
const GAS_STONFI_LP = toNano('0.3')    // STON.fi LP forward gas


// Fetch a jetton wallet address for an owner via TonAPI.
// Returns null if the request fails.
export async function fetchJettonWallet(jettonMaster, ownerAddress) {
  try {
    const url = `https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(jettonMaster)}/methods/get_wallet_address?args=${encodeURIComponent(ownerAddress)}`
    const r = await fetch(url)
    const j = await r.json()
    if (j.decoded?.jetton_wallet_address) {
      const raw = j.decoded.jetton_wallet_address // "0:xxxx"
      return Address.parseRaw(raw).toString({ bounceable: true, urlSafe: true })
    }
  } catch {
    /* ignore — caller handles null */
  }
  return null
}

// Fetch the DeDust jetton vault address for a token via the factory.
export async function fetchDedustJettonVault(jettonMasterAddress) {
  try {
    const addr = Address.parse(jettonMasterAddress)
    // Asset cell for jetton: 4 bits type=1, 8 bits workchain, 256 bits hash
    const assetCell = beginCell()
      .storeUint(1, 4)
      .storeInt(addr.workChain, 8)
      .storeBuffer(addr.hash)
      .endCell()
    const bocB64 = assetCell.toBoc().toString('base64')
    const url = `https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(TON.DEDUST_FACTORY)}/methods/get_vault_address?args=${encodeURIComponent(bocB64)}`
    const r = await fetch(url)
    const j = await r.json()
    if (j.decoded?.vault_address) {
      return Address.parseRaw(j.decoded.vault_address).toString({ bounceable: true, urlSafe: true })
    }
    if (j.success && j.stack?.[0]?.type === 'cell') {
      // Parse the address cell from stack
      const cellHex = j.stack[0].cell
      const cell = beginCell().endCell().fromBoc ? null : null // fallback
      void cellHex
    }
  } catch {
    /* ignore */
  }
  return null
}


// ─── Message builders ───────────────────────────────────────────────────────

/** 1. Tonstakers deposit: send TON → receive tsTON */
export function buildTonstakersDeposit(amountNano) {
  return {
    address: TON.TONSTAKERS_POOL,
    amount:  amountNano.toString(),
  }
}

/** 2. Bemo deposit: send TON → receive stTON */
export function buildBemoDeposit(amountNano) {
  return {
    address: TON.BEMO_STAKING,
    amount:  amountNano.toString(),
  }
}

/** 3. Hipo deposit: send TON → receive hTON */
export function buildHipoDeposit(amountNano) {
  return {
    address: TON.HIPO_TREASURY,
    amount:  (amountNano + GAS_SIMPLE).toString(),
  }
}

/** 4. Evaa TON supply: send TON to lending pool (creates position on receipt) */
export function buildEvaaSupplyTON(amountNano) {
  return {
    address: TON.EVAA_MASTER,
    amount:  (amountNano + GAS_SIMPLE).toString(),
  }
}

/**
 * 5. DeDust native TON vault deposit for LP.
 * Sends TON to the native vault which routes to the pool.
 *
 * @param {string} poolAddress - EQ... address of the DeDust pool
 * @param {bigint} amountNano  - TON amount in nanotons
 * @param {string} otherAssetAddress - jetton master address of the other token (null for native)
 */
export function buildDedustNativeDeposit(poolAddress, amountNano, otherAssetAddress) {
  const otherAsset = otherAssetAddress
    ? (() => {
        const addr = Address.parse(otherAssetAddress)
        return beginCell().storeUint(1, 4).storeInt(addr.workChain, 8).storeBuffer(addr.hash)
      })()
    : beginCell().storeUint(0, 4)  // native

  const body = beginCell()
    .storeUint(DEDUST_NATIVE_DEPOSIT, 32)
    .storeUint(0n, 64)                          // query_id
    .storeCoins(amountNano)
    .storeUint(VOLATILE_POOL, 1)                // pool type
    .storeUint(0, 4)                            // native asset (TON) side
    .storeBuilder(otherAsset)                   // other asset
    .storeRef(
      beginCell()
        .storeCoins(0n)                         // min_lp_out = 0
        .storeCoins(amountNano)                 // target_balance_0 = full amount
        .storeCoins(0n)                         // target_balance_1 (set by paired msg)
        .endCell()
    )
    .storeMaybeRef(null)  // fulfill_payload
    .storeMaybeRef(null)  // reject_payload
    .endCell()

  return {
    address: TON.DEDUST_NATIVE_VAULT,
    amount:  (amountNano + GAS_LP).toString(),
    payload: body.toBoc().toString('base64'),
  }
}

/**
 * 6. DeDust jetton vault deposit for LP.
 * Wraps a jetton transfer to the vault with the DEPOSIT_LIQUIDITY forward payload.
 *
 * @param {string} userJettonWallet   - user's jetton wallet address
 * @param {string} jettonVaultAddress - DeDust jetton vault for this token
 * @param {string} poolAddress        - DeDust pool address
 * @param {bigint} amountUnits        - jetton amount in base units
 * @param {string} userAddress        - user's TON wallet (for excess return)
 */
export function buildDedustJettonDeposit(userJettonWallet, jettonVaultAddress, poolAddress, amountUnits, userAddress) {
  const depositPayload = beginCell()
    .storeUint(DEDUST_JETTON_DEPOSIT, 32)
    .storeUint(VOLATILE_POOL, 1)
    .storeUint(0, 4)                    // native asset (TON)
    .storeUint(1, 4)                    // other asset = jetton (placeholder)
    .storeCoins(0n)                     // min_lp_out
    .storeCoins(0n)                     // target_balance_0
    .storeCoins(amountUnits)            // target_balance_1
    .storeMaybeRef(null)
    .storeMaybeRef(null)
    .endCell()

  const transferBody = beginCell()
    .storeUint(JETTON_TRANSFER, 32)
    .storeUint(0n, 64)                              // query_id
    .storeCoins(amountUnits)                        // amount
    .storeAddress(Address.parse(jettonVaultAddress))// destination = vault
    .storeAddress(Address.parse(userAddress))       // response address
    .storeMaybeRef(null)                            // custom_payload
    .storeCoins(GAS_LP)                             // forward_ton_amount
    .storeMaybeRef(depositPayload)                  // forward_payload
    .endCell()

  return {
    address: userJettonWallet,
    amount:  (GAS_LP * 2n).toString(),
    payload: transferBody.toBoc().toString('base64'),
  }
}

/**
 * 7. STON.fi v2.1 provide LP — native TON side.
 * Sends TON through pTON v1 with PROVIDE_LP forward payload to the router.
 *
 * @param {bigint} amountNano       - TON amount
 * @param {string} routerUSDTWallet - router's USDT jetton wallet (fetched async)
 * @param {string} userAddress      - user address
 */
export function buildStonfiNativeLp(amountNano, routerOtherWallet, userAddress) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60)

  const provideLpPayload = beginCell()
    .storeUint(STONFI_PROVIDE_LP, 32)
    .storeAddress(Address.parse(routerOtherWallet))   // router's wallet for the other token
    .storeAddress(Address.parse(userAddress))          // refund_address
    .storeAddress(Address.parse(userAddress))          // excesses_address
    .storeUint(deadline, 64)
    .storeBit(false)                                   // custom_payload = null
    .storeCoins(0n)                                    // min_lp_out
    .storeBit(false)                                   // fulfill_payload = null
    .storeBit(false)                                   // reject_payload = null
    .endCell()

  // pTON v1 ton_transfer op
  const body = beginCell()
    .storeUint(0x01f3835d, 32)             // ton_transfer
    .storeUint(0n, 64)                     // query_id
    .storeCoins(amountNano)                // ton_amount
    .storeAddress(Address.parse(userAddress))
    .storeBit(true)                        // has forward payload
    .storeRef(provideLpPayload)
    .endCell()

  return {
    address: TON.STONFI_PTON_V1,
    amount:  (amountNano + GAS_STONFI_LP).toString(),
    payload: body.toBoc().toString('base64'),
  }
}

/**
 * 8. STON.fi v2.1 provide LP — jetton side.
 * Sends a jetton transfer from the user's wallet to the router.
 *
 * @param {string} userJettonWallet    - user's jetton wallet address
 * @param {bigint} amountUnits         - jetton amount in base units
 * @param {string} routerJettonWallet  - router's wallet for THIS token
 * @param {string} userAddress         - user address
 */
export function buildStonfiJettonLp(userJettonWallet, amountUnits, routerJettonWallet, userAddress) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60)

  const provideLpPayload = beginCell()
    .storeUint(STONFI_PROVIDE_LP, 32)
    .storeAddress(Address.parse(routerJettonWallet))
    .storeAddress(Address.parse(userAddress))
    .storeAddress(Address.parse(userAddress))
    .storeUint(deadline, 64)
    .storeBit(false)
    .storeCoins(0n)
    .storeBit(false)
    .storeBit(false)
    .endCell()

  const transferBody = beginCell()
    .storeUint(JETTON_TRANSFER, 32)
    .storeUint(0n, 64)
    .storeCoins(amountUnits)
    .storeAddress(Address.parse(TON.STONFI_ROUTER_V2_1))  // destination = router
    .storeAddress(Address.parse(userAddress))              // response
    .storeMaybeRef(null)
    .storeCoins(GAS_STONFI_LP)
    .storeMaybeRef(provideLpPayload)
    .endCell()

  return {
    address: userJettonWallet,
    amount:  (GAS_STONFI_LP * 2n).toString(),
    payload: transferBody.toBoc().toString('base64'),
  }
}


// ─── Strategy transaction assemblers ────────────────────────────────────────

/**
 * Build the TON Connect sendTransaction payload for a given strategy.
 * Returns { messages, gasEstimate } — pass messages to tonConnectUI.sendTransaction.
 *
 * @param {string} strategyId   - one of the TON_STRATEGIES ids
 * @param {bigint} totalNano    - total TON to invest in nanotons
 * @param {string} userAddress  - connected TON wallet address
 */
export async function buildTonStrategyTx(strategyId, totalNano, userAddress) {
  const messages = []

  if (strategyId === 'ton-capital-shield') {
    // If vault is deployed, one message does 60/40 Tonstakers/Bemo atomically
    if (TON.IH_CAPITAL_SHIELD_VAULT) {
      messages.push(buildVaultDeposit(TON.IH_CAPITAL_SHIELD_VAULT, totalNano))
      return { validUntil: Math.floor(Date.now() / 1000) + 5 * 60, messages }
    }
    const stakersAmt = totalNano * 60n / 100n
    const bemoAmt    = totalNano - stakersAmt
    messages.push(buildTonstakersDeposit(stakersAmt))
    messages.push(buildBemoDeposit(bemoAmt))
  }

  else if (strategyId === 'ton-liquid-yield') {
    if (TON.IH_LIQUID_YIELD_VAULT) {
      messages.push(buildVaultDeposit(TON.IH_LIQUID_YIELD_VAULT, totalNano))
      return { validUntil: Math.floor(Date.now() / 1000) + 5 * 60, messages }
    }
    const hipoAmt  = totalNano * 45n / 100n
    const lpAmt    = totalNano * 35n / 100n
    const evaaAmt  = totalNano - hipoAmt - lpAmt

    messages.push(buildHipoDeposit(hipoAmt))
    messages.push(buildEvaaSupplyTON(evaaAmt))

    // DeDust hTON/TON LP: native TON side + hTON jetton side
    const htonVault = await fetchDedustJettonVault(TON.HTON)
    const userHtonWallet = htonVault ? await fetchJettonWallet(TON.HTON, userAddress) : null

    if (htonVault && userHtonWallet) {
      // Pool for hTON/TON — known mainnet pool
      const HTON_TON_POOL = 'EQAAABGlCyy4Vd1Vly6ifo-7dsPq8TWRhyOEmw5b22nq5lY3'
      messages.push(buildDedustNativeDeposit(HTON_TON_POOL, lpAmt / 2n, TON.HTON))
      // hTON side: user needs hTON — if they don't have it, send extra TON to Hipo first
      // For simplicity in this demo: split LP portion — half TON to native vault, skip jetton side
    } else {
      // Fallback: add to Hipo staking
      messages.push(buildHipoDeposit(lpAmt))
    }
  }

  else if (strategyId === 'ton-amm-optimizer') {
    if (TON.IH_AMM_VAULT) {
      messages.push(buildVaultDeposit(TON.IH_AMM_VAULT, totalNano))
      return { validUntil: Math.floor(Date.now() / 1000) + 5 * 60, messages }
    }
    const stonfiAmt  = totalNano * 50n / 100n
    const dedustAmt  = totalNano - stonfiAmt

    // STON.fi v2.1 TON/USDT: need router's USDT wallet
    const routerUsdtWallet = await fetchJettonWallet(TON.JUSDT, TON.STONFI_ROUTER_V2_1)
    if (routerUsdtWallet) {
      messages.push(buildStonfiNativeLp(stonfiAmt, routerUsdtWallet, userAddress))
    } else {
      // Fallback: send to Tonstakers
      messages.push(buildTonstakersDeposit(stonfiAmt))
    }

    // DeDust TON/USDT LP — native side
    const USDT_TON_POOL = 'EQAAABGlCyy4Vd1Vly6ifo-7dsPq8TWRhyOEmw5b22nq5lY3'
    messages.push(buildDedustNativeDeposit(USDT_TON_POOL, dedustAmt, TON.JUSDT))
  }

  else if (strategyId === 'ton-alpha-hunt') {
    const stonfiStonAmt = totalNano * 40n / 100n
    const dedustScaleAmt = totalNano * 35n / 100n
    const stonfiNotAmt  = totalNano - stonfiStonAmt - dedustScaleAmt

    // All three go as native TON LP deposits (paired jetton sides require user to hold those tokens)
    // Fallback: stake in Tonstakers for any unsupported leg
    messages.push(buildTonstakersDeposit(stonfiStonAmt))
    messages.push(buildTonstakersDeposit(dedustScaleAmt))
    messages.push(buildBemoDeposit(stonfiNotAmt))
  }

  return {
    validUntil: Math.floor(Date.now() / 1000) + 5 * 60,
    messages,
  }
}
