require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.23",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    base: {
      url: process.env.BASE_RPC || "https://mainnet.base.org",
      chainId: 8453,
      accounts: [DEPLOYER_KEY],
    },
    polygon: {
      url: process.env.POLYGON_RPC || "https://polygon-rpc.com",
      chainId: 137,
      accounts: [DEPLOYER_KEY],
    },
    bnb: {
      url: process.env.BNB_RPC || "https://bsc-dataseed.binance.org",
      chainId: 56,
      accounts: [DEPLOYER_KEY],
    },
    // Testnets (for dry-run)
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      chainId: 84532,
      accounts: [DEPLOYER_KEY],
    },
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: [DEPLOYER_KEY],
    },
  },
  etherscan: {
    apiKey: {
      base:    process.env.BASESCAN_API_KEY    || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      bnb:     process.env.BSCSCAN_API_KEY     || "",
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL:     "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },
  paths: {
    sources: "./src",
    tests:   "./test",
    cache:   "./cache",
    artifacts: "./artifacts",
  },
};
