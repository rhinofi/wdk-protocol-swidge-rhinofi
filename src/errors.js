// Copyright 2026 Rhino.fi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

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
  constructor (message, details) {
    super(message, details)
    this.name = this.constructor.name
  }
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
  constructor (operation) {
    super(`A wallet account with signing capabilities is required to ${operation}. Construct RhinofiProtocol with a full WalletAccountEvm, WalletAccountEvmErc4337 or WalletAccountTron.`)
  }
}

/**
 * Thrown when the protocol is missing required configuration, such as the
 * rhino.fi API key.
 */
export class ConfigurationError extends RhinofiProtocolError {}

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
  constructor (chain) {
    super(`Chain "${chain}" is not supported by the rhino.fi protocol.`)

    /**
     * The unsupported chain identifier.
     *
     * @type {string | number}
     */
    this.chain = chain
  }
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
  constructor (token, chain) {
    super(`Token "${token}" is not supported on chain "${chain}".`)

    /**
     * The unsupported token identifier.
     *
     * @type {string}
     */
    this.token = token

    /**
     * The chain on which the token was looked up.
     *
     * @type {string | number}
     */
    this.chain = chain
  }
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
  constructor (feeType, actualBps, maxBps) {
    super(`The quoted ${feeType} fee (${actualBps} bps) exceeds the configured maximum (${maxBps} bps).`)

    /**
     * Which fee threshold was exceeded.
     *
     * @type {'network' | 'protocol'}
     */
    this.feeType = feeType

    /**
     * The actual fee in basis points of the input.
     *
     * @type {bigint}
     */
    this.actualBps = actualBps

    /**
     * The configured maximum in basis points.
     *
     * @type {bigint}
     */
    this.maxBps = maxBps
  }
}

/**
 * Thrown when no swidge operation exists for the given identifier.
 */
export class UnknownOperationError extends RhinofiProtocolError {
  /**
   * Creates a new unknown-operation error.
   *
   * @param {string} id - The unknown swidge identifier.
   * @param {Object} [details] - Optional error details.
   * @param {unknown} [details.cause] - The error's cause.
   */
  constructor (id, details) {
    super(`No swidge operation found for id "${id}".`, details)

    /**
     * The unknown swidge identifier.
     *
     * @type {string}
     */
    this.id = id
  }
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
   * @param {Object} [details] - Optional error details.
   * @param {unknown} [details.cause] - The error's cause.
   * @param {string} [details.code] - The rhino.fi failure code.
   */
  constructor (message, details = {}) {
    super(message, details.cause !== undefined ? { cause: details.cause } : undefined)

    /**
     * The rhino.fi failure type (e.g. 'InsufficientBalance'), when known.
     *
     * @type {string | undefined}
     */
    this.code = details.code
  }
}
