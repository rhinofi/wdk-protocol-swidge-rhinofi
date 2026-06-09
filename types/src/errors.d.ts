/**
 * Base class for every error thrown by the rhinofi swidge protocol.
 * Catch this to handle any module-specific failure.
 */
export class RhinofiProtocolError extends Error {
    /**
     * @param {string} message - The human-readable error message.
     * @param {{ cause?: unknown }} [options] - Optional error options (e.g. the underlying cause).
     */
    constructor(message: string, options?: {
        cause?: unknown;
    });
}
/**
 * Thrown when an operation requires a full (signing) wallet account but the
 * protocol was constructed without one, or with a read-only account.
 * This is a developer error.
 */
export class AccountRequiredError extends RhinofiProtocolError {
    /**
     * @param {string} [operation] - The operation that required the account.
     */
    constructor(operation?: string);
}
/**
 * Thrown when the protocol is missing required configuration, such as the
 * rhino.fi API key. This is a developer error.
 */
export class ConfigurationError extends RhinofiProtocolError {
}
/**
 * Thrown when a chain is not supported by the rhino.fi protocol (or is not a
 * valid source chain for the provided account). User-actionable.
 */
export class UnsupportedChainError extends RhinofiProtocolError {
    /**
     * @param {string | number} chain - The unsupported chain identifier.
     */
    constructor(chain: string | number);
    chain: string | number;
}
/**
 * Thrown when a token is not supported on the given chain. User-actionable.
 */
export class UnsupportedTokenError extends RhinofiProtocolError {
    /**
     * @param {string} token - The unsupported token identifier.
     * @param {string | number} chain - The chain on which the token was looked up.
     */
    constructor(token: string, chain: string | number);
    token: string;
    chain: string | number;
}
/**
 * Thrown by {@link swidge} when the quoted fees exceed the configured
 * `maxNetworkFeeBps` / `maxProtocolFeeBps` thresholds. User-actionable.
 */
export class FeeLimitExceededError extends RhinofiProtocolError {
    /**
     * @param {'network' | 'protocol'} feeType - Which fee threshold was exceeded.
     * @param {bigint} actualBps - The actual fee in basis points of the input.
     * @param {bigint} maxBps - The configured maximum in basis points.
     */
    constructor(feeType: "network" | "protocol", actualBps: bigint, maxBps: bigint);
    feeType: "network" | "protocol";
    actualBps: bigint;
    maxBps: bigint;
}
/**
 * Thrown when no swidge operation exists for the given identifier.
 */
export class UnknownOperationError extends RhinofiProtocolError {
    id: string;
}
/**
 * Thrown when the underlying rhino.fi quote or execution fails. The `code`
 * carries the rhino.fi failure type (e.g. 'InsufficientBalance',
 * 'NegativeReceiveAmount', 'TokenApprovalFailed') for programmatic handling.
 */
export class SwidgeExecutionError extends RhinofiProtocolError {
    /**
     * @param {string} message - The human-readable error message.
     * @param {{ cause?: unknown, code?: string }} [options] - Error options.
     */
    constructor(message: string, options?: {
        cause?: unknown;
        code?: string;
    });
    /** @type {string | undefined} */
    code: string | undefined;
}
export function describeRhinoError(error: unknown): {
    code?: string;
    detail?: string;
};
export function swidgeExecutionError(baseMessage: string, rhinoError: unknown): SwidgeExecutionError;
/**
 * The shape this module reads from a rhino.fi SDK error to derive a code/detail.
 */
export type RhinoErrorLike = {
    /**
     * - A code set by this module's own errors.
     */
    code?: string;
    /**
     * - The rhino.fi `BridgeError` discriminator.
     */
    type?: string;
    /**
     * - The API error tag.
     */
    _tag?: string;
    /**
     * - A wrapped underlying error.
     */
    originalError?: {
        _tag?: string;
    };
    /**
     * - The available balance (InsufficientBalance).
     */
    availableBalance?: bigint;
    /**
     * - The unsupported chains.
     */
    chains?: string[];
    /**
     * - The unsupported tokens.
     */
    tokens?: string[];
};
