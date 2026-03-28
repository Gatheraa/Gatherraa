import { expect } from "chai";
import { network } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { ContractManager, TestEnvironment } from "../helpers/contracts";
import { CrossContractOrchestrator, MultiContractManager } from "../helpers/orchestrator";

const { ethers } = await network.connect();

describe("Cross-Contract Integration Tests", function () {
  let testEnv: TestEnvironment;
  let contractManager: ContractManager;
  let orchestrator: CrossContractOrchestrator;
  let multiManager: MultiContractManager;

  beforeEach(async function () {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    contractManager = testEnv.contractManager;
    orchestrator = new CrossContractOrchestrator();
    multiManager = new MultiContractManager(orchestrator);
  });

  afterEach(async function () {
    await testEnv.teardown();
  });

  describe("Contract Registration and Discovery", function () {
    it("Should register multiple contracts and retrieve them by type", async function () {
      const [admin] = await ethers.getSigners();
      
      // Deploy orchestrator
      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      // Deploy test contracts
      const ticketContract = await contractManager.deployContract("MockERC721", ["Ticket", "TICK"]);
      const eventFactory = await contractManager.deployContract("MockERC20", ["Event Token", "EVNT", "1000000", 18]);

      // Register contracts
      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      await orchestrator.registerContract(
        ticketContract.address,
        "ticket_contract",
        1,
        permissions,
        []
      );

      await orchestrator.registerContract(
        eventFactory.address,
        "event_factory",
        1,
        permissions,
        []
      );

      // Verify contracts are registered
      const ticketInfo = await orchestrator.getContractInfo(ticketContract.address);
      expect(ticketInfo.contract_type).to.equal("ticket_contract");

      const factoryInfo = await orchestrator.getContractInfo(eventFactory.address);
      expect(factoryInfo.contract_type).to.equal("event_factory");
    });

    it("Should prevent circular dependencies during registration", async function () {
      const [admin] = await ethers.getSigners();
      
      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      const contract1 = await contractManager.deployContract("MockERC20", ["Contract1", "C1", "1000", 18]);
      const contract2 = await contractManager.deployContract("MockERC20", ["Contract2", "C2", "1000", 18]);
      const contract3 = await contractManager.deployContract("MockERC20", ["Contract3", "C3", "1000", 18]);

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      // Register contract1 depending on contract2
      await orchestrator.registerContract(
        contract1.address,
        "contract1",
        1,
        permissions,
        [contract2.address]
      );

      // Register contract2 depending on contract3
      await orchestrator.registerContract(
        contract2.address,
        "contract2",
        1,
        permissions,
        [contract3.address]
      );

      // Try to register contract3 depending on contract1 (creates circular dependency)
      await expect(
        orchestrator.registerContract(
          contract3.address,
          "contract3",
          1,
          permissions,
          [contract1.address]
        )
      ).to.be.reverted;
    });
  });

  describe("Cross-Contract Calls", function () {
    it("Should execute single cross-contract calls successfully", async function () {
      const [admin, user1] = await ethers.getSigners();
      
      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      const tokenContract = await contractManager.deployContract("MockERC20", ["Test Token", "TEST", "1000000", 18]);

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      await orchestrator.registerContract(
        tokenContract.address,
        "token_contract",
        1,
        permissions,
        []
      );

      // Execute cross-contract call
      const result = await orchestrator.executeSingleCall(
        tokenContract.address,
        "balanceOf",
        [user1.address]
      );

      expect(result.success).to.be.true;
      expect(result.transactionHash).to.not.be.undefined;
    });

    it("Should execute atomic multi-contract operations", async function () {
      const [admin] = await ethers.getSigners();
      
      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      const contract1 = await contractManager.deployContract("MockERC20", ["Contract1", "C1", "1000000", 18]);
      const contract2 = await contractManager.deployContract("MockERC20", ["Contract2", "C2", "1000000", 18]);

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      await orchestrator.registerContract(contract1.address, "contract1", 1, permissions, []);
      await orchestrator.registerContract(contract2.address, "contract2", 1, permissions, []);

      // Create atomic operation
      const calls = [
        {
          targetContract: contract1.address,
          functionName: "transfer",
          args: [admin.address, "100"],
          value: "0",
          requiredSuccess: true
        },
        {
          targetContract: contract2.address,
          functionName: "approve",
          args: [admin.address, "100"],
          value: "0",
          requiredSuccess: true
        }
      ];

      const operationId = await orchestrator.executeAtomicOperation(calls, 3600);
      expect(operationId).to.not.be.undefined;

      // Check operation status
      const status = await orchestrator.getOperationStatus(operationId);
      expect(status).to.equal("Completed");
    });

    it("Should handle failed atomic operations with rollback", async function () {
      const [admin] = await ethers.getSigners();
      
      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      const contract1 = await contractManager.deployContract("MockERC20", ["Contract1", "C1", "1000", 18]);

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      await orchestrator.registerContract(contract1.address, "contract1", 1, permissions, []);

      // Create operation with failing call
      const calls = [
        {
          targetContract: contract1.address,
          functionName: "transfer",
          args: [admin.address, "2000"], // Amount exceeds balance
          value: "0",
          requiredSuccess: true
        }
      ];

      try {
        await orchestrator.executeAtomicOperation(calls, 3600);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("revert");
      }
    });
  });

  describe("Callback System", function () {
    it("Should register and trigger callbacks between contracts", async function () {
      const [admin] = await ethers.getSigners();
      
      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      const triggerContract = await contractManager.deployContract("MockERC20", ["Trigger", "TRIG", "1000", 18]);
      const callbackContract = await contractManager.deployContract("MockERC20", ["Callback", "CB", "1000", 18]);

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      await orchestrator.registerContract(triggerContract.address, "trigger", 1, permissions, []);
      await orchestrator.registerContract(callbackContract.address, "callback", 1, permissions, []);

      // Register callback
      const callbackId = await orchestrator.registerCallback(
        triggerContract.address,
        "transfer",
        callbackContract.address,
        "mint",
        []
      );

      expect(callbackId).to.not.be.undefined;
    });
  });

  describe("Contract State Management", function () {
    it("Should track contract states correctly", async function () {
      const [admin] = await ethers.getSigners();
      
      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      const testContract = await contractManager.deployContract("MockERC20", ["Test", "TST", "1000", 18]);

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      await orchestrator.registerContract(testContract.address, "test_contract", 1, permissions, []);

      const info = await orchestrator.getContractInfo(testContract.address);
      expect(info.active).to.be.true;
      expect(info.version).to.equal(1);
    });
  });
});
