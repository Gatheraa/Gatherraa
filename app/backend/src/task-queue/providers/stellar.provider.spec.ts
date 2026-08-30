// StellarProvider tests (issue #708)
//
// Covers the Soroban `getTransaction` RPC method: successful shape, transient
// not-found semantics, and rejection of incompatible (EVM JSON-RPC) endpoints.

import { StellarProvider, StellarTransport } from './stellar.provider';

const ENDPOINT = 'https://soroban-rpc.example.test';

function result(overrides: { ok?: boolean; status?: number; json?: unknown } = {}): {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
} {
  return {
    ok: overrides.ok ?? false,
    status: overrides.status ?? 500,
    json: async () => overrides.json,
  };
}

describe('StellarProvider.getTransaction', () => {
  it('returns a shaped success result with typed events', async () => {
    const transport: StellarTransport = jest.fn().mockResolvedValue(
      result({
        ok: true,
        status: 200,
        json: {
          result: {
            status: 'success',
            ledger: 1234,
            applicationOrder: 7,
            events: [
              {
                type: 'diagnostic',
                contractId: 'cafe',
                topic: ['dG9waWM='],
                value: 'dmFsdWU=',
                inSuccessfulContractCall: true,
              },
            ],
          },
        },
      }),
    );

    const provider = new StellarProvider(ENDPOINT, transport);
    const res = await provider.getTransaction('tx-hash-1');

    expect(res.ok).toBe(true);
    expect(res.status).toBe('success');
    expect(res.hash).toBe('tx-hash-1');
    expect(res.ledger).toBe(1234);
    expect(res.applicationOrder).toBe(7);
    expect(res.events).toHaveLength(1);
    expect(res.events[0]).toMatchObject({
      type: 'diagnostic',
      contractId: 'cafe',
      topic: ['dG9waWM='],
      value: 'dmFsdWU=',
      inSuccessfulContractCall: true,
    });
  });

  it('reports a not-yet-confirmed transaction as notFound (retryable), not thrown', async () => {
    const transport: StellarTransport = jest
      .fn()
      .mockResolvedValue(
        result({ ok: true, status: 200, json: { result: { status: 'NOT_FOUND' } } }),
      );

    const provider = new StellarProvider(ENDPOINT, transport);
    const res = await provider.getTransaction('tx-hash-pending');

    expect(res.ok).toBe(false);
    expect(res.status).toBe('notFound');
    expect(res.error).toBe('transaction_not_found');
    expect(res.events).toEqual([]);
  });

  it('rejects an EVM JSON-RPC endpoint response as incompatible, never accepting it', async () => {
    // An EVM endpoint rejects the Soroban method with a JSON-RPC error object.
    const rpcErrorTransport: StellarTransport = jest.fn().mockResolvedValue(
      result({
        ok: true,
        status: 200,
        json: { error: { code: -32601, message: 'method not found' } },
      }),
    );

    const provider = new StellarProvider(ENDPOINT, rpcErrorTransport);
    const res = await provider.getTransaction('tx-hash-evm');

    expect(res.ok).toBe(false);
    expect(res.status).toBe('incompatible');
    expect(res.error).toBe('jsonrpc_error');
    expect(res.events).toEqual([]);
  });

  it('rejects an EVM endpoint that answers with an HTTP error as incompatible', async () => {
    const httpErrorTransport: StellarTransport = jest
      .fn()
      .mockResolvedValue(result({ ok: false, status: 404 }));

    const provider = new StellarProvider(ENDPOINT, httpErrorTransport);
    const res = await provider.getTransaction('tx-hash-evm-http');

    expect(res.ok).toBe(false);
    expect(res.status).toBe('incompatible');
    expect(res.error).toBe('non_2xx:404');
    expect(res.events).toEqual([]);
  });

  it('reports an unreachable transport as categorized, never leaking the endpoint', async () => {
    const transport: StellarTransport = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const provider = new StellarProvider(ENDPOINT, transport);
    const res = await provider.getTransaction('tx-hash-unreachable');

    expect(res.ok).toBe(false);
    expect(res.status).toBe('unreachable');
    expect(res.error).toBe('unreachable');
    expect(JSON.stringify(res)).not.toContain(ENDPOINT);
  });
});
