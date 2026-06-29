/**
 * Base class for every error thrown by the rhinofi swidge protocol.
 * Catch this to handle any module-specific failure.
 */
export class RhinofiProtocolError extends Error {
    /**
     * Creates a new rhinofi protocol error.
     *
     * @param {string} message - The human-readable error message.
     * @param {Object} [details] - Optional error details.
     * @param {unknown} [details.cause] - The error's cause.
     */
    constructor(message: string, details?: {
        cause?: unknown;
    });
}
/**
 * Thrown when an operation requires a full (signing) wallet account but the
 * protocol was constructed without one, or with a read-only account.
 */
export class AccountRequiredError extends RhinofiProtocolError {
    /**
     * Creates a new account-required error.
     *
     * @param {string} operation - The operation that required the account (e.g. 'execute a swidge').
     */
    constructor(operation: string);
}
/**
 * Thrown when the protocol is missing required configuration, such as the
 * rhino.fi API key.
 */
export class ConfigurationError extends RhinofiProtocolError {
}
/**
 * Thrown when a chain is not supported by the rhino.fi protocol (or is not a
 * valid source chain for the provided account).
 */
export class UnsupportedChainError extends RhinofiProtocolError {
    /**
     * Creates a new unsupported-chain error.
     *
     * @param {string | number} chain - The unsupported chain identifier.
     */
    constructor(chain: string | number);
    /**
     * The unsupported chain identifier.
     *
     * @type {string | number}
     */
    chain: string | number;
}
/**
 * Thrown when a token is not supported on the given chain.
 */
export class UnsupportedTokenError extends RhinofiProtocolError {
    /**
     * Creates a new unsupported-token error.
     *
     * @param {string} token - The unsupported token identifier.
     * @param {string | number} chain - The chain on which the token was looked up.
     */
    constructor(token: string, chain: string | number);
    /**
     * The unsupported token identifier.
     *
     * @type {string}
     */
    token: string;
    /**
     * The chain on which the token was looked up.
     *
     * @type {string | number}
     */
    chain: string | number;
}
/**
 * Thrown by {@link swidge} when the quoted fees exceed the configured
 * `maxNetworkFeeBps` / `maxProtocolFeeBps` thresholds.
 */
export class FeeLimitExceededError extends RhinofiProtocolError {
    /**
     * Creates a new fee-limit-exceeded error.
     *
     * @param {'network' | 'protocol'} feeType - Which fee threshold was exceeded.
     * @param {bigint} actualBps - The actual fee in basis points of the input.
     * @param {bigint} maxBps - The configured maximum in basis points.
     */
    constructor(feeType: "network" | "protocol", actualBps: bigint, maxBps: bigint);
    /**
     * Which fee threshold was exceeded.
     *
     * @type {'network' | 'protocol'}
     */
    feeType: "network" | "protocol";
    /**
     * The actual fee in basis points of the input.
     *
     * @type {bigint}
     */
    actualBps: bigint;
    /**
     * The configured maximum in basis points.
     *
     * @type {bigint}
     */
    maxBps: bigint;
}
/**
 * Thrown when no swidge operation exists for the given identifier.
 */
export class UnknownOperationError extends RhinofiProtocolError {
    /**
     * The unknown swidge identifier.
     *
     * @type {string}
     */
    id: string;
}
/**
 * Thrown when the underlying rhino.fi quote or execution fails. The `code`
 * carries the rhino.fi failure type (e.g. 'InsufficientBalance',
 * 'NegativeReceiveAmount', 'TokenApprovalFailed') for programmatic handling.
 */
export class SwidgeExecutionError extends RhinofiProtocolError {
    /**
     * Creates a new swidge execution error.
     *
     * @param {string} message - The human-readable error message.
     * @param {{ cause?: unknown, code?: string }} [options] - Error options.
     */
    constructor(message: string, options?: {
        cause?: unknown;
        code?: string;
    });
    /**
     * The rhino.fi failure type (e.g. 'InsufficientBalance'), when known.
     *
     * @type {string | undefined}
     */
    code: string | undefined;
}
