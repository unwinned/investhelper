// SPDX-License-Identifier: MIT
// InvestHelper Capital Shield Vault — Tact v1.5
//
// Strategy: "Super Safe" — 60% Tonstakers (tsTON) + 40% Bemo (stTON)
// One TON Connect signature to deposit. One to withdraw.
// Non-custodial: user holds proportional claim tracked in this contract.

import "@stdlib/deploy";
import "@stdlib/ownable";

// ─── TEP-74 Jetton transfer (to return tsTON/stTON on withdrawal) ────────────

message(0xf8a7ea5) JettonTransfer {
    queryId:             Int as uint64;
    amount:              Int as coins;
    destination:         Address;
    responseDestination: Address;
    customPayload:       Cell?;
    forwardTonAmount:    Int as coins;
    forwardPayload:      Slice as remaining;
}

// Notification sent to this vault when its jetton wallet receives tokens
message(0x7362d09c) JettonNotification {
    queryId:        Int as uint64;
    amount:         Int as coins;
    sender:         Address;
    forwardPayload: Slice as remaining;
}

// User-triggered withdrawal request
message Withdraw {
    queryId: Int as uint64;
}

// Owner sets the vault's tsTON/stTON jetton wallet addresses after deploy
message SetJettonWallets {
    tstonWallet: Address;  // vault's tsTON jetton wallet
    stonWallet:  Address;  // vault's stTON jetton wallet
}

// ─── Contract ─────────────────────────────────────────────────────────────────

contract IHCapitalShieldVault with Deployable, Ownable {

    // ── Permanent config ─────────────────────────────────────────────────────
    owner: Address;

    // Mainnet addresses — hardcoded at compile time
    const TONSTAKERS: Address = address("EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav");
    const BEMO:       Address = address("EQDNhy-nxYFgUqzfUzImBEP67JqsyMIcyk2S5_RwNNEYku0k");

    // Gas budget per forwarded message
    const GAS_FORWARD:  Int = ton("0.025");
    const MIN_DEPOSIT:  Int = ton("0.1");

    // ── Mutable state ────────────────────────────────────────────────────────
    totalDeposited: Int as coins = 0;
    deposits:       map<Address, Int as coins>;

    // Set by owner after deploy (vault's jetton wallet addresses)
    tstonWallet: Address?;
    stonWallet:  Address?;

    // Accumulated jetton balances (updated via JettonNotification)
    tstonBalance: Int as coins = 0;
    stonBalance:  Int as coins = 0;

    // ── Init ─────────────────────────────────────────────────────────────────
    init(owner: Address) {
        self.owner = owner;
    }

    // ── Deposit: user sends TON → vault routes to Tonstakers + Bemo ─────────

    receive() {
        let ctx: Context = context();
        let gasReserve: Int = self.GAS_FORWARD * 2 + ton("0.02");
        let amount: Int = ctx.value - gasReserve;

        require(amount >= self.MIN_DEPOSIT, "IH: deposit below minimum (0.1 TON after gas)");

        let stakersAmt: Int = amount * 60 / 100;
        let bemoAmt:    Int = amount - stakersAmt;

        // 60% → Tonstakers pool (receives tsTON to this vault's tsTON wallet)
        send(SendParameters{
            to:    self.TONSTAKERS,
            value: stakersAmt + self.GAS_FORWARD,
            mode:  SendIgnoreErrors,
            body:  emptyCell()
        });

        // 40% → Bemo staking (receives stTON to this vault's stTON wallet)
        send(SendParameters{
            to:    self.BEMO,
            value: bemoAmt + self.GAS_FORWARD,
            mode:  SendIgnoreErrors,
            body:  emptyCell()
        });

        // Track deposit for proportional withdrawal
        let prev: Int? = self.deposits.get(ctx.sender);
        let existing: Int = prev != null ? prev!! : 0;
        self.deposits.set(ctx.sender, existing + amount);
        self.totalDeposited += amount;
    }

    // ── Jetton receipt tracking (called by vault's tsTON/stTON wallets) ──────

    receive(msg: JettonNotification) {
        let ctx: Context = context();
        // Only accept notifications from our known jetton wallets
        if (self.tstonWallet != null && ctx.sender == self.tstonWallet!!) {
            self.tstonBalance += msg.amount;
        } else if (self.stonWallet != null && ctx.sender == self.stonWallet!!) {
            self.stonBalance += msg.amount;
        }
        // Return any excess gas to sender
        self.reply(emptyCell());
    }

    // ── Withdrawal: proportional tsTON + stTON sent back to user ────────────

    receive(msg: Withdraw) {
        let ctx: Context = context();
        let userDeposit: Int? = self.deposits.get(ctx.sender);
        require(userDeposit != null && userDeposit!! > 0, "IH: no deposit found");

        let share: Int = userDeposit!!;
        let total: Int = self.totalDeposited;

        // Clear user's record first (re-entrancy guard)
        self.deposits.set(ctx.sender, 0);
        self.totalDeposited -= share;

        // Send proportional tsTON if wallet known
        if (self.tstonWallet != null && self.tstonBalance > 0) {
            let tstonOut: Int = self.tstonBalance * share / total;
            if (tstonOut > 0) {
                self.tstonBalance -= tstonOut;
                send(SendParameters{
                    to:    self.tstonWallet!!,
                    value: ton("0.05"),
                    mode:  SendIgnoreErrors,
                    body:  JettonTransfer{
                        queryId:             msg.queryId,
                        amount:              tstonOut,
                        destination:         ctx.sender,
                        responseDestination: ctx.sender,
                        customPayload:       null,
                        forwardTonAmount:    ton("0.01"),
                        forwardPayload:      emptySlice()
                    }.toCell().beginParse()
                });
            }
        }

        // Send proportional stTON if wallet known
        if (self.stonWallet != null && self.stonBalance > 0) {
            let stonOut: Int = self.stonBalance * share / total;
            if (stonOut > 0) {
                self.stonBalance -= stonOut;
                send(SendParameters{
                    to:    self.stonWallet!!,
                    value: ton("0.05"),
                    mode:  SendIgnoreErrors,
                    body:  JettonTransfer{
                        queryId:             msg.queryId,
                        amount:              stonOut,
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

    // ── Admin: set jetton wallet addresses after deploy ───────────────────────

    receive(msg: SetJettonWallets) {
        self.requireOwner();
        self.tstonWallet = msg.tstonWallet;
        self.stonWallet  = msg.stonWallet;
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    get fun totalDeposited(): Int {
        return self.totalDeposited;
    }

    get fun depositOf(user: Address): Int {
        let v: Int? = self.deposits.get(user);
        return v != null ? v!! : 0;
    }

    get fun tstonBalance(): Int { return self.tstonBalance; }
    get fun stonBalance():  Int { return self.stonBalance;  }
}
