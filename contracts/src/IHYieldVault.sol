// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20}   from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20}  from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable}   from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface IWETH9 {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface IAaveOracle {
    function getAssetPrice(address asset) external view returns (uint256);
}

interface IPoolAddressesProvider {
    function getPriceOracle() external view returns (address);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata p) external payable returns (uint256);
}

// ─── Abstract base vault ─────────────────────────────────────────────────────

/**
 * @title IHYieldVault
 * @notice ERC-4626 vault that accepts native token (ETH / MATIC / BNB) in a single
 *         transaction with no prior approvals, wraps it, splits 50/50 between the
 *         wrapped native and a stablecoin, and supplies both to AAVE v3.
 *
 *         1 signing to deposit.  1 signing to withdraw.  Non-custodial — user holds
 *         vault share tokens (ERC-20) as proof of ownership.
 */
abstract contract IHYieldVault is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Immutables set per chain ──────────────────────────────────────────────
    IWETH9  public immutable WRAPPED_NATIVE;   // WETH / WMATIC / WBNB
    IERC20  public immutable STABLE;           // USDC / USDT
    IPool   public immutable AAVE_POOL;
    ISwapRouter public immutable SWAP_ROUTER;
    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;

    address public immutable A_WRAPPED;        // AAVE aToken for wrapped native
    address public immutable A_STABLE;         // AAVE aToken for stable
    uint8   public immutable STABLE_DECIMALS;  // 6 for USDC/USDT
    uint24  public immutable POOL_FEE;         // 500 = 0.05 %

    // ── Events ───────────────────────────────────────────────────────────────
    event NativeDeposited(address indexed user, uint256 native, uint256 shares);
    event NativeWithdrawn(address indexed user, uint256 shares, uint256 native);
    event EmergencyExit  (address indexed owner, uint256 native, uint256 stable);

    // ── Constructor ──────────────────────────────────────────────────────────
    constructor(
        address wrappedNative,
        address stable,
        address aavePool,
        address swapRouter,
        address addrProvider,
        address aWrapped,
        address aStable,
        uint8   stableDec,
        uint24  poolFee,
        string memory name_,
        string memory symbol_
    )
        ERC4626(IERC20(wrappedNative))
        ERC20(name_, symbol_)
        Ownable(msg.sender)
    {
        WRAPPED_NATIVE     = IWETH9(wrappedNative);
        STABLE             = IERC20(stable);
        AAVE_POOL          = IPool(aavePool);
        SWAP_ROUTER        = ISwapRouter(swapRouter);
        ADDRESSES_PROVIDER = IPoolAddressesProvider(addrProvider);
        A_WRAPPED          = aWrapped;
        A_STABLE           = aStable;
        STABLE_DECIMALS    = stableDec;
        POOL_FEE           = poolFee;
    }

    receive() external payable {}

    // ── Core: 1-signing deposit ──────────────────────────────────────────────

    /**
     * @notice  Send native token here — vault wraps, splits 50/50, supplies to AAVE,
     *          and mints vault shares to caller.  Zero prior approvals required.
     * @return  shares  Vault share tokens minted to msg.sender
     */
    function depositNative() external payable nonReentrant returns (uint256 shares) {
        uint256 amount = msg.value;
        require(amount > 1000, "IH: dust deposit");

        // snapshot assets BEFORE deposit so share math is correct
        uint256 assetsBefore = totalAssets();
        uint256 supplyBefore = totalSupply();

        // 1. Wrap native → ERC-20
        WRAPPED_NATIVE.deposit{value: amount}();

        // 2. Swap 50% → stablecoin
        uint256 nativeForSwap   = amount / 2;
        uint256 nativeToSupply  = amount - nativeForSwap;

        IERC20(address(WRAPPED_NATIVE)).forceApprove(address(SWAP_ROUTER), nativeForSwap);
        uint256 stableOut = SWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn:           address(WRAPPED_NATIVE),
                tokenOut:          address(STABLE),
                fee:               POOL_FEE,
                recipient:         address(this),
                amountIn:          nativeForSwap,
                amountOutMinimum:  0,
                sqrtPriceLimitX96: 0
            })
        );

        // 3. Supply WRAPPED_NATIVE to AAVE
        IERC20(address(WRAPPED_NATIVE)).forceApprove(address(AAVE_POOL), nativeToSupply);
        AAVE_POOL.supply(address(WRAPPED_NATIVE), nativeToSupply, address(this), 0);

        // 4. Supply STABLE to AAVE
        STABLE.forceApprove(address(AAVE_POOL), stableOut);
        AAVE_POOL.supply(address(STABLE), stableOut, address(this), 0);

        // 5. Mint shares (EIP-4626 formula with snapshot values)
        shares = supplyBefore == 0
            ? amount
            : (amount * supplyBefore) / assetsBefore;

        _mint(msg.sender, shares);
        emit NativeDeposited(msg.sender, amount, shares);
    }

    // ── Core: 1-signing withdrawal ───────────────────────────────────────────

    /**
     * @notice  Burn vault shares, exit AAVE positions proportionally, receive native token.
     * @param   shares  Amount of vault shares to redeem
     * @return  nativeOut  Native token sent to caller
     */
    function withdrawNative(uint256 shares) external nonReentrant returns (uint256 nativeOut) {
        require(shares > 0,                       "IH: zero shares");
        require(shares <= balanceOf(msg.sender),   "IH: insufficient shares");

        uint256 supply       = totalSupply();
        uint256 wrappedShare = IERC20(A_WRAPPED).balanceOf(address(this)) * shares / supply;
        uint256 stableShare  = IERC20(A_STABLE ).balanceOf(address(this)) * shares / supply;

        _burn(msg.sender, shares);

        // 1. Exit AAVE positions
        uint256 wrappedOut = AAVE_POOL.withdraw(address(WRAPPED_NATIVE), wrappedShare, address(this));
        uint256 stableOut  = AAVE_POOL.withdraw(address(STABLE),         stableShare,  address(this));

        // 2. Swap stable → wrapped native
        STABLE.forceApprove(address(SWAP_ROUTER), stableOut);
        uint256 nativeFromStable = SWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn:           address(STABLE),
                tokenOut:          address(WRAPPED_NATIVE),
                fee:               POOL_FEE,
                recipient:         address(this),
                amountIn:          stableOut,
                amountOutMinimum:  0,
                sqrtPriceLimitX96: 0
            })
        );

        // 3. Unwrap and send native
        nativeOut = wrappedOut + nativeFromStable;
        WRAPPED_NATIVE.withdraw(nativeOut);
        (bool ok,) = msg.sender.call{value: nativeOut}("");
        require(ok, "IH: transfer failed");

        emit NativeWithdrawn(msg.sender, shares, nativeOut);
    }

    // ── ERC-4626 totalAssets ─────────────────────────────────────────────────

    /**
     * @notice  Total vault value denominated in wrapped native token units.
     *          Uses AAVE oracle for live USD prices to convert stable → native.
     */
    function totalAssets() public view override returns (uint256) {
        IAaveOracle oracle = IAaveOracle(ADDRESSES_PROVIDER.getPriceOracle());

        uint256 nativePrice = oracle.getAssetPrice(address(WRAPPED_NATIVE)); // USD, 8 dec
        uint256 stablePrice = oracle.getAssetPrice(address(STABLE));          // USD, 8 dec

        uint256 nativeBal = IERC20(A_WRAPPED).balanceOf(address(this)); // 18 dec
        uint256 stableBal = IERC20(A_STABLE ).balanceOf(address(this)); // STABLE_DECIMALS dec

        // stable → native: scale stable to 18 dec first
        uint256 stableIn18  = stableBal * (10 ** (18 - STABLE_DECIMALS));
        uint256 stableAsNat = (stableIn18 * stablePrice) / nativePrice;

        return nativeBal + stableAsNat;
    }

    // ── View helpers ─────────────────────────────────────────────────────────

    /** @notice Native value of one vault share (in wei). */
    function sharePrice() external view returns (uint256) {
        uint256 supply = totalSupply();
        return supply == 0 ? 1e18 : (totalAssets() * 1e18) / supply;
    }

    /** @notice Native value of caller's position. */
    function positionValue(address user) external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        return (balanceOf(user) * totalAssets()) / supply;
    }

    // ── Emergency ────────────────────────────────────────────────────────────

    /**
     * @notice  Owner-only: exit all AAVE positions and send assets to owner.
     *          Use only in case of AAVE exploit or critical vault bug.
     */
    function emergencyExit() external onlyOwner {
        uint256 wrappedBal = IERC20(A_WRAPPED).balanceOf(address(this));
        uint256 stableBal  = IERC20(A_STABLE ).balanceOf(address(this));

        if (wrappedBal > 0) AAVE_POOL.withdraw(address(WRAPPED_NATIVE), type(uint256).max, owner());
        if (stableBal  > 0) AAVE_POOL.withdraw(address(STABLE),         type(uint256).max, owner());

        emit EmergencyExit(owner(), wrappedBal, stableBal);
    }
}
