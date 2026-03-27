import { ethers } from "hardhat";
import { ContractFactory, Contract } from "ethers";

export interface ContractDeployResult {
  contract: Contract;
  address: string;
  deploymentTx: any;
}

export interface ContractInfo {
  name: string;
  factory: ContractFactory;
  address?: string;
  contract?: Contract;
}

export class ContractManager {
  private contracts: Map<string, ContractInfo> = new Map();
  private signers: any[] = [];

  constructor() {}

  async initialize() {
    this.signers = await ethers.getSigners();
  }

  getSigners() {
    return this.signers;
  }

  getSigner(index: number = 0) {
    return this.signers[index];
  }

  async deployContract(
    contractName: string,
    constructorArgs: any[] = [],
    signerIndex: number = 0
  ): Promise<ContractDeployResult> {
    const signer = this.signers[signerIndex];
    const factory = await ethers.getContractFactory(contractName, signer);
    const deploymentTx = await factory.deploy(...constructorArgs);
    const contract = await deploymentTx.waitForDeployment();
    
    const address = await contract.getAddress();
    
    this.contracts.set(contractName, {
      name: contractName,
      factory,
      address,
      contract,
    });

    return {
      contract,
      address,
      deploymentTx,
    };
  }

  async getContract(contractName: string, address?: string): Promise<Contract> {
    const stored = this.contracts.get(contractName);
    
    if (stored && stored.contract) {
      return stored.contract;
    }

    if (address) {
      const factory = await ethers.getContractFactory(contractName);
      const contract = await factory.attach(address);
      
      this.contracts.set(contractName, {
        name: contractName,
        factory,
        address,
        contract,
      });
      
      return contract;
    }

    throw new Error(`Contract ${contractName} not found and no address provided`);
  }

  getContractAddress(contractName: string): string {
    const stored = this.contracts.get(contractName);
    if (!stored || !stored.address) {
      throw new Error(`Contract ${contractName} not deployed`);
    }
    return stored.address;
  }

  getAllContracts(): Map<string, ContractInfo> {
    return this.contracts;
  }

  reset() {
    this.contracts.clear();
  }
}

export class TestEnvironment {
  public contractManager: ContractManager;
  public snapshotId: string | null = null;

  constructor() {
    this.contractManager = new ContractManager();
  }

  async setup() {
    await this.contractManager.initialize();
    this.snapshotId = await ethers.provider.send("evm_snapshot", []);
  }

  async teardown() {
    if (this.snapshotId) {
      await ethers.provider.send("evm_revert", [this.snapshotId]);
    }
    this.contractManager.reset();
  }

  async takeSnapshot(): Promise<string> {
    return await ethers.provider.send("evm_snapshot", []);
  }

  async revertSnapshot(snapshotId: string): Promise<void> {
    await ethers.provider.send("evm_revert", [snapshotId]);
  }

  async mineBlocks(count: number = 1): Promise<void> {
    for (let i = 0; i < count; i++) {
      await ethers.provider.send("evm_mine", []);
    }
  }

  async increaseTime(seconds: number): Promise<void> {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await this.mineBlocks();
  }

  async getCurrentBlock(): Promise<number> {
    return await ethers.provider.getBlockNumber();
  }

  async getCurrentTimestamp(): Promise<number> {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }
}

export async function expectRevert(promise: Promise<any>, expectedError?: string) {
  try {
    await promise;
    throw new Error("Expected transaction to revert");
  } catch (error: any) {
    if (expectedError && !error.message.includes(expectedError)) {
      throw new Error(`Expected error "${expectedError}" but got "${error.message}"`);
    }
  }
}

export async function expectEvent(promise: Promise<any>, eventName: string, expectedArgs?: any) {
  const tx = await promise;
  const receipt = await tx.wait();
  
  const event = receipt.events?.find((e: any) => e.event === eventName);
  
  if (!event) {
    throw new Error(`Event ${eventName} not found`);
  }

  if (expectedArgs) {
    for (const [key, value] of Object.entries(expectedArgs)) {
      if (event.args[key] !== value) {
        throw new Error(`Event argument ${key} expected ${value} but got ${event.args[key]}`);
      }
    }
  }

  return event;
}
