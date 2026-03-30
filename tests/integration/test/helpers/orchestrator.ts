import { ethers } from "hardhat";
import { Contract, ContractTransactionResponse } from "ethers";

export interface CallRequest {
  targetContract: string;
  functionName: string;
  args: any[];
  value?: string;
  requiredSuccess?: boolean;
}

export interface CrossContractCallResult {
  success: boolean;
  transactionHash?: string;
  events?: any[];
  error?: string;
}

export class CrossContractOrchestrator {
  private orchestratorContract?: Contract;
  private callHistory: Map<string, CrossContractCallResult[]> = new Map();

  async initialize(orchestratorContract: Contract) {
    this.orchestratorContract = orchestratorContract;
  }

  async registerContract(
    contractAddress: string,
    contractType: string,
    version: number,
    permissions: any,
    dependencies: string[] = []
  ): Promise<ContractTransactionResponse> {
    if (!this.orchestratorContract) {
      throw new Error("Orchestrator not initialized");
    }

    const tx = await this.orchestratorContract.register_contract(
      contractAddress,
      contractType,
      version,
      permissions,
      dependencies
    );

    return tx;
  }

  async executeSingleCall(
    targetContract: string,
    functionName: string,
    args: any[] = [],
    value?: string
  ): Promise<CrossContractCallResult> {
    if (!this.orchestratorContract) {
      throw new Error("Orchestrator not initialized");
    }

    try {
      const tx = await this.orchestratorContract.call_contract(
        targetContract,
        functionName,
        args,
        value || "0"
      );

      const receipt = await tx.wait();

      const result: CrossContractCallResult = {
        success: true,
        transactionHash: receipt.hash,
        events: receipt.logs,
      };

      this.addToHistory(targetContract, result);
      return result;
    } catch (error: any) {
      const result: CrossContractCallResult = {
        success: false,
        error: error.message,
      };

      this.addToHistory(targetContract, result);
      return result;
    }
  }

  async executeAtomicOperation(
    calls: CallRequest[],
    timeout: number = 86400
  ): Promise<string> {
    if (!this.orchestratorContract) {
      throw new Error("Orchestrator not initialized");
    }

    const operationId = await this.orchestratorContract.execute_atomic_operation(
      calls,
      timeout
    );

    return operationId;
  }

  async registerCallback(
    triggerContract: string,
    triggerFunction: string,
    callbackContract: string,
    callbackFunction: string,
    callbackData: any[] = []
  ): Promise<string> {
    if (!this.orchestratorContract) {
      throw new Error("Orchestrator not initialized");
    }

    const callbackId = await this.orchestratorContract.register_callback(
      triggerContract,
      triggerFunction,
      callbackContract,
      callbackFunction,
      callbackData
    );

    return callbackId;
  }

  async getOperationStatus(operationId: string): Promise<string> {
    if (!this.orchestratorContract) {
      throw new Error("Orchestrator not initialized");
    }

    return await this.orchestratorContract.get_operation_status(operationId);
  }

  async getContractInfo(contractAddress: string): Promise<any> {
    if (!this.orchestratorContract) {
      throw new Error("Orchestrator not initialized");
    }

    return await this.orchestratorContract.get_contract_info(contractAddress);
  }

  async checkCircularDependencies(
    contractAddress: string,
    dependencies: string[]
  ): Promise<boolean> {
    if (!this.orchestratorContract) {
      throw new Error("Orchestrator not initialized");
    }

    try {
      await this.orchestratorContract.check_circular_dependencies(
        contractAddress,
        dependencies
      );
      return true;
    } catch {
      return false;
    }
  }

  private addToHistory(contractAddress: string, result: CrossContractCallResult) {
    if (!this.callHistory.has(contractAddress)) {
      this.callHistory.set(contractAddress, []);
    }
    this.callHistory.get(contractAddress)!.push(result);
  }

  getCallHistory(contractAddress?: string): Map<string, CrossContractCallResult[]> | CrossContractCallResult[] {
    if (contractAddress) {
      return this.callHistory.get(contractAddress) || [];
    }
    return this.callHistory;
  }

  clearHistory() {
    this.callHistory.clear();
  }
}

export class MultiContractManager {
  private contracts: Map<string, Contract> = new Map();
  private orchestrator: CrossContractOrchestrator;

  constructor(orchestrator: CrossContractOrchestrator) {
    this.orchestrator = orchestrator;
  }

  async addContract(name: string, contract: Contract) {
    this.contracts.set(name, contract);
  }

  getContract(name: string): Contract {
    const contract = this.contracts.get(name);
    if (!contract) {
      throw new Error(`Contract ${name} not found`);
    }
    return contract;
  }

  async executeCrossCall(
    fromContract: string,
    toContract: string,
    functionName: string,
    args: any[] = []
  ): Promise<CrossContractCallResult> {
    const targetContract = this.getContract(toContract);
    
    return await this.orchestrator.executeSingleCall(
      await targetContract.getAddress(),
      functionName,
      args
    );
  }

  async executeBatchCalls(
    calls: { fromContract: string; toContract: string; functionName: string; args: any[] }[]
  ): Promise<CrossContractCallResult[]> {
    const results: CrossContractCallResult[] = [];

    for (const call of calls) {
      const result = await this.executeCrossCall(
        call.fromContract,
        call.toContract,
        call.functionName,
        call.args
      );
      results.push(result);
    }

    return results;
  }
}
