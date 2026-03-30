import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    // Local development networks
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: 1,
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
      chainId: 5,
    },
    hardhatArbitrum: {
      type: "edr-simulated",
      chainType: "arbitrum",
      chainId: 4,
    },
    hardhatPolygon: {
      type: "edr-simulated",
      chainType: "polygon",
      chainId: 3,
    },
    hardhatBase: {
      type: "edr-simulated",
      chainType: "base",
      chainId: 6,
    },
    
    // Testnet networks
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
      chainId: 11155111,
    },
    sepoliaOptimism: {
      type: "http",
      chainType: "op",
      url: configVariable("SEPOLIA_OP_RPC_URL"),
      accounts: [configVariable("SEPOLIA_OP_PRIVATE_KEY")],
      chainId: 11155420,
    },
    sepoliaArbitrum: {
      type: "http",
      chainType: "arbitrum",
      url: configVariable("SEPOLIA_ARBITRUM_RPC_URL"),
      accounts: [configVariable("SEPOLIA_ARBITRUM_PRIVATE_KEY")],
      chainId: 421614,
    },
    sepoliaPolygon: {
      type: "http",
      chainType: "polygon",
      url: configVariable("SEPOLIA_POLYGON_RPC_URL"),
      accounts: [configVariable("SEPOLIA_POLYGON_PRIVATE_KEY")],
      chainId: 1389,
    },
    sepoliaBase: {
      type: "http",
      chainType: "base",
      url: configVariable("SEPOLIA_BASE_RPC_URL"),
      accounts: [configVariable("SEPOLIA_BASE_PRIVATE_KEY")],
      chainId: 84532,
    },
    
    // Mainnet networks (commented out for security)
    /*
    mainnet: {
      type: "http",
      chainType: "l1",
      url: configVariable("MAINNET_RPC_URL"),
      accounts: [configVariable("MAINNET_PRIVATE_KEY")],
      chainId: 1,
    },
    optimism: {
      type: "http",
      chainType: "op",
      url: configVariable("OPTIMISM_RPC_URL"),
      accounts: [configVariable("OPTIMISM_PRIVATE_KEY")],
      chainId: 10,
    },
    arbitrum: {
      type: "http",
      chainType: "arbitrum",
      url: configVariable("ARBITRUM_RPC_URL"),
      accounts: [configVariable("ARBITRUM_PRIVATE_KEY")],
      chainId: 42161,
    },
    polygon: {
      type: "http",
      chainType: "polygon",
      url: configVariable("POLYGON_RPC_URL"),
      accounts: [configVariable("POLYGON_PRIVATE_KEY")],
      chainId: 137,
    },
    base: {
      type: "http",
      chainType: "base",
      url: configVariable("BASE_RPC_URL"),
      accounts: [configVariable("BASE_PRIVATE_KEY")],
      chainId: 8453,
    },
    */
  },
});
