// Blockchain job parameter validation tests (issue #693)
//
// Acceptance criteria covered:
//  - Job payloads use a typed validation schema.
//  - Action-specific fields are required before provider calls.
//  - Invalid payloads produce permanent actionable failures.
//  - Tests cover every action.

import {
  BlockchainParameterError,
  isBlockReference,
  isTransactionHash,
  validateBlockchainEventParameters,
} from './blockchain.parameters';

const TX_HASH = '0x' + 'ab'.repeat(32);

describe('blockchain.parameters - isTransactionHash', () => {
  it('accepts a well-formed 0x-prefixed 32-byte hex string', () => {
    expect(isTransactionHash(TX_HASH)).toBe(true);
  });

  it('accepts an uppercase hex hash', () => {
    expect(isTransactionHash('0x' + 'AB'.repeat(32))).toBe(true);
  });

  it('rejects non-hex, bare, short, and non-string values', () => {
    expect(isTransactionHash('0x' + 'zz'.repeat(32))).toBe(false);
    expect(isTransactionHash('not-a-hash')).toBe(false);
    expect(isTransactionHash('0x1234')).toBe(false);
    expect(isTransactionHash(42)).toBe(false);
    expect(isTransactionHash(undefined)).toBe(false);
    expect(isTransactionHash(null)).toBe(false);
  });
});

describe('blockchain.parameters - isBlockReference', () => {
  it('accepts named block tags (case-insensitive)', () => {
    expect(isBlockReference('latest')).toBe(true);
    expect(isBlockReference('earliest')).toBe(true);
    expect(isBlockReference('pending')).toBe(true);
    expect(isBlockReference('LATEST')).toBe(true);
  });

  it('accepts hex block numbers', () => {
    expect(isBlockReference('0x10')).toBe(true);
    expect(isBlockReference('0X1a2B')).toBe(true);
  });

  it('accepts non-negative integers', () => {
    expect(isBlockReference(0)).toBe(true);
    expect(isBlockReference(12345)).toBe(true);
  });

  it('rejects negative, fractional, NaN, and garbage strings', () => {
    expect(isBlockReference(-1)).toBe(false);
    expect(isBlockReference(1.5)).toBe(false);
    expect(isBlockReference(Number.NaN)).toBe(false);
    expect(isBlockReference('latest-1')).toBe(false);
    expect(isBlockReference('12.')).toBe(false);
    expect(isBlockReference(undefined)).toBe(false);
    expect(isBlockReference(null)).toBe(false);
  });
});

describe('validateBlockchainEventParameters - process', () => {
  it('accepts an object payload and an absent payload', () => {
    expect(validateBlockchainEventParameters('process', { foo: 1 })).toEqual({ foo: 1 });
    expect(validateBlockchainEventParameters('process', undefined)).toEqual({});
  });

  it('rejects a non-object payload', () => {
    expect(() => validateBlockchainEventParameters('process', 'boom')).toThrow(
      BlockchainParameterError,
    );
    expect(() => validateBlockchainEventParameters('process', [1, 2, 3])).toThrow(
      BlockchainParameterError,
    );
    expect(() => validateBlockchainEventParameters('process', 42)).toThrow(
      BlockchainParameterError,
    );
  });
});

describe('validateBlockchainEventParameters - listen', () => {
  it('accepts an empty object (both fields optional)', () => {
    expect(validateBlockchainEventParameters('listen', {})).toEqual({});
  });

  it('accepts valid block references', () => {
    expect(
      validateBlockchainEventParameters('listen', { fromBlock: '0x10', toBlock: 'latest' }),
    ).toEqual({ fromBlock: '0x10', toBlock: 'latest' });
    expect(
      validateBlockchainEventParameters('listen', { fromBlock: 100, toBlock: 200 }),
    ).toEqual({ fromBlock: 100, toBlock: 200 });
  });

  it('rejects malformed fromBlock/toBlock values', () => {
    expect(() =>
      validateBlockchainEventParameters('listen', { fromBlock: -5 }),
    ).toThrow(BlockchainParameterError);
    expect(() =>
      validateBlockchainEventParameters('listen', { toBlock: 'latestr' }),
    ).toThrow(BlockchainParameterError);
    expect(() =>
      validateBlockchainEventParameters('listen', { fromBlock: {} }),
    ).toThrow(BlockchainParameterError);
  });
});

describe('validateBlockchainEventParameters - verify', () => {
  it('accepts a valid transactionHash', () => {
    expect(
      validateBlockchainEventParameters('verify', { transactionHash: TX_HASH }),
    ).toEqual({ transactionHash: TX_HASH });
  });

  it('requires a well-formed transactionHash', () => {
    expect(() =>
      validateBlockchainEventParameters('verify', {}),
    ).toThrow(BlockchainParameterError);
    expect(() =>
      validateBlockchainEventParameters('verify', { transactionHash: '0x1234' }),
    ).toThrow(BlockchainParameterError);
    expect(() =>
      validateBlockchainEventParameters('verify', { transactionHash: null }),
    ).toThrow(BlockchainParameterError);
  });
});

describe('validateBlockchainEventParameters - index', () => {
  it('accepts transactionHash and blockNumber together', () => {
    expect(
      validateBlockchainEventParameters('index', {
        transactionHash: TX_HASH,
        blockNumber: 100,
      }),
    ).toEqual({ transactionHash: TX_HASH, blockNumber: 100 });
    expect(
      validateBlockchainEventParameters('index', {
        transactionHash: TX_HASH,
        blockNumber: '0x64',
      }),
    ).toEqual({ transactionHash: TX_HASH, blockNumber: '0x64' });
  });

  it('requires both source-identity fields', () => {
    expect(() =>
      validateBlockchainEventParameters('index', { transactionHash: TX_HASH }),
    ).toThrow(BlockchainParameterError);
    expect(() =>
      validateBlockchainEventParameters('index', { blockNumber: 100 }),
    ).toThrow(BlockchainParameterError);
    expect(() =>
      validateBlockchainEventParameters('index', {
        transactionHash: TX_HASH,
        blockNumber: -1,
      }),
    ).toThrow(BlockchainParameterError);
  });
});

describe('validateBlockchainEventParameters - errors are permanent and payload-free', () => {
  it('requires an object parameters for field-bearing actions', () => {
    for (const action of ['listen', 'verify', 'index'] as const) {
      expect(() => validateBlockchainEventParameters(action, 'garbage')).toThrow(
        BlockchainParameterError,
      );
      expect(() => validateBlockchainEventParameters(action, null)).toThrow(
        BlockchainParameterError,
      );
    }
  });

  it('rejects unknown actions with a categorized error', () => {
    expect(() =>
      validateBlockchainEventParameters('hack' as never, { fromBlock: 1 }),
    ).toThrow(BlockchainParameterError);
  });

  it('error messages carry the field name and a value class, never raw payload content', () => {
    try {
      validateBlockchainEventParameters('verify', { transactionHash: 'secret-arbitrary-value' });
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BlockchainParameterError);
      const message = (error as Error).message;
      expect(message).toContain('transactionHash');
      expect(message).not.toContain('secret-arbitrary-value');
    }
  });

  it('uses a stable error code', () => {
    try {
      validateBlockchainEventParameters('verify', {});
      throw new Error('expected to throw');
    } catch (error) {
      expect((error as BlockchainParameterError).code).toBe('BLOCKCHAIN_PARAMETER_INVALID');
      expect((error as Error).name).toBe('BlockchainParameterError');
    }
  });
});
