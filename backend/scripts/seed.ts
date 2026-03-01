/**
 * Seed script – deposits USDC from the deployer wallet into TameioVault
 * so that releaseToBorrower has liquidity to work with.
 *
 * Usage:
 *   npx hardhat run scripts/seed.ts --network monadTestnet
 *
 * Configure SEED_AMOUNT_USDC below (default: 100 USDC).
 */
import { ethers } from "hardhat";

// ── Config ───────────────────────────────────────────────────────────────────
const VAULT_ADDRESS = process.env.VAULT_ADDRESS ?? "0x332456394FE65bb3D6CC646B015ddc6D73876e80";
const USDC_ADDRESS  = process.env.USDC_ADDRESS  ?? "0xc4fB617E4E4CfbdEb07216dFF62B4E46a2D6FdF6";
const SEED_AMOUNT_USDC = 500; // USDC to deposit (human-readable)

// Minimal ERC-20 ABI
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const network  = await ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Tameio – Vault Seed");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Network      : ${network.name} (chain ${network.chainId})`);
  console.log(`  Signer       : ${signer.address}`);
  console.log(`  Vault        : ${VAULT_ADDRESS}`);
  console.log(`  USDC         : ${USDC_ADDRESS}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ── Connect to USDC token ────────────────────────────────────────────────
  const usdc     = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
  const decimals = await usdc.decimals() as bigint;
  const symbol   = await usdc.symbol() as string;
  const seedAmt  = BigInt(SEED_AMOUNT_USDC) * 10n ** decimals;

  const signerBal = await usdc.balanceOf(signer.address) as bigint;
  const vaultBalBefore = await usdc.balanceOf(VAULT_ADDRESS) as bigint;

  console.log(`  ${symbol} decimals  : ${decimals}`);
  console.log(`  Signer balance: ${ethers.formatUnits(signerBal, decimals)} ${symbol}`);
  console.log(`  Vault balance (before): ${ethers.formatUnits(vaultBalBefore, decimals)} ${symbol}`);
  console.log(`  Seed amount   : ${SEED_AMOUNT_USDC} ${symbol}\n`);

  if (signerBal < seedAmt) {
    throw new Error(
      `Insufficient ${symbol} balance. ` +
      `Need ${SEED_AMOUNT_USDC}, have ${ethers.formatUnits(signerBal, decimals)}.`
    );
  }

  // ── Step 1: Approve vault to pull USDC ───────────────────────────────────
  console.log(`Step 1/2 – Approving vault to spend ${SEED_AMOUNT_USDC} ${symbol}…`);
  const approveTx = await usdc.approve(VAULT_ADDRESS, seedAmt);
  await approveTx.wait();
  console.log(`  ✅ Approved  (tx: ${approveTx.hash})\n`);

  // ── Step 2: Deposit into vault ───────────────────────────────────────────
  console.log(`Step 2/2 – Depositing ${SEED_AMOUNT_USDC} ${symbol} into vault…`);
  const vaultArtifact = await ethers.getContractFactory("TameioVault");
  const vault = vaultArtifact.attach(VAULT_ADDRESS);
  const depositTx = await vault.deposit(seedAmt);
  await depositTx.wait();
  console.log(`  ✅ Deposited (tx: ${depositTx.hash})\n`);

  // ── Final balances ────────────────────────────────────────────────────────
  const vaultBalAfter = await usdc.balanceOf(VAULT_ADDRESS) as bigint;
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Vault balance (after): ${ethers.formatUnits(vaultBalAfter, decimals)} ${symbol}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ✅ Vault seeded successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
