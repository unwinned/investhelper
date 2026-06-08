const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying IHBaseVault with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const Vault = await ethers.getContractFactory("IHBaseVault");
  const vault = await Vault.deploy();
  await vault.waitForDeployment();

  const addr = await vault.getAddress();
  console.log("\n✅ IHBaseVault deployed to:", addr);
  console.log("   Chain:   Base (8453)");
  console.log("   Asset:   WETH → split 50% USDC → AAVE v3");
  console.log("   Shares:  ihBASE (ERC-20, ERC-4626)");
  console.log("\nUpdate src/lib/contracts.js:");
  console.log(`   BASE.IH_VAULT: '${addr}'`);
  console.log("\nVerify on Basescan:");
  console.log(`   npx hardhat verify --network base ${addr}`);
}

main().catch(e => { console.error(e); process.exit(1); });
