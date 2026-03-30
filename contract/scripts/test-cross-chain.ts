import { ethers } from "hardhat";
import { network } from "hardhat";

async function testCrossChainCompatibility() {
  console.log("🧪 Testing Cross-Chain Compatibility");
  console.log("=====================================");
  
  // Test networks
  const testNetworks = [
    { name: "hardhatMainnet", chainId: 1, type: "l1" },
    { name: "hardhatOp", chainId: 5, type: "op" },
    { name: "hardhatArbitrum", chainId: 4, type: "arbitrum" },
    { name: "hardhatPolygon", chainId: 3, type: "polygon" },
    { name: "hardhatBase", chainId: 6, type: "base" }
  ];

  const testResults: Record<string, any> = {};

  for (const testNetwork of testNetworks) {
    console.log(`\n📍 Testing ${testNetwork.name} (Chain ID: ${testNetwork.chainId})`);
    
    try {
      // Connect to network
      await network.connect({ network: testNetwork.name });
      const [deployer] = await ethers.getSigners();
      
      // Deploy contracts for testing
      console.log("  📦 Deploying test contracts...");
      
      const StakingFactory = await ethers.getContractFactory("CrossChainStakingContract");
      const stakingContract = await StakingFactory.deploy();
      await stakingContract.waitForDeployment();
      
      const ChainAbstractionFactory = await ethers.getContractFactory("ChainAbstraction");
      const chainAbstractionContract = await ChainAbstractionFactory.deploy();
      await chainAbstractionContract.waitForDeployment();

      // Initialize contracts
      const supportedChains = [1, 3, 4, 5, 6];
      await chainAbstractionContract.initializeChainAbstraction(deployer.address, supportedChains);
      
      // Test 1: Chain Compatibility
      console.log("  🔗 Testing chain compatibility...");
      const compatibilityTests = [
        { from: 1, to: 3, desc: "Ethereum → Polygon" },
        { from: 1, to: 5, desc: "Ethereum → Optimism" },
        { from: 3, to: 4, desc: "Polygon → Arbitrum" },
        { from: 5, to: 6, desc: "Optimism → Base" }
      ];
      
      const compatibilityResults = [];
      for (const test of compatibilityTests) {
        const isCompatible = await chainAbstractionContract.validateChainCompatibility(test.from, test.to);
        compatibilityResults.push({
          test: test.desc,
          compatible: isCompatible,
          from: test.from,
          to: test.to
        });
        console.log(`    ${test.desc}: ${isCompatible ? "✅" : "❌"}`);
      }

      // Test 2: Gas Price Estimation
      console.log("  ⛽ Testing gas price estimation...");
      const gasPriceTests = [1, 3, 4, 5, 6];
      const gasPriceResults = [];
      
      for (const chainId of gasPriceTests) {
        try {
          const gasPrice = await chainAbstractionContract.get_chain_gas_price(chainId);
          const gasPriceGwei = ethers.formatUnits(gasPrice, "gwei");
          gasPriceResults.push({
            chainId,
            gasPrice: gasPrice.toString(),
            gasPriceGwei
          });
          console.log(`    Chain ${chainId}: ${gasPriceGwei} gwei`);
        } catch (error) {
          console.log(`    Chain ${chainId}: ❌ Error - ${error.message}`);
        }
      }

      // Test 3: Cross-Chain Cost Estimation
      console.log("  💰 Testing cross-chain cost estimation...");
      const costTests = [
        { from: 1, to: 3, amount: "1", desc: "1 ETH: Ethereum → Polygon" },
        { from: 1, to: 5, amount: "0.5", desc: "0.5 ETH: Ethereum → Optimism" },
        { from: 3, to: 4, amount: "10", desc: "10 ETH: Polygon → Arbitrum" }
      ];
      
      const costResults = [];
      for (const test of costTests) {
        try {
          const cost = await chainAbstractionContract.estimate_cross_chain_cost(
            test.from,
            test.to,
            ethers.parseEther(test.amount)
          );
          const costEth = ethers.formatEther(cost);
          costResults.push({
            test: test.desc,
            cost: cost.toString(),
            costEth,
            from: test.from,
            to: test.to,
            amount: test.amount
          });
          console.log(`    ${test.desc}: ${costEth} ETH`);
        } catch (error) {
          console.log(`    ${test.desc}: ❌ Error - ${error.message}`);
        }
      }

      // Test 4: Address Validation
      console.log("  🏠 Testing address validation...");
      const addressValidationResults = [];
      
      for (const chainId of [1, 3, 4, 5, 6]) {
        try {
          const isValid = await chainAbstractionContract.validate_chain_address(chainId, deployer.address);
          addressValidationResults.push({
            chainId,
            address: deployer.address,
            valid: isValid
          });
          console.log(`    Chain ${chainId}: ${isValid ? "✅" : "❌"}`);
        } catch (error) {
          console.log(`    Chain ${chainId}: ❌ Error - ${error.message}`);
        }
      }

      // Test 5: Chain Metadata
      console.log("  📊 Testing chain metadata...");
      const metadataResults = [];
      
      for (const chainId of [1, 3, 4, 5, 6]) {
        try {
          const metadata = await chainAbstractionContract.get_chain_metadata(chainId);
          if (metadata) {
            const [chainName, gasLimit, confirmations, active] = metadata;
            metadataResults.push({
              chainId,
              chainName: chainName.toString(),
              gasLimit: gasLimit.toString(),
              confirmations: confirmations.toString(),
              active
            });
            console.log(`    Chain ${chainId} (${chainName}): ${active ? "✅ Active" : "❌ Inactive"}`);
          } else {
            console.log(`    Chain ${chainId}: ❌ Not configured`);
          }
        } catch (error) {
          console.log(`    Chain ${chainId}: ❌ Error - ${error.message}`);
        }
      }

      // Test 6: Amount Conversion
      console.log("  🔄 Testing amount conversion...");
      const conversionTests = [
        { from: 1, to: 3, amount: "1000", desc: "1000 tokens: Ethereum → Polygon" },
        { from: 3, to: 1, amount: "1000", desc: "1000 tokens: Polygon → Ethereum" },
        { from: 1, to: 2, amount: "1000", desc: "1000 tokens: Ethereum → Stellar" }
      ];
      
      const conversionResults = [];
      for (const test of conversionTests) {
        try {
          const converted = await chainAbstractionContract.convert_amount_between_chains(
            ethers.parseEther(test.amount),
            test.from,
            test.to
          );
          const convertedEth = ethers.formatEther(converted);
          conversionResults.push({
            test: test.desc,
            original: test.amount,
            converted: converted.toString(),
            convertedEth,
            from: test.from,
            to: test.to
          });
          console.log(`    ${test.desc}: ${convertedEth} tokens`);
        } catch (error) {
          console.log(`    ${test.desc}: ❌ Error - ${error.message}`);
        }
      }

      // Store results
      testResults[testNetwork.name] = {
        success: true,
        chainId: testNetwork.chainId,
        compatibility: compatibilityResults,
        gasPrices: gasPriceResults,
        costs: costResults,
        addressValidation: addressValidationResults,
        metadata: metadataResults,
        conversions: conversionResults
      };

      console.log(`  ✅ All tests completed for ${testNetwork.name}`);

    } catch (error) {
      console.error(`  ❌ Tests failed for ${testNetwork.name}:`, error.message);
      testResults[testNetwork.name] = {
        success: false,
        error: error.message
      };
    }
  }

  // Save test results
  const fs = require("fs");
  const resultsPath = "./test-results/cross-chain-test-results.json";
  
  // Ensure test-results directory exists
  if (!fs.existsSync("./test-results")) {
    fs.mkdirSync("./test-results");
  }
  
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
  console.log(`\n📄 Test results saved to ${resultsPath}`);

  // Print summary
  console.log("\n📊 Test Summary");
  console.log("================");
  
  const successful = Object.entries(testResults).filter(([_, data]) => data.success);
  const failed = Object.entries(testResults).filter(([_, data]) => !data.success);
  
  console.log(`✅ Successful networks: ${successful.length}`);
  console.log(`❌ Failed networks: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log("\n✅ Successful networks:");
    successful.forEach(([network, _]) => {
      console.log(`  ${network}`);
    });
  }
  
  if (failed.length > 0) {
    console.log("\n❌ Failed networks:");
    failed.forEach(([network, data]) => {
      console.log(`  ${network}: ${data.error}`);
    });
  }

  // Overall compatibility check
  console.log("\n🔗 Cross-Chain Compatibility Summary:");
  const allCompatibilityTests = successful.flatMap(([_, data]) => data.compatibility || []);
  const compatibleRoutes = allCompatibilityTests.filter((test: any) => test.compatible).length;
  const totalRoutes = allCompatibilityTests.length;
  
  console.log(`  Compatible routes: ${compatibleRoutes}/${totalRoutes} (${((compatibleRoutes/totalRoutes)*100).toFixed(1)}%)`);
  
  if (compatibleRoutes === totalRoutes) {
    console.log("  🎉 All cross-chain routes are compatible!");
  } else {
    console.log("  ⚠️  Some cross-chain routes have compatibility issues");
  }
}

async function main() {
  await testCrossChainCompatibility();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
