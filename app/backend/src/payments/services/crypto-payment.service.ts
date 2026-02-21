import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ethers } from 'ethers';
import { Payment, PaymentStatus, PaymentMethod } from '../entities/payment.entity';
import { VerifyCryptoPaymentDto } from '../dto/payment.dto';

@Injectable()
export class CryptoPaymentService {
  private ethersProvider: ethers.JsonRpcProvider;
  private ethereumProvider: ethers.JsonRpcProvider;
  private polygonProvider: ethers.JsonRpcProvider;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
  ) {
    // Initialize blockchain providers
    this.ethersProvider = new ethers.JsonRpcProvider(
      this.configService.get('ETH_RPC_URL') || 'https://eth-mainnet.g.alchemy.com/v2/demo',
    );

    this.polygonProvider = new ethers.JsonRpcProvider(
      this.configService.get('POLYGON_RPC_URL') || 'https://polygon-rpc.com',
    );

    this.ethereumProvider = new ethers.JsonRpcProvider(
      this.configService.get('ETHEREUM_RPC_URL') || 'https://eth-mainnet.g.alchemy.com/v2/demo',
    );
  }

  /**
   * Get the appropriate provider based on payment method
   */
  private getProvider(method: PaymentMethod): ethers.JsonRpcProvider {
    switch (method) {
      case PaymentMethod.ETHEREUM:
      case PaymentMethod.USDC:
        return this.ethersProvider;
      case PaymentMethod.MATIC:
        return this.polygonProvider;
      case PaymentMethod.BITCOIN:
        // Bitcoin verification would require a separate service
        // For now, return null or throw error
        throw new BadRequestException('Bitcoin verification requires separate integration');
      default:
        throw new BadRequestException('Unsupported payment method');
    }
  }

  /**
   * Verify a crypto transaction on-chain
   */
  async verifyTransaction(dto: VerifyCryptoPaymentDto): Promise<Payment> {
    try {
      const payment = await this.paymentRepository.findOne({
        where: { id: dto.paymentId },
      });

      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      const provider = this.getProvider(payment.method as PaymentMethod);

      // Get transaction details
      const transaction = await provider.getTransactionReceipt(dto.transactionHash);

      if (!transaction) {
        throw new BadRequestException('Transaction not found on blockchain');
      }

      // Verify transaction details
      if (transaction.from.toLowerCase() !== (dto.fromAddress || payment.fromAddress)?.toLowerCase()) {
        throw new BadRequestException('Transaction sender does not match');
      }

      // Get current block confirmations
      const currentBlockNumber = await provider.getBlockNumber();
      const blockConfirmations = currentBlockNumber - transaction.blockNumber;

      // Update payment with on-chain data
      payment.transactionHash = dto.transactionHash;
      payment.fromAddress = transaction.from;
      payment.toAddress = transaction.to || undefined;
      payment.blockNumber = transaction.blockNumber;
      payment.blockConfirmations = blockConfirmations;
      payment.gasPrice = transaction.gasPrice?.toString();
      payment.gasUsed = transaction.gasLimit?.toString();

      // Verify status (example: at least 12 confirmations for mainnet)
      const requiredConfirmations = this.getRequiredConfirmations(payment.method as PaymentMethod);

      if (blockConfirmations >= requiredConfirmations) {
        payment.status = PaymentStatus.SUCCEEDED;
        payment.webhookProcessed = true;
        payment.webhookProcessedAt = new Date();
      } else {
        payment.status = PaymentStatus.PROCESSING;
      }

      payment.providerResponse = {
        transactionHash: transaction.hash,
        blockNumber: transaction.blockNumber,
        blockConfirmations,
        status: transaction.status,
        gasUsed: transaction.gasUsed?.toString(),
      };

      return await this.paymentRepository.save(payment);
    } catch (error) {
      if (error instanceof BadRequestException || error.status === 400) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to verify crypto transaction');
    }
  }

  /**
   * Get required block confirmations for a given blockchain
   */
  private getRequiredConfirmations(method: PaymentMethod): number {
    switch (method) {
      case PaymentMethod.ETHEREUM:
      case PaymentMethod.USDC:
        return 12; // ~3 minutes on Ethereum
      case PaymentMethod.MATIC:
        return 128; // ~2-3 minutes on Polygon
      case PaymentMethod.BITCOIN:
        return 6; // ~1 hour on Bitcoin
      default:
        return 1;
    }
  }

  /**
   * Get transaction details from hash
   */
  async getTransactionDetails(
    transactionHash: string,
    method: PaymentMethod,
  ): Promise<Record<string, any>> {
    try {
      const provider = this.getProvider(method);
      const transaction = await provider.getTransactionReceipt(transactionHash);

      if (!transaction) {
        throw new BadRequestException('Transaction not found');
      }

      const currentBlockNumber = await provider.getBlockNumber();

      return {
        hash: transaction.hash,
        from: transaction.from,
        to: transaction.to,
        blockNumber: transaction.blockNumber,
        blockConfirmations: currentBlockNumber - transaction.blockNumber,
        gasUsed: transaction.gasUsed?.toString(),
        gasPrice: transaction.gasPrice?.toString(),
        status: transaction.status,
        timestamp: (await provider.getBlock(transaction.blockNumber))?.timestamp,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch transaction details');
    }
  }

  /**
   * Validate a wallet address
   */
  isValidAddress(address: string, method: PaymentMethod): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Get ETH balance for an address
   */
  async getBalance(address: string, method: PaymentMethod = PaymentMethod.ETHEREUM): Promise<string> {
    try {
      if (!ethers.isAddress(address)) {
        throw new BadRequestException('Invalid address');
      }

      const provider = this.getProvider(method);
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch balance');
    }
  }

  /**
   * Monitor pending transactions for confirmation
   */
  async waitForConfirmation(
    transactionHash: string,
    method: PaymentMethod,
    maxWaitTime: number = 3600000, // 1 hour default
  ): Promise<boolean> {
    try {
      const provider = this.getProvider(method);
      const requiredConfirmations = this.getRequiredConfirmations(method);
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        const receipt = await provider.getTransactionReceipt(transactionHash);

        if (!receipt) {
          // Transaction not yet mined
          await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
          continue;
        }

        const currentBlockNumber = await provider.getBlockNumber();
        const confirmations = currentBlockNumber - receipt.blockNumber;

        if (confirmations >= requiredConfirmations) {
          return receipt.status === 1;
        }

        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
      }

      return false;
    } catch (error) {
      throw new InternalServerErrorException('Failed to wait for confirmation');
    }
  }

  /**
   * Estimate gas for a transaction (for information purposes)
   */
  async estimateGas(
    method: PaymentMethod,
    fromAddress: string,
    toAddress: string,
    amount: string,
  ): Promise<string> {
    try {
      if (!ethers.isAddress(fromAddress) || !ethers.isAddress(toAddress)) {
        throw new BadRequestException('Invalid address');
      }

      const provider = this.getProvider(method);

      const gasEstimate = await provider.estimateGas({
        from: fromAddress,
        to: toAddress,
        value: ethers.parseEther(amount),
      });

      const gasPrice = await provider.getGasPrice();
      const estimatedCost = gasPrice * gasEstimate;

      return ethers.formatEther(estimatedCost);
    } catch (error) {
      throw new InternalServerErrorException('Failed to estimate gas');
    }
  }
}
