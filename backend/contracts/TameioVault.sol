// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title  TameioVault
 * @notice Core vault for Tameio – the bank of tomorrow, powered by Monad.
 *
 * @dev    Two core flows mirror the platform architecture:
 *
 *         LENDING  → Users call `deposit(uint256)` to lend USDC to the platform.
 *                    Their balance is tracked; they can reclaim it via
 *                    `withdrawLenderFunds()` at any time (subject to liquidity).
 *                    Requires prior ERC-20 approval of this contract.
 *
 *         BORROWING → After the off-chain risk engine approves a borrow request,
 *                    the Tameio backend calls `releaseToBorrower()` to push
 *                    USDC to the borrower's wallet. The borrower's outstanding
 *                    debt is tracked on-chain.
 *
 * Monad-specific design notes
 * ───────────────────────────
 * • `evmVersion: "prague"` is set in hardhat.config.ts – required for Monad.
 * • Storage cold-access cost on Monad is 8,100 gas (vs 2,100 on Ethereum).
 *   To minimise gas: every function caches the relevant storage slot into a
 *   local variable and writes back once, avoiding redundant SLOADs.
 * • Blocks finalise in ~800 ms (2 blocks). Off-chain logic that depends on
 *   finality should poll for the "Verified" block stage.
 * • Max contract size is 128 KB on Monad (vs 24.5 KB on Ethereum) – plenty
 *   of headroom for future feature additions.
 */

