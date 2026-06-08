const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying IHBNBVault with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  const Vault = await ethers.getContractFactory("IHBNBVault");
  const vault = await Vault.deploy();
  await vault.waitForDeployment();

  const addr = await vault.getAddress();
  console.log("\n✅ IHBNBVault deployed to:", addr);
  console.log("   Chain:   BNB Chain (56)");
  console.log("   Asset:   WBNB → split 50% USDT → AAVE v3");
  console.log("   Shares:  ihBNB (ERC-20, ERC-4626)");
  console.log("\nUpdate src/lib/contracts.js:");
  console.log(`   BNB.IH_VAULT: '${addr}'`);
  console.log("\nVerify on BSCScan:");
  console.log(`   npx hardhat verify --network bnb ${addr}`);
}

main().catch(e => { console.error(e); process.exit(1); });
