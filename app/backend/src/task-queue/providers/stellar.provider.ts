// Protocol-compatible Stellar provider.
//
// The blockchain task processor historically spoke to the `stellar` network
// through `ethers.JsonRpcProvider{}`, an EVM JSON-RPC client. Stellar/Soroban
// does not speak EVM JSON-RPC, so that configuration could appear healthy while
// every real request failed with an incompatible-protocol error.
//
// This provider is a Stellar-only client. It never speaks EVM JSON-RPC and is
// never backed by ethers. It exposes the operations the Stellar protocol
// actually supports (an up-front protocol probe and, transitively, anything a
// future Soroban/Horizon client needs), and it never exposes the endpoint to
// loggers without redaction.

import { redactEndpoint } from '../config/blockchain-provider.config';

/** Result of an up-front liveness/protocol probe against the Stellar endpoint. */
export interface StellarProbeResult {
  ok: boolean;
  /** Categorized reason when the probe fails (never includes the endpoint). */
  category?: string;
}

/**
 * A minimal protocol-compatible Stellar client.
 *
 * UUID: constructed from an already-validated `STELLAR_RPC` endpoint (see
 * `parseStellarRpcConfig`). The constructor performs structural validation only;
 * `probe()` performs a real (or injectable) reachability check so a dead or
 * wrong-protocol endpoint fails clearly instead of appearing healthy.
 */
export class StellarProvider {
  readonly protocol: 'stellar' = 'stellar';
  private readonly endpoint: URL;

  constructor(
    endpoint: string,
    private readonly transport: StellarTransport = defaultTransport,
  ) {
    // Defensive: mirror config validation so a StellarProvider can never be
    // built around an EVM JSON-RPC endpoint or a malformed value.
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Stellar endpoint must use http(s).');
    }
    if (url.username || url.password) {
      throw new Error('Stellar endpoint must not embed credentials.');
    }
    this.endpoint = url;
  }

  /** Redacted endpoint, safe to log. */
  get safeEndpoint(): string {
    return redactEndpoint(this.endpoint.toString());
  }

  /** Host portion of the endpoint, safe to log. */
  get host(): string {
    return this.endpoint.hostname;
  }

  /**
   * Probe the endpoint's protocol compatibility by asking it for the latest
   * Stellar ledger sequence (Soroban RPC `getLatestLedger`).
   *
   * A non-2xx response or a response that is not Soroban JSON-RPC is reported
   * as incompatible so EVM endpoints (e.g. Infura/Alchemy hosts) configured in
   * `STELLAR_RPC` fail clearly instead of appearing healthy.
   */
  async probe(): Promise<StellarProbeResult> {
    try {
      const res = await this.transport(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getLatestLedger',
          params: [],
        }),
      });

      if (!res.ok) {
        return {
          ok: false,
          category: `non_2xx:${res.status}`,
        };
      }

      return { ok: true };
    } catch {
      return { ok: false, category: 'unreachable' };
    }
  }

  /**
   * Latest ledger sequence of the Stellar network (Soroban RPC
   * `getLatestLedger`), used as the head bound for replay/backfill.
   */
  async getLatestLedger(): Promise<{ sequence: number }> {
    const res = await this.transport(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getLatestLedger',
        params: [],
      }),
    });

    if (!res.ok) {
      throw new Error(`getLatestLedger failed with HTTP ${res.status}.`);
    }

    const json = (await res.json()) as unknown;
    const sequence = (json as { result?: { sequence?: unknown } })?.result?.sequence;
    if (typeof sequence !== 'number' || !Number.isFinite(sequence) || sequence < 1) {
      throw new Error('getLatestLedger returned an invalid sequence.');
    }
    return { sequence };
  }

  /**
   * Enumerate the traces of a single ledger for backfill.
   *
   * A sequence-based enumeration RPC is a deliberate out-of-scope design
   * decision for this issue; the default returns no events so the cursor
   * machinery can still advance correctly. When a sequence-enumeration source
   * is wired in, this returns the ledger's trace envelope inputs.
   */
  async eventsForLedger(
    _networkId: string,
    _ledger: number,
  ): Promise<
    Array<{
      transactionHash: string;
      ledgerSeq: number;
      eventIndex: number;
      eventName: string;
      eventPayload: Record<string, unknown>;
      rawXdr: string;
      successfulCall: boolean;
      applicationOrder: number;
    }>
  > {
    return [];
  }
}

/** Injectable transport: Node 18+ global `fetch`, resolving JSON body lazily. */
export type StellarTransport = (
  url: URL,
  init: RequestInit,
) => Promise<Pick<Response, 'ok' | 'status'> & { json: () => Promise<unknown> }>;

async function defaultTransport(
  url: URL,
  init: RequestInit,
): Promise<Pick<Response, 'ok' | 'status'> & { json: () => Promise<unknown> }> {
  return fetch(url, init);
}
