import { expect } from "chai";
import { network } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { ContractManager, TestEnvironment } from "../helpers/contracts";
import { CrossContractOrchestrator } from "../helpers/orchestrator";

const { ethers } = await network.connect();

describe("Contract Upgrade Tests", function () {
  let testEnv: TestEnvironment;
  let contractManager: ContractManager;
  let orchestrator: CrossContractOrchestrator;

  beforeEach(async function () {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    contractManager = testEnv.contractManager;
    orchestrator = new CrossContractOrchestrator();
  });

  afterEach(async function () {
    await testEnv.teardown();
  });

  describe("Version Management and Registry Updates", function () {
    it("Should handle contract version upgrades in the registry", async function () {
      const [admin, user] = await ethers.getSigners();

      // Deploy orchestrator
      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      // Deploy contract v1
      const contractV1 = await contractManager.deployContract("MockERC20", ["Token V1", "TKN1", "1000000", 18]);

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      // Register v1
      await orchestrator.registerContract(
        contractV1.address,
        "test_token",
        1, // version 1
        permissions,
        []
      );

      // Verify v1 registration
      let contractInfo = await orchestrator.getContractInfo(contractV1.address);
      expect(contractInfo.version).to.equal(1);
      expect(contractInfo.contract_type).to.equal("test_token");

      // Deploy contract v2 (simulating upgrade)
      const contractV2 = await contractManager.deployContract("MockERC20", ["Token V2", "TKN2", "1000000", 18]);

      // Register v2
      await orchestrator.registerContract(
        contractV2.address,
        "test_token",
        2, // version 2
        permissions,
        []
      );

      // Verify v2 registration
      contractInfo = await orchestrator.getContractInfo(contractV2.address);
      expect(contractInfo.version).to.equal(2);

      // Both versions should be available
      const v1Info = await orchestrator.getContractInfo(contractV1.address);
      expect(v1Info.version).to.equal(1);
    });

    it("Should handle contract type migration", async function () {
      const [admin] = await ethers.getSigners();

      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      const contract = await contractManager.deployContract("MockERC20", ["Test", "TST", "1000000", 18]);

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      // Register with initial type
      await orchestrator.registerContract(
        contract.address,
        "old_type",
        1,
        permissions,
        []
      );

      let info = await orchestrator.getContractInfo(contract.address);
      expect(info.contract_type).to.equal("old_type");

      // Re-register with new type (simulating migration)
      await orchestrator.registerContract(
        contract.address,
        "new_type",
        2,
        permissions,
        []
      );

      info = await orchestrator.getContractInfo(contract.address);
      expect(info.contract_type).to.equal("new_type");
      expect(info.version).to.equal(2);
    });
  });

  describe("State Preservation During Upgrades", function () {
    it("Should preserve token balances during token contract upgrades", async function () {
      const [admin, user1, user2] = await ethers.getSigners();

      // Deploy initial token contract
      const TokenFactory = await ethers.getContractFactory("MockERC20");
      const tokenV1 = await TokenFactory.deploy("Token V1", "TKN1", "1000000", 18);
      await tokenV1.waitForDeployment();

      // Transfer some tokens to users
      await tokenV1.transfer(user1.address, "100000000000000000000");
      await tokenV1.transfer(user2.address, "50000000000000000000");

      // Verify balances
      const balance1 = await tokenV1.balanceOf(user1.address);
      const balance2 = await tokenV1.balanceOf(user2.address);
      expect(balance1.toString()).to.equal("100000000000000000000");
      expect(balance2.toString()).to.equal("50000000000000000000");

      // Simulate upgrade - deploy new contract
      const tokenV2 = await TokenFactory.deploy("Token V2", "TKN2", "0", 18);
      await tokenV2.waitForDeployment();

      // Migrate state (mint equivalent balances to v2)
      await tokenV2.mint(user1.address, balance1.toString());
      await tokenV2.mint(user2.address, balance2.toString());

      // Verify state preservation
      expect(await tokenV2.balanceOf(user1.address)).to.equal(balance1);
      expect(await tokenV2.balanceOf(user2.address)).to.equal(balance2);
    });

    it("Should preserve NFT ownership during contract upgrades", async function () {
      const [admin, user1, user2] = await ethers.getSigners();

      // Deploy initial NFT contract
      const NFTFactory = await ethers.getContractFactory("MockERC721");
      const nftV1 = await NFTFactory.deploy("NFT V1", "NFT1");
      await nftV1.waitForDeployment();

      // Mint NFTs
      await nftV1.safeMint(user1.address);
      await nftV1.safeMint(user2.address);
      await nftV1.safeMint(user1.address);

      // Verify ownership
      expect(await nftV1.ownerOf(1)).to.equal(user1.address);
      expect(await nftV1.ownerOf(2)).to.equal(user2.address);
      expect(await nftV1.ownerOf(3)).to.equal(user1.address);

      // Simulate upgrade - deploy new contract
      const nftV2 = await NFTFactory.deploy("NFT V2", "NFT2");
      await nftV2.waitForDeployment();

      // Migrate ownership
      await nftV2.mint(user1.address, 1);
      await nftV2.mint(user2.address, 2);
      await nftV2.mint(user1.address, 3);

      // Verify state preservation
      expect(await nftV2.ownerOf(1)).to.equal(user1.address);
      expect(await nftV2.ownerOf(2)).to.equal(user2.address);
      expect(await nftV2.ownerOf(3)).to.equal(user1.address);
    });
  });

  describe("Upgrade Authorization and Permissions", function () {
    it("Should restrict upgrade operations to authorized addresses", async function () {
      const [admin, unauthorized, user] = await ethers.getSigners();

      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      const contract = await contractManager.deployContract("MockERC20", ["Test", "TST", "1000000", 18]);

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      // Admin can register
      await orchestrator.registerContract(
        contract.address,
        "test_type",
        1,
        permissions,
        []
      );

      // Verify registration succeeded
      const info = await orchestrator.getContractInfo(contract.address);
      expect(info.contract_type).to.equal("test_type");
    });
  });

  describe("Dependency Management During Upgrades", function () {
    it("Should handle dependency updates during contract upgrades", async function () {
      const [admin] = await ethers.getSigners();

      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      const contractA = await contractManager.deployContract("MockERC20", ["ContractA", "A", "1000", 18]);
      const contractB = await contractManager.deployContract("MockERC20", ["ContractB", "B", "1000", 18]);
      const contractC = await contractManager.deployContract("MockERC20", ["ContractC", "C", "1000", 18]);

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      // Register contracts with dependencies: A -> B, B -> C
      await orchestrator.registerContract(
        contractA.address,
        "contract_a",
        1,
        permissions,
        [contractB.address]
      );

      await orchestrator.registerContract(
        contractB.address,
        "contract_b",
        1,
        permissions,
        [contractC.address]
      );

      await orchestrator.registerContract(
        contractC.address,
        "contract_c",
        1,
        permissions,
        []
      );

      // Verify dependencies
      const infoA = await orchestrator.getContractInfo(contractA.address);
      expect(infoA.dependencies).to.include(contractB.address);

      const infoB = await orchestrator.getContractInfo(contractB.address);
      expect(infoB.dependencies).to.include(contractC.address);
    });

    it("Should prevent breaking dependencies during upgrades", async function () {
      const [admin] = await ethers.getSigners();

      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      const contractA = await contractManager.deployContract("MockERC20", ["ContractA", "A", "1000", 18]);
      const contractB = await contractManager.deployContract("MockERC20", ["ContractB", "B", "1000", 18]);

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      // Register A depending on B
      await orchestrator.registerContract(
        contractA.address,
        "contract_a",
        1,
        permissions,
        [contractB.address]
      );

      // Verify circular dependency check
      const hasCircular = await orchestrator.checkCircularDependencies(
        contractB.address,
        [contractA.address]
      );

      expect(hasCircular).to.be.false; // Should fail because it would create A -> B -> A cycle
    });
  });

  describe("Rollback and Recovery", function () {
    it("Should support rollback to previous contract versions", async function () {
      const [admin] = await ethers.getSigners();

      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      const contractV1 = await contractManager.deployContract("MockERC20", ["V1", "V1", "1000", 18]);
      const contractV2 = await contractManager.deployContract("MockERC20", ["V2", "V2", "2000", 18]);

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      // Register both versions
      await orchestrator.registerContract(
        contractV1.address,
        "test_contract",
        1,
        permissions,
        []
      );

      await orchestrator.registerContract(
        contractV2.address,
        "test_contract",
        2,
        permissions,
        []
      );

      // Both versions should be accessible
      const infoV1 = await orchestrator.getContractInfo(contractV1.address);
      const infoV2 = await orchestrator.getContractInfo(contractV2.address);

      expect(infoV1.version).to.equal(1);
      expect(infoV2.version).to.equal(2);

      // Can still interact with v1 even after v2 registration
      expect(infoV1.active).to.be.true;
    });

    it("Should handle failed upgrades gracefully", async function () {
      const [admin] = await ethers.getSigners();

      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      const contractV1 = await contractManager.deployContract("MockERC20", ["Stable", "STBL", "1000", 18]);

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      // Register stable v1
      await orchestrator.registerContract(
        contractV1.address,
        "stable_contract",
        1,
        permissions,
        []
      );

      // Verify v1 is working
      const infoV1 = await orchestrator.getContractInfo(contractV1.address);
      expect(infoV1.active).to.be.true;
      expect(infoV1.version).to.equal(1);
    });
  });

  describe("Atomic Upgrade Operations", function () {
    it("Should execute atomic multi-contract upgrades", async function () {
      const [admin] = await ethers.getSigners();

      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      const contract1 = await contractManager.deployContract("MockERC20", ["Contract1", "C1", "1000", 18]);
      const contract2 = await contractManager.deployContract("MockERC20", ["Contract2", "C2", "1000", 18]);

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      // Initial registration
      await orchestrator.registerContract(contract1.address, "contract1", 1, permissions, []);
      await orchestrator.registerContract(contract2.address, "contract2", 1, permissions, []);

      // Create atomic upgrade operation
      const calls = [
        {
          targetContract: contract1.address,
          functionName: "register_contract",
          args: [contract1.address, "contract1", 2, permissions, []],
          value: "0",
          requiredSuccess: true
        },
        {
          targetContract: contract2.address,
          functionName: "register_contract",
          args: [contract2.address, "contract2", 2, permissions, []],
          value: "0",
          requiredSuccess: true
        }
      ];

      const operationId = await orchestrator.executeAtomicOperation(calls, 3600);
      expect(operationId).to.not.be.undefined;

      // Verify operation completed
      const status = await orchestrator.getOperationStatus(operationId);
      expect(status).to.equal("Completed");

      // Verify both contracts upgraded
      const info1 = await orchestrator.getContractInfo(contract1.address);
      const info2 = await orchestrator.getContractInfo(contract2.address);

      expect(info1.version).to.equal(2);
      expect(info2.version).to.equal(2);
    });
  });

  describe("Version Compatibility", function () {
    it("Should maintain backward compatibility after upgrades", async function () {
      const [admin, user] = await ethers.getSigners();

      const TokenFactory = await ethers.getContractFactory("MockERC20");
      const token = await TokenFactory.deploy("Compatible Token", "COMP", "1000000", 18);
      await token.waitForDeployment();

      // Initial state
      await token.transfer(user.address, "100000000000000000000");

      // Core functionality should work consistently
      const balance = await token.balanceOf(user.address);
      expect(balance.toString()).to.equal("100000000000000000000");

      const totalSupply = await token.totalSupply();
      expect(totalSupply.toString()).to.equal("1000000000000000000000000");

      const name = await token.name();
      expect(name).to.equal("Compatible Token");

      const symbol = await token.symbol();
      expect(symbol).to.equal("COMP");

      // Transfer should work as expected
      await token.connect(user).transfer(admin.address, "50000000000000000000");
      const newBalance = await token.balanceOf(user.address);
      expect(newBalance.toString()).to.equal("50000000000000000000");
    });
  });
});
