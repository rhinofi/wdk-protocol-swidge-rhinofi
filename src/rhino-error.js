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
 * @property {{ _tag?: string }} [originalError] - A wrapped underlying error.
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
 * Derives a stable code and human-readable detail from a rhino.fi SDK error
 * (a `BridgeError`, or an API error carrying a `_tag`).
 *
 * @param {RhinoErrorLike} rhinoError - The error returned by the rhino.fi SDK.
 * @returns {RhinoErrorDescription} The extracted code and detail.
 */
const describeRhinoError = (rhinoError) => {
  if (!rhinoError || typeof rhinoError !== 'object') return {}
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
 * @param {RhinoErrorLike} rhinoError - The error returned by the rhino.fi SDK.
 * @returns {SwidgeExecutionError} The enriched error.
 */
export const swidgeExecutionError = (baseMessage, rhinoError) => {
  const { code, detail } = describeRhinoError(rhinoError)
  return new SwidgeExecutionError(detail ? `${baseMessage} (${detail}).` : baseMessage, { cause: rhinoError, code })
}
