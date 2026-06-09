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
   * @param {string} message - The human-readable error message.
   * @param {{ cause?: unknown }} [options] - Optional error options (e.g. the underlying cause).
   */
  constructor (message, options) {
    super(message, options)
    this.name = this.constructor.name
  }
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
  constructor (operation = 'execute a swidge') {
    super(`A wallet account with signing capabilities is required to ${operation}. Construct RhinofiProtocol with a full IWalletAccount.`)
  }
}

/**
 * Thrown when the protocol is missing required configuration, such as the
 * rhino.fi API key. This is a developer error.
 */
export class ConfigurationError extends RhinofiProtocolError {}

/**
 * Thrown when a chain is not supported by the rhino.fi protocol (or is not a
 * valid source chain for the provided account). User-actionable.
 */
export class UnsupportedChainError extends RhinofiProtocolError {
  /**
   * @param {string | number} chain - The unsupported chain identifier.
   */
  constructor (chain) {
    super(`Chain "${chain}" is not supported by the rhino.fi protocol.`)
    this.chain = chain
  }
}

/**
 * Thrown when a token is not supported on the given chain. User-actionable.
 */
export class UnsupportedTokenError extends RhinofiProtocolError {
  /**
   * @param {string} token - The unsupported token identifier.
   * @param {string | number} chain - The chain on which the token was looked up.
   */
  constructor (token, chain) {
    super(`Token "${token}" is not supported on chain "${chain}".`)
    this.token = token
    this.chain = chain
  }
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
  constructor (feeType, actualBps, maxBps) {
    super(`The quoted ${feeType} fee (${actualBps} bps) exceeds the configured maximum (${maxBps} bps).`)
    this.feeType = feeType
    this.actualBps = actualBps
    this.maxBps = maxBps
  }
}

/**
 * Thrown when no swidge operation exists for the given identifier.
 */
export class UnknownOperationError extends RhinofiProtocolError {
  /**
   * @param {string} id - The unknown swidge identifier.
   * @param {{ cause?: unknown }} [options] - Optional error options.
   */
  constructor (id, options) {
    super(`No swidge operation found for id "${id}".`, options)
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
   * @param {string} message - The human-readable error message.
   * @param {{ cause?: unknown, code?: string }} [options] - Error options.
   */
  constructor (message, options = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    /** @type {string | undefined} */
    this.code = options.code
  }
}

/**
 * The shape this module reads from a rhino.fi SDK error to derive a code/detail.
 *
 * @typedef {object} RhinoErrorLike
 * @property {string} [code] - A code set by this module's own errors.
 * @property {string} [type] - The rhino.fi `BridgeError` discriminator.
 * @property {string} [_tag] - The API error tag.
 * @property {{ _tag?: string }} [originalError] - A wrapped underlying error.
 * @property {bigint} [availableBalance] - The available balance (InsufficientBalance).
 * @property {string[]} [chains] - The unsupported chains.
 * @property {string[]} [tokens] - The unsupported tokens.
 */

/**
 * Derives a stable code and human-readable detail from a rhino.fi SDK error
 * (a `BridgeError`, or an API error carrying a `_tag`).
 *
 * @param {unknown} error - The error returned by the rhino.fi SDK.
 * @returns {{ code?: string, detail?: string }} The extracted code and detail.
 */
export const describeRhinoError = (error) => {
  if (!error || typeof error !== 'object') return {}
  const rhinoError = /** @type {RhinoErrorLike} */ (error)
  const code = rhinoError.code ?? rhinoError.originalError?._tag ?? rhinoError.type ?? rhinoError._tag
  switch (code) {
    case 'NegativeReceiveAmount':
      return { code, detail: 'the requested amount is too small to cover the fees' }
    case 'InsufficientBalance':
      return { code, detail: rhinoError.availableBalance !== undefined ? `available balance is ${rhinoError.availableBalance}` : 'the account has insufficient balance' }
    case 'BridgeTimeout':
      return { code, detail: 'timed out waiting for rhino.fi to confirm the bridge' }
    case 'QuoteRejected':
      return { code, detail: 'the quote was rejected' }
    case 'ChainNotSupported':
      return { code, detail: Array.isArray(rhinoError.chains) ? `unsupported chain(s): ${rhinoError.chains.join(', ')}` : undefined }
    case 'TokenNotSupported':
    case 'SwapTokensNotSupported':
      return { code, detail: Array.isArray(rhinoError.tokens) ? `unsupported token(s): ${rhinoError.tokens.join(', ')}` : undefined }
    case 'WrongNetworkOnChainAdapter':
      return { code, detail: 'the source chain does not match the wallet account' }
    default:
      return { code }
  }
}

/**
 * Builds a {@link SwidgeExecutionError} from a rhino.fi SDK error, enriching the
 * message with the precise failure and attaching its `code`.
 *
 * @param {string} baseMessage - The context (what we were attempting).
 * @param {unknown} rhinoError - The error returned by the rhino.fi SDK.
 * @returns {SwidgeExecutionError} The enriched error.
 */
export const swidgeExecutionError = (baseMessage, rhinoError) => {
  const { code, detail } = describeRhinoError(rhinoError)
  return new SwidgeExecutionError(detail ? `${baseMessage} (${detail}).` : baseMessage, { cause: rhinoError, code })
}
