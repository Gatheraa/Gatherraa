// Decode error retry classification tests (issue #714).
//
// Proves each decode outcome maps to the correct retry policy, and that a
// permanent decode error is detected at the worker boundary (and only those).

import {
  SorobanEventDecodeError,
  PERMANENT_DECODE_ERRORS,
  decodeErrorMessage,
  decodeRetryPolicy,
  isPermanentDecodeError,
  DecodeErrorCode,
} from './decode-retry.classifier';

describe('decode error retry classification (issue #714)', () => {
  const PERMANENT: DecodeErrorCode[] = [
    'InvalidBase64',
    'TruncatedXdr',
    'MalformedXdr',
    'UnsupportedEvent',
    'UnexpectedContractId',
    'InvalidPayload',
  ];

  it('classifies every permanent decode outcome as non-retryable (DLQ on first failure)', () => {
    for (const code of PERMANENT) {
      expect(PERMANENT_DECODE_ERRORS.has(code)).toBe(true);
      expect(decodeRetryPolicy(code)).toEqual({ retryable: false, onFirstFailure: 'dlq' });
    }
  });

  it('covers the four permanent outcomes named by the issue', () => {
    for (const code of ['InvalidBase64', 'MalformedXdr', 'UnsupportedEvent', 'InvalidPayload']) {
      expect(PERMANENT_DECODE_ERRORS.has(code as DecodeErrorCode)).toBe(true);
    }
  });

  it('does not treat an arbitrary error as a permanent decode failure', () => {
    expect(isPermanentDecodeError(new Error('temporary provider timeout'))).toBe(false);
    expect(isPermanentDecodeError('MalformedXdr')).toBe(false);
    expect(isPermanentDecodeError(undefined)).toBe(false);
  });

  it('detects a SorobanEventDecodeError carrying a permanent code', () => {
    const err = new SorobanEventDecodeError('MalformedXdr');
    expect(err.name).toBe('SorobanEventDecodeError');
    expect(err.code).toBe('MalformedXdr');
    expect(isPermanentDecodeError(err)).toBe(true);
  });

  it('never leaks the offending input in decode error messages', () => {
    for (const code of PERMANENT) {
      const message = decodeErrorMessage(code);
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toContain('AAAA');
      expect(message).not.toContain('base64:'); // no raw payload embedding
    }
    expect(decodeErrorMessage('MalformedXdr')).toMatch(/DiagnosticEvent/);
  });
});
