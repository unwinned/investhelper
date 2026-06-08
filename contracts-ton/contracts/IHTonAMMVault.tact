// SPDX-License-Identifier: MIT
// InvestHelper TON AMM Vault — Tact v1.5
//
// Strategy: "Middle" — 50% STON.fi v2.1 TON/USDT LP + 50% DeDust TON/USDT LP
// Uses pTON v1 for the STON.fi native TON side.

import "@stdlib/deploy";
import "@stdlib/ownable";

// ─── STON.fi v2.1 pTON ton_transfer (provides TON to PROVIDE_LP flow) ────────

// pTON v1 op: 0x01f3835d (ton_transfer)
message(0x01f3835d) StonfiTonTransfer {
    queryId:    Int as uint64;
    tonAmount:  Int as coins;
    refAddress: Address;
    // forward payload (PROVIDE_LP) is appended as a cell ref
}

// ─── DeDust native deposit ────────────────────────────────────────────────────

message(0xd55e4686) DedustDeposit {
    queryId:        Int as uint64;
    amount:         Int as coins;
    poolType:       Int as uint1;
    asset0:         Int as uint4;
    asset1:         Int as uint4;
    minLpOut:       Int as coins;
    targetBalance0: Int as coins;
    targetBalance1: Int as coins;
}

message(0x7362d09c) JettonNotification {
    queryId:        Int as uint64;
    amount:         Int as coins;
    sender:         Address;
    forwardPayload: Slice as remaining;
}

message Withdraw {}

message SetRouterWallet {
    // Router's USDT jetton wallet — needed to build PROVIDE_LP payload
    routerUsdtWallet: Address;
}

// ─── Contract ─────────────────────────────────────────────────────────────────

contract IHTonAMMVault with Deployable, Ownable {

    owner: Address;

    // STON.fi v2.1 mainnet
    const STONFI_PTON_V1: Address = address("EQCM3B12QK1e4yZSf8GtBRT0aLMNyEsBc_DhVfRRtOEffLez");
    // DeDust native vault
    const DEDUST_NATIVE_VAULT: Address = address("EQDa4VOnTYlLvDJ0gZjNYm5PXfSmmtL6Vs6A_CZEtXCNICq_");
    // DeDust TON/USDT pool — volatile
    const DEDUST_TON_USDT_POOL: Address = address("EQD8TJ8xEWB1SpnRE4d8eT6t5OtNBaVBPdL4gFjbMQhqnhW_");

    const GAS_FORWARD: Int = ton("0.35");  // STON.fi LP requires extra gas
    const MIN_DEPOSIT: Int = ton("0.2");

    totalDeposited: Int as coins = 0;
    deposits:       map<Address, Int as coins>;

    // Set by owner: router's USDT jetton wallet address for PROVIDE_LP
    routerUsdtWallet: Address?;

    init(owner: Address) {
        self.owner = owner;
    }

    receive() {
        let ctx: Context = context();
        let gasReserve: Int = self.GAS_FORWARD * 2 + ton("0.05");
        let amount: Int = ctx.value - gasReserve;
        require(amount >= self.MIN_DEPOSIT, "IH: deposit below minimum");

        let stonfiAmt:  Int = amount * 50 / 100;
        let dedustAmt:  Int = amount - stonfiAmt;

        // 1. STON.fi v2.1 PROVIDE_LP — native TON side via pTON v1
        // Build the PROVIDE_LP inner payload
        if (self.routerUsdtWallet != null) {
            let deadline: Int = now() + 900;  // 15 min
            let provideLp: Builder = beginCell()
                .storeUint(0x37c096df, 32)                        // PROVIDE_LP op
                .storeAddress(self.routerUsdtWallet!!)             // router's other-token wallet
                .storeAddress(ctx.sender)                          // refund to user
                .storeAddress(ctx.sender)                          // excesses to user
                .storeUint(deadline, 64)
                .storeBit(false)                                   // no custom payload
                .storeCoins(0)                                     // min_lp_out = 0
                .storeBit(false)
                .storeBit(false);

            let tonTransferBody: Builder = beginCell()
                .storeUint(0x01f3835d, 32)      // ton_transfer
                .storeUint(0, 64)               // query_id
                .storeCoins(stonfiAmt)           // ton_amount
                .storeAddress(ctx.sender)        // refund address
                .storeBit(true)                  // has forward ref
                .storeRef(provideLp.endCell());

            send(SendParameters{
                to:    self.STONFI_PTON_V1,
                value: stonfiAmt + self.GAS_FORWARD,
                mode:  SendIgnoreErrors,
                body:  tonTransferBody.endCell()
            });
        } else {
            // routerUsdtWallet not set yet — fallback to DeDust for full amount
            dedustAmt = amount;
        }

        // 2. DeDust native TON/USDT LP — TON side
        send(SendParameters{
            to:    self.DEDUST_NATIVE_VAULT,
            value: dedustAmt + self.GAS_FORWARD,
            mode:  SendIgnoreErrors,
            body:  DedustDeposit{
                queryId:        0,
                amount:         dedustAmt,
                poolType:       0,
                asset0:         0,
                asset1:         0,
                minLpOut:       0,
                targetBalance0: dedustAmt,
                targetBalance1: 0
            }.toCell()
        });

        let prev: Int? = self.deposits.get(ctx.sender);
        self.deposits.set(ctx.sender, (prev != null ? prev!! : 0) + amount);
        self.totalDeposited += amount;
    }

    receive(msg: Withdraw) {
        let ctx: Context = context();
        let userDeposit: Int? = self.deposits.get(ctx.sender);
        require(userDeposit != null && userDeposit!! > 0, "IH: no deposit");
        // LP positions are held on-chain in STON.fi/DeDust LP token wallets.
        // For v1, returning deposited TON is handled proportionally from vault balance.
        let share: Int = userDeposit!!;
        self.deposits.set(ctx.sender, 0);
        self.totalDeposited -= share;
        // Return any leftover TON (gas refunds, etc.) proportionally
        let bal: Int = myBalance() - ton("0.1");
        if (bal > 0 && self.totalDeposited > 0) {
            let refund: Int = bal * share / (self.totalDeposited + share);
            if (refund > ton("0.01")) {
                send(SendParameters{
                    to:    ctx.sender,
                    value: refund,
                    mode:  SendIgnoreErrors,
                    body:  emptyCell()
                });
            }
        }
    }

    receive(msg: SetRouterWallet) {
        self.requireOwner();
        self.routerUsdtWallet = msg.routerUsdtWallet;
    }

    get fun totalDeposited(): Int { return self.totalDeposited; }
    get fun depositOf(user: Address): Int {
        let v: Int? = self.deposits.get(user);
        return v != null ? v!! : 0;
    }
}
