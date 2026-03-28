import { ethers } from "hardhat";
import { Contract } from "ethers";

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
}

export class TokenManager {
  private tokens: Map<string, Contract> = new Map();

  async deployERC20(
    tokenName: string,
    tokenSymbol: string,
    initialSupply: string = "1000000000000000000000000", // 1M tokens
    decimals: number = 18
  ): Promise<Contract> {
    const [deployer] = await ethers.getSigners();
    
    const tokenFactory = await ethers.getContractFactory("MockERC20");
    const token = await tokenFactory.deploy(tokenName, tokenSymbol, initialSupply, decimals);
    await token.waitForDeployment();
    
    this.tokens.set(tokenSymbol, token);
    return token;
  }

  async deployERC721(
    collectionName: string,
    collectionSymbol: string
  ): Promise<Contract> {
    const [deployer] = await ethers.getSigners();
    
    const tokenFactory = await ethers.getContractFactory("MockERC721");
    const token = await tokenFactory.deploy(collectionName, collectionSymbol);
    await token.waitForDeployment();
    
    this.tokens.set(collectionSymbol, token);
    return token;
  }

  async deployERC1155(
    uri: string = "https://api.example.com/metadata/{id}"
  ): Promise<Contract> {
    const [deployer] = await ethers.getSigners();
    
    const tokenFactory = await ethers.getContractFactory("MockERC1155");
    const token = await tokenFactory.deploy(uri);
    await token.waitForDeployment();
    
    this.tokens.set("ERC1155", token);
    return token;
  }

  getToken(symbol: string): Contract | undefined {
    return this.tokens.get(symbol);
  }

  async mintERC20(
    tokenSymbol: string,
    to: string,
    amount: string
  ): Promise<void> {
    const token = this.getToken(tokenSymbol);
    if (!token) throw new Error(`Token ${tokenSymbol} not found`);
    
    await token.mint(to, amount);
  }

  async mintERC721(
    collectionSymbol: string,
    to: string,
    tokenId: number
  ): Promise<void> {
    const token = this.getToken(collectionSymbol);
    if (!token) throw new Error(`Collection ${collectionSymbol} not found`);
    
    await token.mint(to, tokenId);
  }

  async mintERC1155(
    to: string,
    tokenId: number,
    amount: string,
    data: string = "0x"
  ): Promise<void> {
    const token = this.getToken("ERC1155");
    if (!token) throw new Error("ERC1155 token not found");
    
    await token.mint(to, tokenId, amount, data);
  }

  async approve(
    tokenSymbol: string,
    spender: string,
    amount: string
  ): Promise<void> {
    const token = this.getToken(tokenSymbol);
    if (!token) throw new Error(`Token ${tokenSymbol} not found`);
    
    await token.approve(spender, amount);
  }

  async transfer(
    tokenSymbol: string,
    to: string,
    amount: string
  ): Promise<void> {
    const token = this.getToken(tokenSymbol);
    if (!token) throw new Error(`Token ${tokenSymbol} not found`);
    
    await token.transfer(to, amount);
  }

  async getBalance(tokenSymbol: string, address: string): Promise<string> {
    const token = this.getToken(tokenSymbol);
    if (!token) throw new Error(`Token ${tokenSymbol} not found`);
    
    return await token.balanceOf(address);
  }

  getAllTokens(): Map<string, Contract> {
    return this.tokens;
  }
}

export const DEFAULT_TOKENS: TokenInfo[] = [
  {
    name: "Gatheraa Token",
    symbol: "GATH",
    decimals: 18,
    totalSupply: "10000000000000000000000000", // 10B tokens
  },
  {
    name: "USD Stablecoin",
    symbol: "USDC",
    decimals: 6,
    totalSupply: "1000000000000000", // 1B USDC
  },
  {
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    totalSupply: "1000000000000000000000000", // 1M WETH
  },
];

export async function setupDefaultTokens(tokenManager: TokenManager): Promise<void> {
  for (const tokenInfo of DEFAULT_TOKENS) {
    await tokenManager.deployERC20(
      tokenInfo.name,
      tokenInfo.symbol,
      tokenInfo.totalSupply,
      tokenInfo.decimals
    );
  }
}
