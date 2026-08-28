import { ethers } from 'ethers';
import {
  getEventTopicHash,
  isContractAddressMatch,
  isEventLogMatch,
  BlockchainProcessor,
} from './blockchain.processor';
import { ConfigService } from '@nestjs/config';
import { TaskQueueService } from '../services/task-queue.service';
import { Job } from 'bullmq';

describe('BlockchainProcessor - Event Verification (#689)', () => {
  const contractAddress = '0x1234567890123456789012345678901234567890';
  const checksummedAddress = '0x1234567890123456789012345678901234567890';
  const eventSignature = 'Transfer(address,address,uint256)';
  const expectedTopic0 = ethers.utils.id(eventSignature).toLowerCase();

  describe('getEventTopicHash', () => {
    it('computes exact 32-byte keccak256 hash for event signatures', () => {
      const hash = getEventTopicHash('Transfer(address,address,uint256)');
      expect(hash).toBe(
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      );
    });

    it('returns normalized lowercase 32-byte hex when input is already a hash', () => {
      const rawHash =
        '0xDDF252AD1BE2C89B69C2B068FC378DAA952BA7F163C4A11628F55A4DF523B3EF';
      expect(getEventTopicHash(rawHash)).toBe(rawHash.toLowerCase());
    });

    it('returns empty string for empty or invalid input', () => {
      expect(getEventTopicHash('')).toBe('');
      expect(getEventTopicHash(null as any)).toBe('');
      expect(getEventTopicHash(undefined as any)).toBe('');
    });
  });

  describe('isContractAddressMatch', () => {
    it('matches lowercase and checksummed contract addresses safely', () => {
      expect(
        isContractAddressMatch(
          '0x1234567890123456789012345678901234567890',
          '0x1234567890123456789012345678901234567890',
        ),
      ).toBe(true);
      expect(
        isContractAddressMatch(
          '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
          '0xabcdef1234567890abcdef1234567890abcdef12',
        ),
      ).toBe(true);
    });

    it('returns false for different addresses or missing values', () => {
      expect(
        isContractAddressMatch(
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ),
      ).toBe(false);
      expect(isContractAddressMatch(undefined, contractAddress)).toBe(false);
      expect(isContractAddressMatch(contractAddress, null)).toBe(false);
    });
  });

  describe('isEventLogMatch', () => {
    it('returns true when log matches contract address and exact event topic0', () => {
      const log = {
        address: contractAddress,
        topics: [
          expectedTopic0,
          '0x0000000000000000000000001111111111111111111111111111111111111111',
        ],
      };

      expect(isEventLogMatch(log, contractAddress, eventSignature)).toBe(true);
      expect(isEventLogMatch(log, contractAddress, expectedTopic0)).toBe(true);
    });

    it('rejects topic substring collisions (e.g. Transfer vs TransferFrom)', () => {
      const otherSignature = 'TransferFrom(address,address,address,uint256)';
      const otherTopic0 = ethers.utils.id(otherSignature).toLowerCase();

      const log = {
        address: contractAddress,
        topics: [otherTopic0],
      };

      // Even if event name string "Transfer" is a substring of "TransferFrom", exact topic matching must reject it
      expect(isEventLogMatch(log, contractAddress, eventSignature)).toBe(false);
    });

    it('rejects matching value when present only in a non-zero topic (topics[1])', () => {
      const unrelatedTopic0 = ethers.utils.id('UnrelatedEvent()').toLowerCase();
      const log = {
        address: contractAddress,
        topics: [
          unrelatedTopic0,
          expectedTopic0, // appears in topics[1], NOT topics[0]
        ],
      };

      expect(isEventLogMatch(log, contractAddress, eventSignature)).toBe(false);
    });

    it('returns false when contract address does not match', () => {
      const log = {
        address: '0x9999999999999999999999999999999999999999',
        topics: [expectedTopic0],
      };

      expect(isEventLogMatch(log, contractAddress, eventSignature)).toBe(false);
    });

    it('handles malformed logs and empty receipts deterministically without crashing', () => {
      expect(isEventLogMatch(null, contractAddress, eventSignature)).toBe(false);
      expect(isEventLogMatch(undefined, contractAddress, eventSignature)).toBe(
        false,
      );
      expect(
        isEventLogMatch({ address: contractAddress } as any, contractAddress, eventSignature),
      ).toBe(false);
      expect(
        isEventLogMatch(
          { address: contractAddress, topics: [] },
          contractAddress,
          eventSignature,
        ),
      ).toBe(false);
      expect(
        isEventLogMatch(
          { address: contractAddress, topics: [null as any] },
          contractAddress,
          eventSignature,
        ),
      ).toBe(false);
    });
  });

  describe('BlockchainProcessor verify action', () => {
    let processor: BlockchainProcessor;
    let configService: jest.Mocked<ConfigService>;
    let taskQueueService: jest.Mocked<TaskQueueService>;
    let mockProvider: any;

    beforeEach(() => {
      configService = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'ETH_MAINNET_RPC') return 'https://mainnet.infura.io/v3/test';
          return null;
        }),
      } as any;

      taskQueueService = {
        moveToDeadLetterQueue: jest.fn(),
      } as any;

      processor = new BlockchainProcessor(configService, taskQueueService);

      mockProvider = {
        getTransactionReceipt: jest.fn(),
        getCode: jest.fn(),
        getLogs: jest.fn(),
      };
      (processor as any).providers.set('1', mockProvider);
    });

    it('successfully verifies an emitted event in transaction receipt', async () => {
      const txHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      mockProvider.getTransactionReceipt.mockResolvedValue({
        blockNumber: 123456,
        gasUsed: ethers.BigNumber.from('21000'),
        logs: [
          {
            address: contractAddress,
            topics: [expectedTopic0],
          },
        ],
      });

      const job = {
        id: 'job-1',
        data: {
          contractAddress,
          eventName: eventSignature,
          parameters: { transactionHash: txHash },
          networkId: '1',
          action: 'verify',
        },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const result = await processor.process(job);

      expect(result.success).toBe(true);
      expect(result.result.verified).toBe(true);
      expect(result.result.transactionHash).toBe(txHash);
      expect(result.result.blockNumber).toBe(123456);
    });

    it('returns verified: false when target event was not emitted in receipt', async () => {
      const txHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      mockProvider.getTransactionReceipt.mockResolvedValue({
        blockNumber: 123456,
        gasUsed: ethers.BigNumber.from('21000'),
        logs: [
          {
            address: contractAddress,
            topics: [ethers.utils.id('OtherEvent()').toLowerCase()],
          },
        ],
      });

      const job = {
        id: 'job-2',
        data: {
          contractAddress,
          eventName: eventSignature,
          parameters: { transactionHash: txHash },
          networkId: '1',
          action: 'verify',
        },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const result = await processor.process(job);

      expect(result.success).toBe(true);
      expect(result.result.verified).toBe(false);
    });
  });
});
