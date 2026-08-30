// StellarProvider tests (issue #708)
//
// Covers the Soroban `getTransactionResult` RPC method: successful shape, transient
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

describe('StellarProvider.getTransactionResult', () => {
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
    const res = await provider.getTransactionResult('tx-hash-1');

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
    const res = await provider.getTransactionResult('tx-hash-pending');

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
    const res = await provider.getTransactionResult('tx-hash-evm');

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
    const res = await provider.getTransactionResult('tx-hash-evm-http');

    expect(res.ok).toBe(false);
    expect(res.status).toBe('incompatible');
    expect(res.error).toBe('non_2xx:404');
    expect(res.events).toEqual([]);
  });

  it('reports an unreachable transport as categorized, never leaking the endpoint', async () => {
    const transport: StellarTransport = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const provider = new StellarProvider(ENDPOINT, transport);
    const res = await provider.getTransactionResult('tx-hash-unreachable');

    expect(res.ok).toBe(false);
    expect(res.status).toBe('unreachable');
    expect(res.error).toBe('unreachable');
    expect(JSON.stringify(res)).not.toContain(ENDPOINT);
  });
});

describe('StellarProvider.getTransaction', () => {
  it('normalizes a SUCCESS transaction into typed events', async () => {
    const provider = new StellarProvider(
      'https://soroban-rpc.test',
      transport({
        result: {
          status: 'SUCCESS',
          ledger: 42,
          events: [
            {
              type: 'diagnostic',
              contractId: 'contract-a',
              inSuccessfulContractCall: true,
              topic: [scSymbol('course_created')],
              value: scSymbol('payload-symbol'),
              index: 0,
            },
          ],
        },
      }),
    );

    const result = await provider.getTransaction('0x' + 'a'.repeat(64));
    expect(result.status).toBe('SUCCESS');
    expect(result.ledgerSeq).toBe(42);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      contractId: 'contract-a',
      eventName: 'course_created',
      payload: 'payload-symbol',
      successfulCall: true,
      applicationOrder: 0,
    });
    expect(result.events[0].rawTopicXdr).toBe(scSymbol('course_created'));
  });

  it('categorizes a FAILED transaction as reverted with its result code', async () => {
    const provider = new StellarProvider(
      'https://soroban-rpc.test',
      transport({
        result: { status: 'FAILED', ledger: 41, resultCode: 'txv_bad_auth', events: [] },
      }),
    );

    const result = await provider.getTransaction('0x' + 'b'.repeat(64));
    expect(result.status).toBe('FAILED');
    expect(result.ledgerSeq).toBe(41);
    expect(result.resultCode).toBe('txv_bad_auth');
    expect(result.events).toHaveLength(0);
  });

  it('categorizes a missing result as NOT_FOUND', async () => {
    const provider = new StellarProvider(
      'https://soroban-rpc.test',
      transport({
        result: { status: 'NOT_FOUND', events: [] },
      }),
    );

    const result = await provider.getTransaction('0x' + 'c'.repeat(64));
    expect(result.status).toBe('NOT_FOUND');
  });

  it('categorizes an empty result envelope as NOT_FOUND', async () => {
    const provider = new StellarProvider('https://soroban-rpc.test', transport({}));

    const result = await provider.getTransaction('0x' + 'd'.repeat(64));
    expect(result.status).toBe('NOT_FOUND');
    expect(result.events).toEqual([]);
  });

  it('throws a categorized error on a non-2xx response', async () => {
    const provider = new StellarProvider('https://soroban-rpc.test', transport({}, false, 500));

    await expect(provider.getTransaction('0x' + 'e'.repeat(64))).rejects.toThrow(/HTTP 500/);
  });

  it('throws a categorized error on a non-JSON response', async () => {
    const transportFailing = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new Error('invalid json')),
    });
    const provider = new StellarProvider('https://soroban-rpc.test', transportFailing);

    await expect(provider.getTransaction('0x' + 'f'.repeat(64))).rejects.toThrow(/non-JSON/);
  });
});

describe('decodeScSymbol', () => {
  it('decodes a valid ScSymbol base64', () => {
    expect(decodeScSymbol(scSymbol('course_created'))).toBe('course_created');
  });

  it('returns null for a non-ScSymbol discriminant', () => {
    const bytes = Buffer.alloc(6);
    bytes[0] = 1; // not ScSymbol
    expect(decodeScSymbol(bytes.toString('base64'))).toBeNull();
  });

  it('returns null for truncated input', () => {
    expect(decodeScSymbol(Buffer.from([5]).toString('base64'))).toBeNull();
  });

  it('returns null for a length that exceeds the buffer', () => {
    const bytes = Buffer.from([5, 255, 255, 255, 31, 97]);
    expect(decodeScSymbol(bytes.toString('base64'))).toBeNull();
  });

  it('returns null for non-ASCII content', () => {
    const len = 1;
    const bytes = Buffer.alloc(5 + len);
    bytes[0] = 5;
    bytes.writeUInt32LE(len, 1);
    bytes[5] = 0xff;
    expect(decodeScSymbol(bytes.toString('base64'))).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(decodeScSymbol('')).toBeNull();
  });

  it('returns null for invalid base64', () => {
    expect(decodeScSymbol('!!!not-base64!!!')).toBeNull();
  });
});
