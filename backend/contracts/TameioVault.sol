// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title  TameioVault
 * @notice Core vault for Tameio – the bank of tomorrow, powered by Monad.
 *
 * @dev    Two core flows mirror the platform architecture:
 *
 *         LENDING  → Users call `deposit()` to lend MON to the platform.
 *                    Their balance is tracked; they can reclaim it via
 *                    `withdrawLenderFunds()` at any time (subject to liquidity).
 *
 *         BORROWING → After the off-chain risk engine approves a borrow request,
 *                    the Tameio backend calls `releaseToBorrower()` to push
 *                    funds to the borrower's wallet. The borrower's outstanding
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
contract TameioVault {
    // ── State ──────────────────────────────────────────────────────────────

    address public owner;

    /// @notice Amount each lender has deposited and not yet withdrawn.
    mapping(address => uint256) public lenderDeposits;

    /// @notice Outstanding (un-repaid) borrow balance per borrower.
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

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ── Lending ────────────────────────────────────────────────────────────

    /**
     * @notice Deposit MON into the vault (lenders use this).
     * @dev    Emits {Deposited}. Caches storage slot once to keep gas low
     *         given Monad's elevated cold-storage costs.
     */
    function deposit() external payable {
        require(msg.value > 0, "TameioVault: deposit must be > 0");

        // Cache → compute → write-back: one SLOAD + one SSTORE per mapping slot.
        uint256 current = lenderDeposits[msg.sender];
        lenderDeposits[msg.sender] = current + msg.value;
        totalDeposited += msg.value;

        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Lenders withdraw their own deposited funds.
     * @param  amount Amount of MON to withdraw (in wei).
     */
    function withdrawLenderFunds(uint256 amount) external {
        require(amount > 0, "TameioVault: amount must be > 0");

        uint256 balance = lenderDeposits[msg.sender]; // single SLOAD
        require(balance >= amount, "TameioVault: insufficient lender balance");
        require(address(this).balance >= amount, "TameioVault: insufficient vault liquidity");

        // Write-back before external call to prevent re-entrancy
        lenderDeposits[msg.sender] = balance - amount;
        totalDeposited -= amount;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "TameioVault: transfer failed");

        emit LenderWithdrew(msg.sender, amount);
    }

    // ── Borrowing ──────────────────────────────────────────────────────────

    /**
     * @notice Release funds to an approved borrower (only Tameio backend).
     * @dev    Called by the owner after the off-chain risk engine approves
     *         the borrow request. Emits {ReleasedToBorrower}.
     * @param  borrower Wallet address of the approved borrower.
     * @param  amount   Amount of MON to send (in wei).
     */
    function releaseToBorrower(address payable borrower, uint256 amount) external onlyOwner {
        require(borrower != address(0), "TameioVault: zero address");
        require(amount > 0, "TameioVault: amount must be > 0");
        require(address(this).balance >= amount, "TameioVault: insufficient vault liquidity");

        // Track outstanding debt before the external call
        borrowerDebt[borrower] += amount;
        totalBorrowed += amount;

        (bool ok, ) = borrower.call{value: amount}("");
        require(ok, "TameioVault: transfer to borrower failed");

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
     * @notice View the vault's current MON balance.
     */
    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ── Fallback ───────────────────────────────────────────────────────────

    /**
     * @dev Plain MON transfers (e.g. from a wallet) are treated as deposits.
     */
    receive() external payable {
        if (msg.value > 0) {
            lenderDeposits[msg.sender] += msg.value;
            totalDeposited += msg.value;
            emit Deposited(msg.sender, msg.value);
        }
    }
}
