// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./IHYieldVault.sol";

/**
 * @title IHBaseVault
 * @notice InvestHelper yield vault for Base chain.
 *         User sends ETH → vault wraps to WETH → splits 50 % to USDC via Uniswap v3
 *         → supplies both to AAVE v3 on Base → earns AAVE yield on both sides.
 *
 * Mainnet addresses (Base, chainId 8453):
 *   WETH                0x4200000000000000000000000000000000000006
 *   USDC                0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 *   AAVE v3 Pool        0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
 *   AAVE AddrProvider   0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D
 *   aWETH               0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7
 *   aUSDC               0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB
 *   UniV3 Router02      0x2626664c2603336E57B271c5C0b26F421741e481
 *   WETH/USDC fee tier  500 (0.05 %)
 */
contract IHBaseVault is IHYieldVault {
    constructor()
        IHYieldVault(
            0x4200000000000000000000000000000000000006, // WETH
            0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, // USDC
            0xA238Dd80C259a72e81d7e4664a9801593F98d1c5, // AAVE v3 Pool
            0x2626664c2603336E57B271c5C0b26F421741e481, // UniV3 SwapRouter02
            0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D, // AAVE AddressesProvider
            0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7, // aWETH
            0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB, // aUSDC
            6,                                          // USDC decimals
            500,                                        // 0.05% fee tier
            "IH Base Yield Vault",
            "ihBASE"
        )
    {}
}
