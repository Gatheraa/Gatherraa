import { expect } from "chai";
import { network } from "hardhat";
import { Contract } from "ethers";
import { ContractManager, TestEnvironment } from "../helpers/contracts";
import { TokenManager, setupDefaultTokens } from "../helpers/tokens";
import { CrossContractOrchestrator, MultiContractManager } from "../helpers/orchestrator";

const { ethers } = await network.connect();

describe("End-to-End Scenario Tests", function () {
  let testEnv: TestEnvironment;
  let contractManager: ContractManager;
  let tokenManager: TokenManager;
  let orchestrator: CrossContractOrchestrator;

  beforeEach(async function () {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    contractManager = testEnv.contractManager;
    tokenManager = new TokenManager();
    orchestrator = new CrossContractOrchestrator();
  });

  afterEach(async function () {
    await testEnv.teardown();
  });

  describe("Complete Event Creation and Ticketing Flow", function () {
    it("Should handle full event lifecycle: creation to ticket purchase", async function () {
      const [admin, organizer, attendee1, attendee2] = await ethers.getSigners();

      // Deploy ecosystem contracts
      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      const eventFactory = await contractManager.deployContract("MockERC20", ["Event Factory", "FACT", "1000000", 18]);
      const ticketNFT = await tokenManager.deployERC721("Event Ticket", "TICKET");
      const paymentToken = await tokenManager.deployERC20("Payment Token", "PAY", "1000000000", 18);

      // Setup contract permissions
      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      await orchestrator.registerContract(eventFactory.address, "event_factory", 1, permissions, []);
      await orchestrator.registerContract(await ticketNFT.getAddress(), "ticket_contract", 1, permissions, [eventFactory.address]);
      await orchestrator.registerContract(await paymentToken.getAddress(), "payment_token", 1, permissions, []);

      // Fund attendees
      await paymentToken.transfer(attendee1.address, "100000000000000000000"); // 100 PAY tokens
      await paymentToken.transfer(attendee2.address, "100000000000000000000");

      // Mint tickets to attendees
      await ticketNFT.safeMint(attendee1.address);
      await ticketNFT.safeMint(attendee2.address);

      // Verify balances and ownership
      expect(await paymentToken.balanceOf(attendee1.address)).to.equal("100000000000000000000");
      expect(await paymentToken.balanceOf(attendee2.address)).to.equal("100000000000000000000");
      expect(await ticketNFT.ownerOf(1)).to.equal(attendee1.address);
      expect(await ticketNFT.ownerOf(2)).to.equal(attendee2.address);

      // Simulate ticket transfers (secondary market)
      await ticketNFT.connect(attendee1).transferFrom(attendee1.address, attendee2.address, 1);
      
      // Verify transfer
      expect(await ticketNFT.ownerOf(1)).to.equal(attendee2.address);
      expect(await ticketNFT.balanceOf(attendee2.address)).to.equal(2);
    });

    it("Should handle event with ticket tiers and pricing", async function () {
      const [admin, organizer, vip1, vip2, general1, general2] = await ethers.getSigners();

      // Deploy contracts
      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      const vipTicket = await tokenManager.deployERC721("VIP Ticket", "VIP");
      const generalTicket = await tokenManager.deployERC721("General Ticket", "GEN");
      const stablecoin = await tokenManager.deployERC20("USD Coin", "USDC", "1000000000", 6);

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      await orchestrator.registerContract(await vipTicket.getAddress(), "vip_ticket", 1, permissions, []);
      await orchestrator.registerContract(await generalTicket.getAddress(), "general_ticket", 1, permissions, []);
      await orchestrator.registerContract(await stablecoin.getAddress(), "usdc", 1, permissions, []);

      // Fund attendees
      await stablecoin.transfer(vip1.address, "1000000000"); // 1000 USDC
      await stablecoin.transfer(vip2.address, "1000000000");
      await stablecoin.transfer(general1.address, "500000000"); // 500 USDC
      await stablecoin.transfer(general2.address, "500000000");

      // Mint VIP tickets
      await vipTicket.safeMint(vip1.address);
      await vipTicket.safeMint(vip2.address);

      // Mint General tickets
      await generalTicket.safeMint(general1.address);
      await generalTicket.safeMint(general2.address);

      // Verify all tickets
      expect(await vipTicket.balanceOf(vip1.address)).to.equal(1);
      expect(await vipTicket.balanceOf(vip2.address)).to.equal(1);
      expect(await generalTicket.balanceOf(general1.address)).to.equal(1);
      expect(await generalTicket.balanceOf(general2.address)).to.equal(1);

      // Verify USDC balances
      expect(await stablecoin.balanceOf(vip1.address)).to.equal("1000000000");
      expect(await stablecoin.balanceOf(general1.address)).to.equal("500000000");
    });
  });

  describe("Multi-Event Ecosystem Flow", function () {
    it("Should handle multiple events with cross-event interactions", async function () {
      const [admin, event1Organizer, event2Organizer, attendee] = await ethers.getSigners();

      // Deploy shared infrastructure
      const orchestratorDeploy = await contractManager.deployContract(
        "CrossContractOrchestrator",
        [admin.address]
      );
      await orchestrator.initialize(orchestratorDeploy.contract);

      // Deploy token infrastructure
      const gatherToken = await tokenManager.deployERC20("Gatheraa Token", "GATH", "10000000000000", 18);
      const event1Tickets = await tokenManager.deployERC721("Conference 2024", "CONF24");
      const event2Tickets = await tokenManager.deployERC721("Workshop 2024", "WORK24");

      const permissions = {
        can_call: [],
        can_be_called_by: [],
        requires_auth: false,
        delegate_auth_to: []
      };

      await orchestrator.registerContract(await gatherToken.getAddress(), "gather_token", 1, permissions, []);
      await orchestrator.registerContract(await event1Tickets.getAddress(), "event1_tickets", 1, permissions, []);
      await orchestrator.registerContract(await event2Tickets.getAddress(), "event2_tickets", 1, permissions, []);

      // Fund attendee
      await gatherToken.transfer(attendee.address, "1000000000000000000000"); // 1000 GATH

      // Purchase tickets for both events
      await event1Tickets.safeMint(attendee.address);
      await event2Tickets.safeMint(attendee.address);

      // Verify attendee has tickets for both events
      expect(await event1Tickets.balanceOf(attendee.address)).to.equal(1);
      expect(await event2Tickets.balanceOf(attendee.address)).to.equal(1);
      expect(await gatherToken.balanceOf(attendee.address)).to.equal("1000000000000000000000");

      // Verify contracts are registered
      const tokenInfo = await orchestrator.getContractInfo(await gatherToken.getAddress());
      expect(tokenInfo.contract_type).to.equal("gather_token");
    });
  });

  describe("Payment and Settlement Flow", function () {
    it("Should handle complex payment scenarios with multiple currencies", async function () {
      const [admin, seller, buyer1, buyer2, buyer3] = await ethers.getSigners();

      // Deploy payment infrastructure
      const gathToken = await tokenManager.deployERC20("Gatheraa", "GATH", "10000000000000", 18);
      const usdcToken = await tokenManager.deployERC20("USDC", "USDC", "10000000000000", 6);
      const wethToken = await tokenManager.deployERC20("WETH", "WETH", "10000000000000", 18);

      // Fund buyers with different currencies
      await gathToken.transfer(buyer1.address, "1000000000000000000000"); // 1000 GATH
      await usdcToken.transfer(buyer2.address, "5000000000"); // 5000 USDC
      await wethToken.transfer(buyer3.address, "1000000000000000000"); // 1 WETH

      // Verify all balances
      expect(await gathToken.balanceOf(buyer1.address)).to.equal("1000000000000000000000");
      expect(await usdcToken.balanceOf(buyer2.address)).to.equal("5000000000");
      expect(await wethToken.balanceOf(buyer3.address)).to.equal("1000000000000000000");

      // Test approvals for marketplace
      await gathToken.connect(buyer1).approve(seller.address, "100000000000000000000");
      await usdcToken.connect(buyer2).approve(seller.address, "500000000");
      await wethToken.connect(buyer3).approve(seller.address, "100000000000000000");

      // Verify approvals
      expect(await gathToken.allowance(buyer1.address, seller.address)).to.equal("100000000000000000000");
      expect(await usdcToken.allowance(buyer2.address, seller.address)).to.equal("500000000");
      expect(await wethToken.allowance(buyer3.address, seller.address)).to.equal("100000000000000000");
    });

    it("Should handle escrow-like payment flows", async function () {
      const [admin, escrow, buyer, seller] = await ethers.getSigners();

      const paymentToken = await tokenManager.deployERC20("Payment", "PAY", "1000000000", 18);

      // Fund buyer
      await paymentToken.transfer(buyer.address, "1000000000000000000000");

      // Buyer deposits to escrow
      const depositAmount = "100000000000000000000"; // 100 PAY
      
      await paymentToken.connect(buyer).transfer(escrow.address, depositAmount);
      
      // Verify escrow balance
      expect(await paymentToken.balanceOf(escrow.address)).to.equal(depositAmount);
      expect(await paymentToken.balanceOf(buyer.address)).to.equal("900000000000000000000");

      // Escrow releases to seller
      await paymentToken.connect(escrow).transfer(seller.address, depositAmount);
      
      // Verify final balances
      expect(await paymentToken.balanceOf(escrow.address)).to.equal(0);
      expect(await paymentToken.balanceOf(seller.address)).to.equal(depositAmount);
    });
  });

  describe("Governance and Voting Flow", function () {
    it("Should handle token-based voting scenario", async function () {
      const [admin, proposalCreator, voter1, voter2, voter3] = await ethers.getSigners();

      // Deploy governance token
      const govToken = await tokenManager.deployERC20("Governance Token", "GOV", "10000000000000", 18);

      // Distribute governance tokens
      await govToken.transfer(voter1.address, "1000000000000000000000"); // 1000 GOV
      await govToken.transfer(voter2.address, "500000000000000000000");  // 500 GOV
      await govToken.transfer(voter3.address, "250000000000000000000");  // 250 GOV

      // Verify voting power (based on token balance)
      const voter1Power = await govToken.balanceOf(voter1.address);
      const voter2Power = await govToken.balanceOf(voter2.address);
      const voter3Power = await govToken.balanceOf(voter3.address);

      expect(voter1Power.toString()).to.equal("1000000000000000000000");
      expect(voter2Power.toString()).to.equal("500000000000000000000");
      expect(voter3Power.toString()).to.equal("250000000000000000000");

      // Calculate total voting power
      const totalPower = voter1Power + voter2Power + voter3Power;
      expect(totalPower.toString()).to.equal("1750000000000000000000");
    });
  });

  describe("Refund and Cancellation Flow", function () {
    it("Should handle event cancellation and refund flow", async function () {
      const [admin, organizer, attendee1, attendee2, attendee3] = await ethers.getSigners();

      const ticketNFT = await tokenManager.deployERC721("Event Ticket", "TICKET");
      const paymentToken = await tokenManager.deployERC20("Payment", "PAY", "1000000000", 18);

      // Setup: Attendees buy tickets
      await ticketNFT.safeMint(attendee1.address);
      await ticketNFT.safeMint(attendee2.address);
      await ticketNFT.safeMint(attendee3.address);

      // Verify ticket ownership
      expect(await ticketNFT.ownerOf(1)).to.equal(attendee1.address);
      expect(await ticketNFT.ownerOf(2)).to.equal(attendee2.address);
      expect(await ticketNFT.ownerOf(3)).to.equal(attendee3.address);

      // Simulate refunds (attendees return tickets)
      await ticketNFT.connect(attendee1).transferFrom(attendee1.address, organizer.address, 1);
      await ticketNFT.connect(attendee2).transferFrom(attendee2.address, organizer.address, 2);

      // Verify returns
      expect(await ticketNFT.ownerOf(1)).to.equal(organizer.address);
      expect(await ticketNFT.ownerOf(2)).to.equal(organizer.address);
      expect(await ticketNFT.ownerOf(3)).to.equal(attendee3.address);

      // Refund payments
      await paymentToken.transfer(attendee1.address, "100000000000000000000"); // Refund 100 PAY
      await paymentToken.transfer(attendee2.address, "100000000000000000000"); // Refund 100 PAY

      // Verify refunds
      expect(await paymentToken.balanceOf(attendee1.address)).to.equal("100000000000000000000");
      expect(await paymentToken.balanceOf(attendee2.address)).to.equal("100000000000000000000");
    });
  });

  describe("Subscription and Recurring Payment Flow", function () {
    it("Should handle subscription-based access control", async function () {
      const [admin, subscriber1, subscriber2, nonSubscriber] = await ethers.getSigners();

      const subscriptionNFT = await tokenManager.deployERC721("Subscription", "SUB");
      const paymentToken = await tokenManager.deployERC20("Payment", "PAY", "1000000000", 18);

      // Fund subscribers
      await paymentToken.transfer(subscriber1.address, "1000000000000000000000");
      await paymentToken.transfer(subscriber2.address, "1000000000000000000000");

      // Mint subscription tokens
      await subscriptionNFT.safeMint(subscriber1.address);
      await subscriptionNFT.safeMint(subscriber2.address);

      // Verify subscriptions
      expect(await subscriptionNFT.balanceOf(subscriber1.address)).to.equal(1);
      expect(await subscriptionNFT.balanceOf(subscriber2.address)).to.equal(1);
      expect(await subscriptionNFT.balanceOf(nonSubscriber.address)).to.equal(0);

      // Verify payment tokens
      expect(await paymentToken.balanceOf(subscriber1.address)).to.equal("1000000000000000000000");
      expect(await paymentToken.balanceOf(subscriber2.address)).to.equal("1000000000000000000000");
    });
  });

  describe("Whitelist and Access Control Flow", function () {
    it("Should handle whitelisted access for exclusive events", async function () {
      const [admin, whitelisted1, whitelisted2, regularUser] = await ethers.getSigners();

      const exclusiveTicket = await tokenManager.deployERC721("Exclusive", "EXCL");
      const accessToken = await tokenManager.deployERC20("Access", "ACC", "1000000000", 18);

      // Mint exclusive tickets to whitelisted users
      await exclusiveTicket.safeMint(whitelisted1.address);
      await exclusiveTicket.safeMint(whitelisted2.address);

      // Verify exclusive access
      expect(await exclusiveTicket.balanceOf(whitelisted1.address)).to.equal(1);
      expect(await exclusiveTicket.balanceOf(whitelisted2.address)).to.equal(1);
      expect(await exclusiveTicket.balanceOf(regularUser.address)).to.equal(0);

      // Transfer access tokens only to whitelisted
      await accessToken.transfer(whitelisted1.address, "100000000000000000000");
      await accessToken.transfer(whitelisted2.address, "100000000000000000000");

      expect(await accessToken.balanceOf(whitelisted1.address)).to.equal("100000000000000000000");
      expect(await accessToken.balanceOf(whitelisted2.address)).to.equal("100000000000000000000");
      expect(await accessToken.balanceOf(regularUser.address)).to.equal(0);
    });
  });
});
