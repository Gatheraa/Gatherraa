// StellarProvider replay-head tests (issue #711)
//
// Proves `getLatestLedger` returns a typed sequence using the injectable
// transport and categorizes invalid responses.

import { StellarProvider } from './stellar.provider';

function transport(json: unknown, ok = true, status = 200) {
  return jest.fn().mockResolvedValue({ ok, status, json: async () => json });
}

describe('StellarProvider.getLatestLedger', () => {
  it('returns the head ledger sequence', async () => {
    const provider = new StellarProvider(
      'https://soroban-rpc.test',
      transport({
        result: { sequence: 42 },
      }),
    );
    await expect(provider.getLatestLedger()).resolves.toEqual({ sequence: 42 });
  });

  it('throws a categorized error for a non-2xx response', async () => {
    const provider = new StellarProvider('https://soroban-rpc.test', transport({}, false, 500));
    await expect(provider.getLatestLedger()).rejects.toThrow(/HTTP 500/);
  });

  it('rejects an invalid sequence as unusable', async () => {
    const provider = new StellarProvider(
      'https://soroban-rpc.test',
      transport({ result: { sequence: 'x' } }),
    );
    await expect(provider.getLatestLedger()).rejects.toThrow(/invalid sequence/);
  });
});
