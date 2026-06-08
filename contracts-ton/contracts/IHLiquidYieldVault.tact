// SPDX-License-Identifier: MIT
// InvestHelper Liquid Yield Vault — Tact v1.5
//
// Strategy: "Safe" — 45% Hipo (hTON) + 35% DeDust hTON/TON LP + 20% Evaa supply
// All three deployments happen in one TON Connect signing.

import "@stdlib/deploy";
import "@stdlib/ownable";

// ─── DeDust native deposit (0xd55e4686) ──────────────────────────────────────

message(0xd55e4686) DedustNativeDeposit {
    queryId:       Int as uint64;
    amount:        Int as coins;
    poolType:      Int as uint1;   // 0 = volatile
    asset0:        Int as uint4;   // 0 = native TON
    asset1:        Int as uint4;   // 0 = native TON (other side)
    minLpOut:      Int as coins;
    targetBalance0: Int as coins;
    targetBalance1: Int as coins;
}

// ─── TEP-74 jetton transfer ────────────────────────────────────────────────

message(0xf8a7ea5) JettonTransfer {
    queryId:             Int as uint64;
    amount:              Int as coins;
    destination:         Address;
    responseDestination: Address;
    customPayload:       Cell?;
    forwardTonAmount:    Int as coins;
    forwardPayload:      Slice as remaining;
}

message(0x7362d09c) JettonNotification {
    queryId:        Int as uint64;
    amount:         Int as coins;
    sender:         Address;
    forwardPayload: Slice as remaining;
}

message Withdraw {}

message SetWallets {
    htonVaultWallet: Address;  // vault's hTON jetton wallet
    evaaWallet:      Address?; // vault's Evaa supply token wallet (optional)
}

// ─── Contract ─────────────────────────────────────────────────────────────────

contract IHLiquidYieldVault with Deployable, Ownable {

    owner: Address;

    // Mainnet addresses
    const HIPO:              Address = address("EQCLyZHP4Xe8fpchQz76O-_RmUhaVc_9BAoGyJrwJrcbz2eZ");
    const EVAA_MASTER:       Address = address("EQC52w4nWyJ0oKo5zDGY4rGaTkCTz_4WoFhp5UAYlbvG-LJl");
    const DEDUST_NATIVE_VAULT: Address = address("EQDa4VOnTYlLvDJ0gZjNYm5PXfSmmtL6Vs6A_CZEtXCNICq_");
    // hTON/TON DeDust pool (volatile) — mainnet
    const DEDUST_HTON_TON_POOL: Address = address("EQBfBWT7X2BHg9tXAxzhz2aKiNTU1tpt5NsiK0uSDW_YAJ67");

    const GAS_FORWARD: Int = ton("0.03");
    const MIN_DEPOSIT: Int = ton("0.15");

    totalDeposited: Int as coins = 0;
    deposits:       map<Address, Int as coins>;

    htonWalletAddr: Address?;  // vault's hTON jetton wallet (set after deploy)
    htonBalance:    Int as coins = 0;

    init(owner: Address) {
        self.owner = owner;
    }

    // ── Deposit ───────────────────────────────────────────────────────────────

    receive() {
        let ctx: Context = context();
        let gasReserve: Int = self.GAS_FORWARD * 3 + ton("0.05");
        let amount: Int = ctx.value - gasReserve;
        require(amount >= self.MIN_DEPOSIT, "IH: deposit below minimum");

        let hipoAmt:  Int = amount * 45 / 100;  // 45% → Hipo → hTON
        let dedustAmt: Int = amount * 35 / 100;  // 35% → DeDust hTON/TON LP
        let evaaAmt:  Int = amount - hipoAmt - dedustAmt;  // 20% → Evaa lending

        // 1. Send to Hipo treasury (receives hTON to vault's hTON wallet)
        send(SendParameters{
            to:    self.HIPO,
            value: hipoAmt + self.GAS_FORWARD,
            mode:  SendIgnoreErrors,
            body:  emptyCell()
        });

        // 2. Send to Evaa lending (supply TON)
        send(SendParameters{
            to:    self.EVAA_MASTER,
            value: evaaAmt + self.GAS_FORWARD,
            mode:  SendIgnoreErrors,
            body:  emptyCell()
        });

        // 3. DeDust native TON deposit into hTON/TON pool
        // Both TON amounts sent simultaneously — DeDust matches them internally.
        // hTON side will be provided once Hipo returns hTON to the vault's wallet.
        send(SendParameters{
            to:    self.DEDUST_NATIVE_VAULT,
            value: dedustAmt + self.GAS_FORWARD,
            mode:  SendIgnoreErrors,
            body:  DedustNativeDeposit{
                queryId:       0,
                amount:        dedustAmt,
                poolType:      0,
                asset0:        0,    // TON (native)
                asset1:        0,    // TON-side of hTON/TON pool
                minLpOut:      0,
                targetBalance0: dedustAmt,
                targetBalance1: 0
            }.toCell()
        });

        let prev: Int? = self.deposits.get(ctx.sender);
        self.deposits.set(ctx.sender, (prev != null ? prev!! : 0) + amount);
        self.totalDeposited += amount;
    }

    // Track received hTON
    receive(msg: JettonNotification) {
        let ctx: Context = context();
        if (self.htonWalletAddr != null && ctx.sender == self.htonWalletAddr!!) {
            self.htonBalance += msg.amount;
        }
        self.reply(emptyCell());
    }

    // ── Withdrawal ────────────────────────────────────────────────────────────

    receive(msg: Withdraw) {
        let ctx: Context = context();
        let userDeposit: Int? = self.deposits.get(ctx.sender);
        require(userDeposit != null && userDeposit!! > 0, "IH: no deposit");

        let share: Int = userDeposit!!;
        let total: Int = self.totalDeposited;

        self.deposits.set(ctx.sender, 0);
        self.totalDeposited -= share;

        // Return proportional hTON
        if (self.htonWalletAddr != null && self.htonBalance > 0) {
            let htonOut: Int = self.htonBalance * share / total;
            if (htonOut > 0) {
                self.htonBalance -= htonOut;
                send(SendParameters{
                    to:    self.htonWalletAddr!!,
                    value: ton("0.05"),
                    mode:  SendIgnoreErrors,
                    body:  JettonTransfer{
                        queryId:             0,
                        amount:              htonOut,
                        destination:         ctx.sender,
                        responseDestination: ctx.sender,
                        customPayload:       null,
                        forwardTonAmount:    ton("0.01"),
                        forwardPayload:      emptySlice()
                    }.toCell().beginParse()
                });
            }
        }
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    receive(msg: SetWallets) {
        self.requireOwner();
        self.htonWalletAddr = msg.htonVaultWallet;
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    get fun totalDeposited(): Int { return self.totalDeposited; }

    get fun depositOf(user: Address): Int {
        let v: Int? = self.deposits.get(user);
        return v != null ? v!! : 0;
    }
}
