// Configuration tests for blockchain provider parsing (issue #692).
//
// Covers:
//  - valid Stellar configuration resolves to a Stellar (non-EVM) provider
//  - invalid Stellar configuration fails clearly when enabled
//  - endpoint credentials / secret query params are never surfaced verbatim

import {
  parseStellarRpcConfig,
  resolveStellarProviderConfig,
  redactEndpoint,
  StellarConfigError,
  STELLAR_NETWORK_ID,
} from '../src/task-queue/config/blockchain-provider.config';

describe('blockchain-provider.config', () => {
  describe('redactEndpoint', () => {
    it('redacts userinfo credentials and secret query params', () => {
      const redacted = redactEndpoint(
        'https://user:supersecret@stellar-rpc.example.com/stellar?apikey=abc123&token=xyz',
      );
      expect(redacted).not.toContain('supersecret');
      expect(redacted).not.toContain('abc123');
      expect(redacted).not.toContain('user:');
      expect(redacted).toContain('stellar-rpc.example.com');
    });

    it('returns a stub for a non-parseable value without echoing it', () => {
      expect(redactEndpoint('not a url with secret value')).toBe('<invalid-url:redacted>');
    });
  });

  describe('parseStellarRpcConfig', () => {
    it('returns undefined when STELLAR_RPC is not configured', () => {
      expect(parseStellarRpcConfig(undefined)).toBeUndefined();
      expect(parseStellarRpcConfig('')).toBeUndefined();
      expect(parseStellarRpcConfig('   ')).toBeUndefined();
      expect(parseStellarRpcConfig(null)).toBeUndefined();
    });

    it('accepts a valid HTTPS Stellar (Soroban/Horizon) endpoint', () => {
      const parsed = parseStellarRpcConfig('https://soroban-rpc.example.com');
      expect(parsed).toBe('https://soroban-rpc.example.com/');
    });

    it.each([
      ['not a url', 'STELLAR_RPC_MALFORMED'],
      ['ftp://example.com', 'STELLAR_RPC_INVALID_SCHEME'],
      ['wss://example.com', 'STELLAR_RPC_INVALID_SCHEME'],
      ['https://user:pass@example.com', 'STELLAR_RPC_EMBEDDED_CREDENTIALS'],
    ])('rejects invalid configuration %s with a categorized error', (value, expectedCode) => {
      expect.assertions(2);
      try {
        parseStellarRpcConfig(value);
        fail('expected parseStellarRpcConfig to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(StellarConfigError);
        expect((error as StellarConfigError).code).toBe(expectedCode);
      }
    });

    it('never echoes the configured value in its error messages', () => {
      expect.assertions(2);
      try {
        parseStellarRpcConfig('https://user:supersecret@/bad');
        fail('expected parseStellarRpcConfig to throw');
      } catch (error) {
        expect(error.message).toContain('STELLAR_RPC');
        expect(error.message).not.toContain('supersecret');
      }
    });
  });

  describe('resolveStellarProviderConfig', () => {
    it('resolves to a Stellar (non-EVM) protocol config with redacted endpoint', () => {
      const config = resolveStellarProviderConfig('https://horizon.stellar.org');
      expect(config).toBeDefined();
      expect(config!.networkId).toBe(STELLAR_NETWORK_ID);
      expect(config!.protocol).toBe('stellar');
      expect(config!.safeEndpoint).toContain('stellar.org');
    });

    it('returns undefined when Stellar is not enabled', () => {
      expect(resolveStellarProviderConfig(undefined)).toBeUndefined();
    });
  });
});
