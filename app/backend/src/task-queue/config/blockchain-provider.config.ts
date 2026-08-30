// Blockchain provider configuration parsing and validation.
//
// Kept free of NestJS / provider client imports so it can be unit-tested in
// isolation and reused by any consumer that must turn raw RPC configuration
// into a validated, protocol-classified description.
//
// Rationale: the blockchain task processor historically routed the Stellar
// network through an EVM JSON-RPC client (ethers), which is protocol
// incompatible and fails only lazily on the first real request. This module
// makes the incompatibility explicit: Stellar endpoints are classified as
// Stellar, validated up front, and any URL is redacted before it can reach a
// log line or error message so endpoint credentials never leak.

export type BlockchainProtocol = 'evm' | 'stellar';

export interface RpcProviderConfig {
  /** Network identifier (chain id for EVM, `stellar` for Stellar). */
  networkId: string;
  /** Protocol the network speaks. */
  protocol: BlockchainProtocol;
  /** Validated, normalized HTTP(S) endpoint. */
  endpoint: string;
  /** Endpoint with any credentials/query secrets removed, safe to log. */
  safeEndpoint: string;
}

export class StellarConfigError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'StellarConfigError';
  }
}

// Network ids that the EVM ethers providers serve.
export const EVM_NETWORK_IDS = ['1', '11155111', '137'] as const;

export const STELLAR_NETWORK_ID = 'stellar';

const URL_SECRET_QUERY_KEYS = /(api[_-]?key|token|secret|key|access[_-]?token)/i;

/**
 * Strip credentials and secret-looking query parameters from a URL so it can
 * be logged or embedded in an error without leaking endpoint secrets.
 *
 * Never pass a raw RPC endpoint to a logger or error message; route it through
 * this first.
 */
export function redactEndpoint(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // Not parseable as a URL — never echo the original, return a stub.
    return '<invalid-url:redacted>';
  }

  // Drop userinfo (`user:pass@host`).
  url.username = '';
  url.password = '';

  // Redact values of secret-looking query params, keeping the key.
  for (const key of Array.from(url.searchParams.keys())) {
    if (URL_SECRET_QUERY_KEYS.test(key)) {
      url.searchParams.set(key, '[redacted]');
    }
  }

  return url.toString();
}

/**
 * Parse and validate the STELLAR_RPC configuration value.
 *
 * Returns `undefined` when the variable is not set or blank (Stellar simply is
 * not enabled). Throws a categorized `StellarConfigError` when the value is set
 * but unusable, so invalid configuration fails clearly at startup rather than
 * appearing healthy. Error messages reference the variable name and never the
 * configured value.
 *
 * @param stellarRpc value of STELLAR_RPC (may be undefined/empty).
 */
export function parseStellarRpcConfig(stellarRpc: string | undefined | null): string | undefined {
  if (!stellarRpc || stellarRpc.trim().length === 0) {
    return undefined;
  }

  const raw = stellarRpc.trim();

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new StellarConfigError(
      'STELLAR_RPC_MALFORMED',
      'STELLAR_RPC is not a valid URL. Configure a Stellar (Soroban/Horizon) HTTPS endpoint.',
    );
  }

  const scheme = url.protocol.toLowerCase();
  if (scheme !== 'http:' && scheme !== 'https:') {
    throw new StellarConfigError(
      'STELLAR_RPC_INVALID_SCHEME',
      'STELLAR_RPC must use http(s). Configure a Stellar (Soroban/Horizon) HTTPS endpoint.',
    );
  }

  if (url.username || url.password) {
    throw new StellarConfigError(
      'STELLAR_RPC_EMBEDDED_CREDENTIALS',
      'STELLAR_RPC must not embed credentials in the URL. Use a dedicated RPC endpoint or secret store.',
    );
  }

  return url.toString();
}

/**
 * Build the validated provider description for the Stellar network.
 *
 * @param stellarRpc value of STELLAR_RPC (may be undefined/empty).
 */
export function resolveStellarProviderConfig(
  stellarRpc: string | undefined | null,
): RpcProviderConfig | undefined {
  const endpoint = parseStellarRpcConfig(stellarRpc);
  if (!endpoint) {
    return undefined;
  }

  return {
    networkId: STELLAR_NETWORK_ID,
    protocol: 'stellar',
    endpoint,
    safeEndpoint: redactEndpoint(endpoint),
  };
}
