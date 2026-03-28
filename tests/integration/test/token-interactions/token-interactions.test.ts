import { expect } from "chai";
import { network } from "hardhat";
import { Contract } from "ethers";
import { ContractManager, TestEnvironment } from "../helpers/contracts";
import { TokenManager, setupDefaultTokens } from "../helpers/tokens";

const { ethers } = await network.connect();

describe("Token Interaction Tests", function () {
  let testEnv: TestEnvironment;
  let contractManager: ContractManager;
  let tokenManager: TokenManager;

  beforeEach(async function () {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    contractManager = testEnv.contractManager;
    tokenManager = new TokenManager();
  });

  afterEach(async function () {
    await testEnv.teardown();
  });

  describe("ERC20 Token Interactions", function () {
    it("Should deploy and mint ERC20 tokens", async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      
      const token = await tokenManager.deployERC20(
        "Test Token",
        "TEST",
        "1000000000000000000000", // 1000 tokens
        18
      );

      const tokenAddress = await token.getAddress();
      expect(tokenAddress).to.not.be.undefined;

      // Check initial supply
      const deployerBalance = await token.balanceOf(deployer.address);
      expect(deployerBalance.toString()).to.equal("1000000000000000000000");

      // Mint additional tokens
      await tokenManager.mintERC20("TEST", user1.address, "500000000000000000000");
      
      const user1Balance = await token.balanceOf(user1.address);
      expect(user1Balance.toString()).to.equal("500000000000000000000");
    });

    it("Should handle token transfers between accounts", async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      
      const token = await tokenManager.deployERC20(
        "Transfer Token",
        "TRANS",
        "1000000000000000000000",
        18
      );

      // Transfer tokens
      await token.transfer(user1.address, "100000000000000000000"); // 100 tokens
      
      let balance = await token.balanceOf(user1.address);
      expect(balance.toString()).to.equal("100000000000000000000");

      // Transfer from user1 to user2
      await token.connect(user1).transfer(user2.address, "50000000000000000000"); // 50 tokens
      
      balance = await token.balanceOf(user2.address);
      expect(balance.toString()).to.equal("50000000000000000000");
    });

    it("Should handle token approvals and transfers", async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      
      const token = await tokenManager.deployERC20(
        "Approval Token",
        "APRV",
        "1000000000000000000000",
        18
      );

      // Approve user1 to spend tokens
      await token.approve(user1.address, "500000000000000000000"); // 500 tokens
      
      const allowance = await token.allowance(deployer.address, user1.address);
      expect(allowance.toString()).to.equal("500000000000000000000");

      // User1 transfers from deployer to user2
      await token.connect(user1).transferFrom(deployer.address, user2.address, "100000000000000000000");
      
      const user2Balance = await token.balanceOf(user2.address);
      expect(user2Balance.toString()).to.equal("100000000000000000000");

      // Check remaining allowance
      const remainingAllowance = await token.allowance(deployer.address, user1.address);
      expect(remainingAllowance.toString()).to.equal("400000000000000000000");
    });

    it("Should handle multiple token standards interactions", async function () {
      const [deployer, user1] = await ethers.getSigners();
      
      // Deploy multiple tokens
      const gatherToken = await tokenManager.deployERC20(
        "Gatheraa Token",
        "GATH",
        "10000000000000000000000000",
        18
      );

      const usdcToken = await tokenManager.deployERC20(
        "USD Coin",
        "USDC",
        "1000000000000",
        6
      );

      const wethToken = await tokenManager.deployERC20(
        "Wrapped Ether",
        "WETH",
        "1000000000000000000000000",
        18
      );

      // Verify different decimals
      expect(await gatherToken.decimals()).to.equal(18);
      expect(await usdcToken.decimals()).to.equal(6);
      expect(await wethToken.decimals()).to.equal(18);

      // Verify names and symbols
      expect(await gatherToken.name()).to.equal("Gatheraa Token");
      expect(await usdcToken.symbol()).to.equal("USDC");
    });

    it("Should handle token burning", async function () {
      const [deployer] = await ethers.getSigners();
      
      const token = await tokenManager.deployERC20(
        "Burnable Token",
        "BURN",
        "1000000000000000000000",
        18
      );

      const initialBalance = await token.balanceOf(deployer.address);
      expect(initialBalance.toString()).to.equal("1000000000000000000000");

      // Burn tokens
      await token.burn("100000000000000000000"); // Burn 100 tokens
      
      const finalBalance = await token.balanceOf(deployer.address);
      expect(finalBalance.toString()).to.equal("900000000000000000000");

      const totalSupply = await token.totalSupply();
      expect(totalSupply.toString()).to.equal("900000000000000000000");
    });
  });

  describe("ERC721 NFT Interactions", function () {
    it("Should mint and transfer NFTs", async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      
      const nft = await tokenManager.deployERC721("Event Ticket", "TICKET");

      // Mint NFT
      await nft.safeMint(user1.address);
      
      expect(await nft.ownerOf(1)).to.equal(user1.address);
      expect(await nft.balanceOf(user1.address)).to.equal(1);

      // Transfer NFT
      await nft.connect(user1).transferFrom(user1.address, user2.address, 1);
      
      expect(await nft.ownerOf(1)).to.equal(user2.address);
      expect(await nft.balanceOf(user2.address)).to.equal(1);
    });

    it("Should handle batch NFT operations", async function () {
      const [deployer, user1] = await ethers.getSigners();
      
      const nft = await tokenManager.deployERC721("Event Tickets", "TICKET");

      // Mint multiple NFTs
      for (let i = 0; i < 5; i++) {
        await nft.safeMint(user1.address);
      }

      expect(await nft.balanceOf(user1.address)).to.equal(5);

      // Check all tokens owned by user1
      const tokens = [];
      for (let i = 1; i <= 5; i++) {
        if (await nft.ownerOf(i) === user1.address) {
          tokens.push(i);
        }
      }
      expect(tokens.length).to.equal(5);
    });

    it("Should handle NFT approvals", async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      
      const nft = await tokenManager.deployERC721("Event Ticket", "TICKET");

      // Mint and approve
      await nft.safeMint(user1.address);
      await nft.connect(user1).approve(user2.address, 1);

      expect(await nft.getApproved(1)).to.equal(user2.address);

      // User2 transfers on behalf of user1
      await nft.connect(user2).transferFrom(user1.address, deployer.address, 1);
      expect(await nft.ownerOf(1)).to.equal(deployer.address);
    });

    it("Should handle setApprovalForAll", async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      
      const nft = await tokenManager.deployERC721("Event Ticket", "TICKET");

      // Mint multiple tokens
      await nft.safeMint(user1.address);
      await nft.safeMint(user1.address);

      // Set approval for all
      await nft.connect(user1).setApprovalForAll(user2.address, true);
      expect(await nft.isApprovedForAll(user1.address, user2.address)).to.be.true;

      // User2 can transfer any token
      await nft.connect(user2).transferFrom(user1.address, deployer.address, 1);
      await nft.connect(user2).transferFrom(user1.address, deployer.address, 2);

      expect(await nft.balanceOf(deployer.address)).to.equal(2);
    });
  });

  describe("ERC1155 Multi-Token Interactions", function () {
    it("Should mint and transfer fungible tokens via ERC1155", async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      
      const multiToken = await tokenManager.deployERC1155("https://api.example.com/metadata/{id}");

      // Mint fungible tokens
      await multiToken.mint(user1.address, 1, 100, "0x"); // Token ID 1, 100 units
      await multiToken.mint(user1.address, 2, 50, "0x");  // Token ID 2, 50 units

      const balance1 = await multiToken.balanceOf(user1.address, 1);
      const balance2 = await multiToken.balanceOf(user1.address, 2);

      expect(balance1.toString()).to.equal("100");
      expect(balance2.toString()).to.equal("50");

      // Transfer some tokens
      await multiToken.connect(user1).safeTransferFrom(user1.address, user2.address, 1, 25, "0x");

      expect(await multiToken.balanceOf(user2.address, 1)).to.equal(25);
      expect(await multiToken.balanceOf(user1.address, 1)).to.equal(75);
    });

    it("Should handle batch transfers", async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      
      const multiToken = await tokenManager.deployERC1155("https://api.example.com/metadata/{id}");

      // Mint multiple token types
      await multiToken.mint(user1.address, 1, 100, "0x");
      await multiToken.mint(user1.address, 2, 200, "0x");
      await multiToken.mint(user1.address, 3, 300, "0x");

      // Batch transfer
      const tokenIds = [1, 2, 3];
      const amounts = [50, 100, 150];

      await multiToken.connect(user1).safeBatchTransferFrom(
        user1.address,
        user2.address,
        tokenIds,
        amounts,
        "0x"
      );

      // Verify balances
      for (let i = 0; i < tokenIds.length; i++) {
        const balance = await multiToken.balanceOf(user2.address, tokenIds[i]);
        expect(balance.toString()).to.equal(amounts[i].toString());
      }
    });

    it("Should handle batch minting", async function () {
      const [deployer, user1] = await ethers.getSigners();
      
      const multiToken = await tokenManager.deployERC1155("https://api.example.com/metadata/{id}");

      const tokenIds = [1, 2, 3, 4, 5];
      const amounts = [100, 200, 300, 400, 500];

      await multiToken.mintBatch(user1.address, tokenIds, amounts, "0x");

      // Verify all balances
      for (let i = 0; i < tokenIds.length; i++) {
        const balance = await multiToken.balanceOf(user1.address, tokenIds[i]);
        expect(balance.toString()).to.equal(amounts[i].toString());
      }
    });
  });

  describe("Cross-Contract Token Interactions", function () {
    it("Should handle token transfers between different contract types", async function () {
      const [deployer, user1] = await ethers.getSigners();
      
      // Deploy different token types
      const erc20 = await tokenManager.deployERC20("ERC20 Token", "ERC20", "1000000", 18);
      const erc721 = await tokenManager.deployERC721("ERC721 Token", "ERC721");
      const erc1155 = await tokenManager.deployERC1155("https://api.example.com/metadata/{id}");

      // Interact with all three in a single flow
      
      // 1. Transfer ERC20
      await erc20.transfer(user1.address, "100000000000000000000");
      
      // 2. Mint and transfer ERC721
      await erc721.safeMint(user1.address);
      
      // 3. Mint and transfer ERC1155
      await erc1155.mint(user1.address, 1, 100, "0x");

      // Verify all interactions
      expect(await erc20.balanceOf(user1.address)).to.equal("100000000000000000000");
      expect(await erc721.ownerOf(1)).to.equal(user1.address);
      expect(await erc1155.balanceOf(user1.address, 1)).to.equal(100);
    });

    it("Should handle complex multi-token scenarios", async function () {
      const [deployer, user1, user2, user3] = await ethers.getSigners();
      
      // Setup multiple token contracts
      const gatherToken = await tokenManager.deployERC20("GATH", "GATH", "10000000", 18);
      const usdcToken = await tokenManager.deployERC20("USDC", "USDC", "10000000", 6);
      const ticketNFT = await tokenManager.deployERC721("Ticket", "TICK");

      // Complex scenario: Event ticketing
      // 1. User1 buys GATH tokens with USDC
      await gatherToken.transfer(user1.address, "1000000000000000000000"); // 1000 GATH
      await usdcToken.transfer(user2.address, "1000000000"); // 1000 USDC

      // 2. User1 receives a ticket NFT
      await ticketNFT.safeMint(user1.address);

      // 3. Verify all balances
      expect(await gatherToken.balanceOf(user1.address)).to.equal("1000000000000000000000");
      expect(await usdcToken.balanceOf(user2.address)).to.equal("1000000000");
      expect(await ticketNFT.ownerOf(1)).to.equal(user1.address);
    });
  });
});
