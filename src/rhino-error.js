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

import { SwidgeExecutionError } from './errors.js'

/**
 * The shape this module reads from a rhino.fi SDK error to derive a code/detail.
 *
 * @typedef {Object} RhinoErrorLike
 * @property {string} [code] - A code set by this module's own errors.
 * @property {string} [type] - The rhino.fi `BridgeError` discriminator.
 * @property {string} [_tag] - The API error tag.
 * @property {string} [message] - A plain error message.
 * @property {unknown} [error] - A raw API error payload.
 * @property {unknown} [body] - A raw HTTP response body.
 * @property {number} [httpStatus] - The HTTP status of a failed API response.
 * @property {string} [httpStatusText] - The HTTP status text of a failed API response.
 * @property {string} [approvalTxHash] - The broadcast approval transaction's hash, when the failure happened after an approval left the device.
 * @property {{ _tag?: string, message?: string, cause?: unknown }} [originalError] - A wrapped underlying error.
 * @property {bigint} [availableBalance] - The available balance (InsufficientBalance).
 * @property {string[]} [chains] - The unsupported chains.
 * @property {string[]} [tokens] - The unsupported tokens.
 */

/**
 * The stable code and human-readable detail derived from a rhino.fi SDK error.
 *
 * @typedef {Object} RhinoErrorDescription
 * @property {string} code - The stable rhino.fi failure code (e.g. 'InsufficientBalance').
 * @property {string} [detail] - A human-readable detail describing the failure.
 */

/**
 * @param {unknown} value - The value to check.
 * @returns {value is Record<string, any>} Whether the value is a non-null object.
 */
const isObject = (value) => value != null && typeof value === 'object'

const MAX_CAUSE_DEPTH = 4

/**
 * The `HTTP 403 Forbidden` label for a failed API response, if the error carries one.
 *
 * @param {RhinoErrorLike} rhinoError - The error returned by the rhino.fi SDK.
 * @returns {string | undefined} The label.
 */
const httpStatusLabel = (rhinoError) => {
  if (rhinoError.httpStatus === undefined) return undefined
  return ['HTTP', rhinoError.httpStatus, rhinoError.httpStatusText].filter(Boolean).join(' ')
}

/**
 * The most specific message the error itself carries, preferring the wrapped original error.
 *
 * @param {RhinoErrorLike} rhinoError - The error returned by the rhino.fi SDK.
 * @returns {string | undefined} The message.
 */
const primaryMessage = (rhinoError) => {
  const nested = rhinoError.originalError
  return (isObject(nested) && (nested.message ?? nested._tag)) ||
    (typeof nested === 'string' ? nested : undefined) ||
    rhinoError.message ||
    rhinoError._tag ||
    (typeof rhinoError.error === 'string' ? rhinoError.error : undefined) ||
    (rhinoError.body != null ? String(rhinoError.body) : undefined)
}

/**
 * A cause frame's message, prefixed with its ERC-4337 `AAxx` code when it carries one.
 *
 * @param {Record<string, any>} cause - A frame of the `cause` chain.
 * @returns {string | undefined} The label.
 */
const causeLabel = (cause) => {
  const message = cause.message ?? cause._tag
  if (cause.aaCode && !String(message ?? '').includes(cause.aaCode)) {
    return message ? `${cause.aaCode} ${message}` : cause.aaCode
  }
  return message
}

/**
 * Distinct messages nested under the original error's `cause` chain, where the actionable
 * failure often sits below a generic wrapper.
 *
 * @param {RhinoErrorLike} rhinoError - The error returned by the rhino.fi SDK.
 * @param {string | undefined} primary - The already-extracted primary message, to dedupe against.
 * @returns {string[]} The distinct nested messages, outermost first.
 */
const causeMessages = (rhinoError, primary) => {
  const parts = []
  let cursor = isObject(rhinoError.originalError) ? rhinoError.originalError.cause : undefined
  let depth = 0
  while (isObject(cursor) && depth < MAX_CAUSE_DEPTH) {
    const part = causeLabel(cursor)
    if (part && part !== primary && !parts.includes(part)) parts.push(part)
    cursor = cursor.cause
    depth += 1
  }
  return parts
}

/**
 * The detail for codes without a dedicated description: the HTTP status, the error's own
 * message, and the distinct messages nested under `cause`.
 *
 * @param {RhinoErrorLike} rhinoError - The error returned by the rhino.fi SDK.
 * @returns {string | undefined} The detail.
 */
const fallbackDetail = (rhinoError) => {
  const primary = primaryMessage(rhinoError)
  return [httpStatusLabel(rhinoError), primary, ...causeMessages(rhinoError, primary)]
    .filter(Boolean)
    .join(': ') || undefined
}

/**
 * Derives a stable code and human-readable detail from a rhino.fi SDK error
 * (a `BridgeError`, or an API error carrying a `_tag`).
 *
 * @param {RhinoErrorLike} rhinoError - The error returned by the rhino.fi SDK.
 * @returns {RhinoErrorDescription} The extracted code and detail.
 */
const describeRhinoError = (rhinoError) => {
  if (!isObject(rhinoError)) return {}
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
      return { code, detail: fallbackDetail(rhinoError) }
  }
}

/**
 * Builds a {@link SwidgeExecutionError} from a rhino.fi SDK error, enriching the
 * message with the precise failure and attaching its `code`.
 *
 * @param {string} baseMessage - The context (what we were attempting).
 * @param {RhinoErrorLike} rhinoError - The error returned by the rhino.fi SDK.
 * @returns {SwidgeExecutionError} The enriched error.
 */
export const swidgeExecutionError = (baseMessage, rhinoError) => {
  const { code, detail } = describeRhinoError(rhinoError)
  const approvalTxHash = isObject(rhinoError) && typeof rhinoError.approvalTxHash === 'string'
    ? rhinoError.approvalTxHash
    : undefined
  const approvalNote = approvalTxHash && !detail?.includes(approvalTxHash)
    ? `approval transaction ${approvalTxHash} was already broadcast and its network fee may have been charged`
    : undefined
  const parts = [detail, approvalNote].filter(Boolean).join('; ')
  // The SDK's plain `{type, originalError}` wrapper breaks the standard `cause` chain —
  // chain the real Error instead; the wrapper's `type` already lands in `code`.
  const cause = isObject(rhinoError) && rhinoError.originalError instanceof Error
    ? rhinoError.originalError
    : rhinoError
  return new SwidgeExecutionError(parts ? `${baseMessage} (${parts}).` : baseMessage, {
    cause,
    code,
    ...(approvalTxHash ? { approvalTxHash } : {})
  })
}
