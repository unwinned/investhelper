// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./IHYieldVault.sol";

/**
 * @title IHBNBVault
 * @notice InvestHelper yield vault for BNB Chain.
 *         User sends BNB → vault wraps to WBNB → splits 50 % to USDT via PancakeSwap v3
 *         → supplies both to AAVE v3 on BNB → earns AAVE yield on both sides.
 *
 * Mainnet addresses (BNB Chain, chainId 56):
 *   WBNB                0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
 *   USDT                0x55d398326f99059fF775485246999027B3197955
 *   AAVE v3 Pool        0x6807dc923806fE8Fd134338EABCA509979a7e0cB
 *   AAVE AddrProvider   0xff75B6da14FAAeD3510B2E40B7e52634B1aFFb8A
 *   aBnbWBNB            0x9B00a09492a626dB7FE5e1B5a03cd73F43506EB7  (verify on AAVE docs)
 *   aBnbUSDT            0xa3E4b4F58A9CEb17d7909F1fAEfDDcb6B6BA32BD  (verify on AAVE docs)
 *   PancakeSwap v3      0x13f4EA83D0bd40E75C8222255bc855a974568Dd4
 *   WBNB/USDT fee       500 (0.05 %)
 */
contract IHBNBVault is IHYieldVault {
    constructor()
        IHYieldVault(
            0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c, // WBNB
            0x55d398326f99059fF775485246999027B3197955, // USDT (BSC)
            0x6807dc923806fE8Fd134338EABCA509979a7e0cB, // AAVE v3 Pool
            0x13f4EA83D0bd40E75C8222255bc855a974568Dd4, // PancakeSwap v3 SmartRouter
            0xff75B6da14FAAeD3510B2E40B7e52634B1aFFb8A, // AAVE AddressesProvider
            0x9B00a09492a626dB7FE5e1B5a03cd73F43506EB7, // aBnbWBNB
            0xa3E4b4F58A9CEb17d7909F1fAEfDDcb6B6BA32BD, // aBnbUSDT
            18,                                         // USDT on BSC is 18 decimals
            500,                                        // 0.05% fee tier
            "IH BNB Yield Vault",
            "ihBNB"
        )
    {}
}