/// @dev Minimal ERC-20 interface – only the methods TameioVault needs.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TameioVault {
    // ── State ──────────────────────────────────────────────────────────────

    address public owner;

    /// @notice The USDC token contract this vault operates with.
    IERC20 public immutable usdc;

    /// @notice Amount each lender has deposited and not yet withdrawn (in USDC, 6 decimals).
    mapping(address => uint256) public lenderDeposits;

    /// @notice Outstanding (un-repaid) borrow balance per borrower (in USDC, 6 decimals).
    mapping(address => uint256) public borrowerDebt;

    /// @notice Sum of all active lender deposits.
    uint256 public totalDeposited;

    /// @notice Sum of all funds released to borrowers (not yet repaid).
    uint256 public totalBorrowed;

    // ── Events ─────────────────────────────────────────────────────────────

    event Deposited(address indexed lender, uint256 amount);
    event LenderWithdrew(address indexed lender, uint256 amount);
    event ReleasedToBorrower(address indexed borrower, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ── Modifiers ──────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "TameioVault: caller is not the owner");
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────────

    /// @param _usdc Address of the USDC ERC-20 token on this network.
    constructor(address _usdc) {
        require(_usdc != address(0), "TameioVault: zero USDC address");
        owner = msg.sender;
        usdc = IERC20(_usdc);
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ── Lending ────────────────────────────────────────────────────────────

    /**
     * @notice Deposit USDC into the vault (lenders use this).
     * @dev    Caller must have approved this contract for at least `amount` USDC
     *         before calling. Emits {Deposited}. Caches storage slot once to
     *         keep gas low given Monad's elevated cold-storage costs.
     * @param  amount Amount of USDC to deposit (6-decimal units).
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "TameioVault: deposit must be > 0");

        // Pull USDC from the caller – reverts if allowance or balance is insufficient.
        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "TameioVault: USDC transferFrom failed"
        );

        // Cache → compute → write-back: one SLOAD + one SSTORE per mapping slot.
        uint256 current = lenderDeposits[msg.sender];
        lenderDeposits[msg.sender] = current + amount;
        totalDeposited += amount;

        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Lenders withdraw their own deposited USDC.
     * @param  amount Amount of USDC to withdraw (6-decimal units).
     */
    function withdrawLenderFunds(uint256 amount) external {
        require(amount > 0, "TameioVault: amount must be > 0");

        uint256 balance = lenderDeposits[msg.sender]; // single SLOAD
        require(balance >= amount, "TameioVault: insufficient lender balance");
        require(usdc.balanceOf(address(this)) >= amount, "TameioVault: insufficient vault liquidity");

        // Write-back before external call to prevent re-entrancy.
        lenderDeposits[msg.sender] = balance - amount;
        totalDeposited -= amount;

        require(usdc.transfer(msg.sender, amount), "TameioVault: USDC transfer failed");

        emit LenderWithdrew(msg.sender, amount);
    }

    // ── Borrowing ──────────────────────────────────────────────────────────

    /**
     * @notice Release USDC to an approved borrower (only Tameio backend).
     * @dev    Called by the owner after the off-chain risk engine approves
     *         the borrow request. Emits {ReleasedToBorrower}.
     * @param  borrower Wallet address of the approved borrower.
     * @param  amount   Amount of USDC to send (6-decimal units).
     */
    function releaseToBorrower(address borrower, uint256 amount) external onlyOwner {
        require(borrower != address(0), "TameioVault: zero address");
        require(amount > 0, "TameioVault: amount must be > 0");
        require(usdc.balanceOf(address(this)) >= amount, "TameioVault: insufficient vault liquidity");

        // Track outstanding debt before the external call.
        borrowerDebt[borrower] += amount;
        totalBorrowed += amount;

        require(usdc.transfer(borrower, amount), "TameioVault: USDC transfer to borrower failed");

        emit ReleasedToBorrower(borrower, amount);
    }

    /**
     * @notice Release USDC directly into the Unlink privacy pool on behalf of a borrower.
     * @dev    Called by the owner with ZK deposit calldata pre-computed by the borrower's
     *         browser. The vault approves `poolAddress` for `amount`, then executes
     *         `poolCalldata` (which encodes pool.deposit(vaultAddress, notes, ciphertexts)).
     *         USDC moves: vault → Unlink pool directly — borrower's EOA is never touched.
     * @param  borrower     Wallet address of the approved borrower (for debt tracking).
     * @param  amount       Amount of USDC to send (18-decimal units matching USDCm).
     * @param  poolAddress  Address of the Unlink pool contract.
     * @param  poolCalldata ABI-encoded pool.deposit(...) call with ZK note commitments.
     */
    function releaseToBorrowerPrivate(
        address borrower,
        uint256 amount,
        address poolAddress,
        bytes calldata poolCalldata
    ) external onlyOwner {
        require(borrower != address(0), "TameioVault: zero address");
        require(amount > 0, "TameioVault: amount must be > 0");
        require(poolAddress != address(0), "TameioVault: zero pool address");
        require(usdc.balanceOf(address(this)) >= amount, "TameioVault: insufficient vault liquidity");

        // Track outstanding debt before external calls.
        borrowerDebt[borrower] += amount;
        totalBorrowed += amount;

        // Approve the Unlink pool to pull `amount` USDC from this vault.
        require(usdc.approve(poolAddress, amount), "TameioVault: approve failed");

        // Execute the pre-computed pool deposit calldata.
        // The calldata encodes pool.deposit(address(this), notes, ciphertexts)
        // so the pool calls transferFrom(vault, pool, amount) internally.
        (bool success, ) = poolAddress.call(poolCalldata);
        require(success, "TameioVault: Unlink pool deposit failed");

        // Reset approval to zero as a safety measure after the call.
        usdc.approve(poolAddress, 0);

        emit ReleasedToBorrower(borrower, amount);
    }

    // ── Admin ──────────────────────────────────────────────────────────────

    /**
     * @notice Transfer vault ownership to a new address.
     * @param  newOwner The new owner (e.g. a multisig or upgraded backend key).
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "TameioVault: zero address");
        address old = owner;
        owner = newOwner;
        emit OwnershipTransferred(old, newOwner);
    }

    /**
     * @notice View the vault's current USDC balance.
     */
    function vaultBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
