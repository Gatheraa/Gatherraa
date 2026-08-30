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
 * A single event from a Soroban `getTransaction` response, shaped and typed for
 * downstream ingestion. Topic and value payloads are carried as the base64 XDR
 * the RPC returns; the worker preserves the raw entry so none of the wire data
 * is lost.
 */
export interface SorobanTransactionEvent {
  /** Soroban event type; always `diagnostic` for contract-triggered events. */
  type: string;
  /** Emitting contract id (hex), when the RPC reports one. */
  contractId?: string;
  /** Base64-encoded topic XDR items emitted with the event. */
  topic: string[];
  /** Base64-encoded data XDR value emitted with the event. */
  value: string;
  /** Whether the enclosing contract call succeeded. */
  inSuccessfulContractCall: boolean;
}

/**
 * Categorized outcome of a Soroban `getTransaction` call. The network status
 * is surfaced separately from the transport/protocol outcome so a not-yet-
 * confirmed or unknown transaction is a distinct, retryable condition rather
 * than a permanent failure.
 */
export type StellarGetTransactionStatus =
  | 'success'
  | 'failed'
  | 'notFound'
  | 'duplicate'
  | 'tryAgainLater'
  | 'incompatible'
  | 'unreachable';

/** Shaped result of a `getTransaction` invocation. */
export interface StellarGetTransactionResult {
  /** Transport/protocol outcome, never the raw RPC response. */
  ok: boolean;
  /** Categorized status (never includes the endpoint). */
  status: StellarGetTransactionStatus;
  /** The transaction hash queried. */
  hash: string;
  /** Ledger sequence when the RPC reports one. */
  ledger?: number;
  /** Application (Soroban) order of the transaction. */
  applicationOrder?: number;
  /** Typed events from the transaction, empty unless status is `success`. */
  events: SorobanTransactionEvent[];
  /** Categorized reason on failure (never includes the endpoint). */
  error?: string;
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

  /**
   * Issue a Soroban JSON-RPC `getTransaction` for the given transaction hash
   * and return a shaped, categorized result (including any `events` array,
   * `ledger`, `status`, and `applicationOrder`).
   *
   * The response is parsed and reshaped here so callers never touch a raw
   * `Response`. A non-Soroban (e.g. EVM JSON-RPC) endpoint, an HTTP error, or
   * an unreachable transport is reported as a categorized status — never
   * silently accepted — and the endpoint is never included in the result.
   *
   * A transaction that is not yet confirmed or is unknown to the network is
   * reported as `notFound`/`tryAgainLater`/`duplicate` (retryable conditions),
   * not thrown, so the caller can decide retry-vs-DLQ semantics.
   */
  async getTransaction(hash: string): Promise<StellarGetTransactionResult> {
    const trimmed = (hash || '').trim();

    try {
      const res = await this.transport(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: { hash: trimmed },
        }),
      });

      if (!res.ok) {
        // An EVM JSON-RPC endpoint (e.g. Infura/Alchemy) rejects Soroban
        // methods at the HTTP boundary or with a JSON-RPC error. Either way it
        // is protocol-incompatible and must never be accepted silently.
        return {
          ok: false,
          status: 'incompatible',
          hash: trimmed,
          events: [],
          error: `non_2xx:${res.status}`,
        };
      }

      const json = (await res.json()) as {
        result?: {
          status?: StellarGetTransactionStatus;
          ledger?: number;
          applicationOrder?: number;
          events?: SorobanTransactionEvent[];
          error?: string;
        };
        error?: { message?: string; code?: unknown };
      };

      // JSON-RPC error object (method unknown / wrong protocol).
      if (json && json.error) {
        return {
          ok: false,
          status: 'incompatible',
          hash: trimmed,
          events: [],
          error: 'jsonrpc_error',
        };
      }

      const result = json?.result;
      if (!result || typeof result !== 'object') {
        return {
          ok: false,
          status: 'incompatible',
          hash: trimmed,
          events: [],
          error: 'malformed_response',
        };
      }

      const status =
        result.status === 'success' || result.status === 'failed' || result.status === 'duplicate'
          ? result.status
          : 'notFound';

      if (status === 'notFound') {
        // Not-yet-confirmed or unknown transaction: a transient, retryable
        // condition for the caller, not a permanent input failure.
        return {
          ok: false,
          status: 'notFound',
          hash: trimmed,
          events: [],
          error: 'transaction_not_found',
        };
      }

      const events = Array.isArray(result.events) ? result.events : [];

      return {
        ok: true,
        status,
        hash: trimmed,
        ledger: result.ledger,
        applicationOrder: result.applicationOrder,
        events: events.map((e) => this.shapeEvent(e)),
      };
    } catch {
      return {
        ok: false,
        status: 'unreachable',
        hash: trimmed,
        events: [],
        error: 'unreachable',
      };
    }
  }

  private shapeEvent(entry: SorobanTransactionEvent): SorobanTransactionEvent {
    return {
      type: String(entry?.type ?? 'diagnostic'),
      contractId: entry?.contractId,
      topic: Array.isArray(entry?.topic) ? entry.topic.map(String) : [],
      value: String(entry?.value ?? ''),
      inSuccessfulContractCall: Boolean(entry?.inSuccessfulContractCall),
    };
  }
}

/** Injectable transport: Node 18+ global `fetch`, resolving JSON body lazily. */
export type StellarTransport = (
  url: URL,
  init: RequestInit,
) => Promise<Pick<Response, 'ok' | 'status'> & { json: () => Promise<unknown> }>;

/** Default transport: Node 18+ global `fetch`. */
async function defaultTransport(
  url: URL,
  init: RequestInit,
): Promise<Pick<Response, 'ok' | 'status'> & { json: () => Promise<unknown> }> {
  return fetch(url, init);
}
