import { ethers } from "hardhat";
import { network } from "hardhat";

async function deployCrossChainContracts() {
  console.log("Deploying cross-chain compatible contracts...");
  
  // Get supported networks
  const supportedNetworks = [
    "hardhatMainnet",
    "hardhatOp", 
    "hardhatArbitrum",
    "hardhatPolygon",
    "hardhatBase",
    "sepolia",
    "sepoliaOptimism",
    "sepoliaArbitrum",
    "sepoliaPolygon",
    "sepoliaBase"
  ];

  const deployments: Record<string, any> = {};

  for (const networkName of supportedNetworks) {
    try {
      console.log(`\nDeploying to ${networkName}...`);
      
      // Connect to network
      const networkConfig = await network.connect({
        network: networkName,
      });
      
      const [deployer] = await ethers.getSigners();
      console.log(`Deploying with account: ${deployer.address}`);

      // Deploy main staking contract
      const StakingFactory = await ethers.getContractFactory("CrossChainStakingContract");
      const stakingContract = await StakingFactory.deploy();
      
      await stakingContract.waitForDeployment();
      const stakingAddress = await stakingContract.getAddress();
      
      // Deploy chain abstraction contract
      const ChainAbstractionFactory = await ethers.getContractFactory("ChainAbstraction");
      const chainAbstractionContract = await ChainAbstractionFactory.deploy();
      
      await chainAbstractionContract.waitForDeployment();
      const chainAbstractionAddress = await chainAbstractionContract.getAddress();

      // Get chain ID
      const networkData = await network.provider.getNetwork();
      const chainId = networkData.chainId;

      // Initialize contracts
      console.log("Initializing contracts...");
      
      // Initialize staking contract
      await stakingContract.initialize(
        deployer.address, // admin
        ethers.ZeroAddress, // staking_token (placeholder)
        ethers.ZeroAddress, // reward_token (placeholder)
        ethers.parseEther("0.1"), // reward_rate
        chainId // chain_id
      );

      // Initialize chain abstraction
      const supportedChains = [1, 3, 4, 5, 6]; // ETH, Polygon, Arbitrum, Optimism, Base
      await chainAbstractionContract.initializeChainAbstraction(
        deployer.address,
        supportedChains
      );

      deployments[networkName] = {
        chainId: chainId.toString(),
        stakingContract: stakingAddress,
        chainAbstractionContract: chainAbstractionAddress,
        deployer: deployer.address,
        network: networkName
      };

      console.log(`✅ Deployed to ${networkName}:`);
      console.log(`   Chain ID: ${chainId}`);
      console.log(`   Staking Contract: ${stakingAddress}`);
      console.log(`   Chain Abstraction: ${chainAbstractionAddress}`);

    } catch (error) {
      console.error(`❌ Failed to deploy to ${networkName}:`, error);
      deployments[networkName] = { error: error.message };
    }
  }

  // Save deployment information
  const fs = require("fs");
  const deploymentPath = "./deployments/cross-chain-deployments.json";
  
  // Ensure deployments directory exists
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deployments, null, 2));
  console.log(`\n📄 Deployment information saved to ${deploymentPath}`);

  // Print summary
  console.log("\n📊 Deployment Summary:");
  console.log("====================");
  
  const successful = Object.entries(deployments).filter(([_, data]) => !data.error);
  const failed = Object.entries(deployments).filter(([_, data]) => data.error);
  
  console.log(`✅ Successful deployments: ${successful.length}`);
  console.log(`❌ Failed deployments: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log("\nSuccessful deployments:");
    successful.forEach(([network, data]) => {
      console.log(`  ${network}: ${data.stakingContract}`);
    });
  }
  
  if (failed.length > 0) {
    console.log("\nFailed deployments:");
    failed.forEach(([network, data]) => {
      console.log(`  ${network}: ${data.error}`);
    });
  }
}

// Test cross-chain functionality
async function testCrossChainFunctionality() {
  console.log("\n🧪 Testing cross-chain functionality...");
  
  try {
    // Load deployments
    const fs = require("fs");
    const deployments = JSON.parse(fs.readFileSync("./deployments/cross-chain-deployments.json", "utf8"));
    
    // Test on local networks
    const localNetworks = ["hardhatMainnet", "hardhatOp"];
    
    for (const networkName of localNetworks) {
      if (!deployments[networkName] || deployments[networkName].error) {
        console.log(`⏭️  Skipping ${networkName} (deployment failed)`);
        continue;
      }
      
      console.log(`\nTesting on ${networkName}...`);
      
      await network.connect({ network: networkName });
      const [deployer] = await ethers.getSigners();
      
      // Get contract instances
      const stakingContract = await ethers.getContractAt(
        "CrossChainStakingContract", 
        deployments[networkName].stakingContract
      );
      
      const chainAbstractionContract = await ethers.getContractAt(
        "ChainAbstraction",
        deployments[networkName].chainAbstractionContract
      );
      
      // Test chain compatibility
      console.log("Testing chain compatibility...");
      const isCompatible = await chainAbstractionContract.validateChainCompatibility(1, 5); // Ethereum to Optimism
      console.log(`Ethereum ↔ Optimism compatible: ${isCompatible}`);
      
      // Test gas price estimation
      console.log("Testing gas price estimation...");
      const gasPrice = await chainAbstractionContract.get_chain_gas_price(1);
      console.log(`Ethereum gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
      
      // Test cross-chain cost estimation
      console.log("Testing cross-chain cost estimation...");
      const cost = await chainAbstractionContract.estimate_cross_chain_cost(1, 5, ethers.parseEther("1"));
      console.log(`Cross-chain cost (1 ETH from Ethereum to Optimism): ${ethers.formatEther(cost)} ETH`);
      
      // Test supported chains
      console.log("Testing supported chains...");
      const supportedChains = await chainAbstractionContract.get_active_chains();
      console.log(`Active chains: ${supportedChains.join(", ")}`);
      
      console.log(`✅ Tests passed on ${networkName}`);
    }
    
  } catch (error) {
    console.error("❌ Cross-chain tests failed:", error);
  }
}

async function main() {
  await deployCrossChainContracts();
  await testCrossChainFunctionality();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
