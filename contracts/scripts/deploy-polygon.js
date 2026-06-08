const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying IHPolygonVault with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MATIC");

  const Vault = await ethers.getContractFactory("IHPolygonVault");
  const vault = await Vault.deploy();
  await vault.waitForDeployment();

  const addr = await vault.getAddress();
  console.log("\n✅ IHPolygonVault deployed to:", addr);
  console.log("   Chain:   Polygon (137)");
  console.log("   Asset:   WMATIC → split 50% USDC → AAVE v3");
  console.log("   Shares:  ihPOLY (ERC-20, ERC-4626)");
  console.log("\nUpdate src/lib/contracts.js:");
  console.log(`   POLYGON.IH_VAULT: '${addr}'`);
  console.log("\nVerify on Polygonscan:");
  console.log(`   npx hardhat verify --network polygon ${addr}`);
}

main().catch(e => { console.error(e); process.exit(1); });
