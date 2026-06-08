// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./IHYieldVault.sol";

/**
 * @title IHPolygonVault
 * @notice InvestHelper yield vault for Polygon chain.
 *         User sends MATIC → vault wraps to WMATIC → splits 50 % to USDC via Uniswap v3
 *         → supplies both to AAVE v3 on Polygon → earns AAVE yield on both sides.
 *
 * Mainnet addresses (Polygon, chainId 137):
 *   WMATIC / WPOL       0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270
 *   USDC (native)       0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
 *   AAVE v3 Pool        0x794a61358D6845594F94dc1DB02A252b5b4814aD
 *   AAVE AddrProvider   0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb
 *   aPolWMATIC          0x6d80113e83a2d74F571749161ca5454135CC524C
 *   aPolUSDCn           0xA4D94019934D8333Ef880ABFFbF2FDd611C762BD
 *   UniV3 Router02      0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45
 *   WMATIC/USDC fee     500 (0.05 %)
 */
contract IHPolygonVault is IHYieldVault {
    constructor()
        IHYieldVault(
            0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270, // WMATIC
            0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359, // USDC (native Polygon)
            0x794a61358D6845594F94dc1DB02A252b5b4814aD, // AAVE v3 Pool
            0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45, // UniV3 SwapRouter02
            0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb, // AAVE AddressesProvider
            0x6d80113e83a2d74F571749161ca5454135CC524C, // aPolWMATIC
            0xA4D94019934D8333Ef880ABFFbF2FDd611C762BD, // aPolUSDCn
            6,                                          // USDC decimals
            500,                                        // 0.05% fee tier
            "IH Polygon Yield Vault",
            "ihPOLY"
        )
    {}
}
