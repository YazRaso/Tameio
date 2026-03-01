import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Tameio – TameioVault Deployment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Network      : ${(await ethers.provider.getNetwork()).name}`);
  console.log(
    `  Chain ID     : ${(await ethers.provider.getNetwork()).chainId}`,
  );
  console.log(`  Deployer     : ${deployer.address}`);
  console.log(`  Balance      : ${ethers.formatEther(balance)} MON`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (balance === 0n) {
    throw new Error(
      "Deployer account has no funds. " +
        "Get testnet MON from the Monad faucet at https://faucet.monad.xyz",
    );
  }

  // ── Deploy ───────────────────────────────────────────────────────────────
  const usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress) {
    throw new Error(
      "USDC_ADDRESS is not set in .env. " +
        "Set it to the USDC ERC-20 contract address on Monad testnet.",
    );
  }

  console.log(`  USDC Token   : ${usdcAddress}`);
  console.log("Deploying TameioVault…");
  const TameioVault = await ethers.getContractFactory("TameioVault");
  const vault = await TameioVault.deploy(usdcAddress);

  // Grab the transaction hash immediately from the pending deployment tx
  const deployTx = vault.deploymentTransaction();
  console.log(`\n  📦 Transaction Hash : ${deployTx?.hash}`);

  // Wait for the contract to be mined
  await vault.waitForDeployment();
  const contractAddress = await vault.getAddress();

  console.log(`  📄 Contract Address : ${contractAddress}`);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Explorer Links");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(
    `  MonadScan  : https://testnet.monadscan.com/address/${contractAddress}`,
  );
  console.log(
    `  MonadVision: https://testnet.monadvision.com/address/${contractAddress}`,
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("✅ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
