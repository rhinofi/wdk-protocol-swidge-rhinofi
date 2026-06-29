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

import { Decimal as BaseDecimal } from 'decimal.js'
import { UnsupportedChainError, UnsupportedTokenError } from './errors.js'

const Decimal = BaseDecimal.clone({ precision: 60 })

const MIN_PRICE_IMPACT = 1e-9

/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeStatus} SwidgeStatus */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeFee} SwidgeFee */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeQuote} SwidgeQuote */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeTransaction} SwidgeTransaction */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeSupportedChain} SwidgeSupportedChain */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeSupportedToken} SwidgeSupportedToken */

/** @typedef {import('@rhino.fi/sdk').BridgeConfig} BridgeConfig */
/** @typedef {import('@rhino.fi/sdk').ChainConfig} ChainConfig */
/** @typedef {import('@rhino.fi/sdk').TokenConfig} TokenConfig */

/**
 * The fee fields this module reads from a rhino.fi quote (amounts are decimal strings).
 *
 * @typedef {Object} RhinoQuoteFees
 * @property {string} [fee] - The total fee in token units (authoritative).
 * @property {number} [feeUsd] - The total fee in USD.
 * @property {string} [gasFee] - The destination-chain gas fee.
 * @property {string} [sourceGasFee] - The source-chain gas fee.
 */

/**
 * The subset of a rhino.fi quote response this module consumes. Both the public
 * quote (`getSwapPublicQuote`) and the user quote (`prepareBridge`) satisfy it.
 *
 * @typedef {Object} RhinoQuote
 * @property {string} payAmount - The input amount (decimal string).
 * @property {string} receiveAmount - The output amount (decimal string).
 * @property {string} [minReceiveAmount] - The guaranteed minimum output, when present.
 * @property {RhinoQuoteFees} [fees] - The fee breakdown.
 * @property {number} [estimatedDuration] - The estimated duration in milliseconds.
 * @property {number} [payAmountUsd] - The USD value of the input.
 * @property {number} [receiveAmountUsd] - The USD value of the output.
 */

/**
 * The transaction-hash fields this module reads from a rhino.fi bridge status.
 *
 * @typedef {Object} BridgeStatusData
 * @property {string} [depositTxHash] - The source-chain deposit transaction hash.
 * @property {string} [withdrawTxHash] - The destination-chain withdrawal hash.
 * @property {string} [refundTxHash] - The refund transaction hash, if refunded.
 */

/**
 * A rhino.fi swap-token config entry (the fields this module consumes).
 *
 * @typedef {Object} SwapTokenEntry
 * @property {string} chain - The rhino chain key.
 * @property {string} symbol - The token symbol.
 * @property {number} decimals - The token's number of decimals.
 * @property {string} tokenAddress - The token's contract address.
 * @property {string} [name] - The token's display name.
 */

/**
 * A rhino.fi chain key paired with its bridge-config entry.
 *
 * @typedef {Object} ChainEntry
 * @property {string} key - The rhino chain key (e.g. 'ARBITRUM').
 * @property {ChainConfig} entry - The chain's config entry.
 */

/**
 * A chain scope: the source and/or destination chain of an operation.
 *
 * @typedef {Object} ChainScope
 * @property {string | number} [fromChain] - The source chain identifier (rhino key or network id).
 * @property {string | number} [toChain] - The destination chain identifier (rhino key or network id).
 */

/**
 * The input-token context a fee is denominated in.
 *
 * @typedef {Object} FeeContext
 * @property {string} token - The input token symbol (fee denomination).
 * @property {string | number} chain - The chain the fee is charged on.
 * @property {number} decimals - The input token's number of decimals.
 */

/**
 * The token/chain context used to map a rhino.fi quote into base-unit amounts.
 *
 * @typedef {Object} QuoteContext
 * @property {string} fromToken - The source token symbol (fee denomination).
 * @property {number} fromDecimals - The source token's number of decimals.
 * @property {number} toDecimals - The destination token's number of decimals.
 * @property {string | number} fromChain - The source chain identifier (fee chain).
 */

/**
 * The options accepted by {@link mapSupportedTokens}.
 *
 * @typedef {Object} MapSupportedTokensOptions
 * @property {SwapTokenEntry[] | Record<string, SwapTokenEntry[]>} [swapTokens] - The rhino.fi swap-token config (a flat list, or keyed by chain).
 * @property {ChainScope} [filter] - Chain scope; results are limited to `fromChain`, or `toChain` if `fromChain` is absent.
 */

/**
 * Maps rhino.fi bridge `state` values to the canonical WDK {@link SwidgeStatus}.
 * Unknown states default to `pending` (still in flight) to stay forward-compatible.
 *
 * @type {Record<string, SwidgeStatus>}
 */
export const STATE_TO_STATUS = {
  PENDING: 'pending',
  PENDING_CONFIRMATION: 'pending',
  DEPOSIT_ACCEPTED: 'pending',
  ACCEPTED: 'pending',
  EXECUTED: 'completed',
  SWAP_FAILED: 'refund-pending',
  SWAP_FAILED_REFUNDED: 'refunded',
  DEPOSIT_RECEIVED_AFTER_GRACE_PERIOD: 'action-required',
  DEPOSIT_RECEIVED_AFTER_GRACE_PERIOD_REFUNDED: 'refunded',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

/**
 * Maps a rhino.fi bridge state to a {@link SwidgeStatus}.
 *
 * @param {string} state - The rhino.fi bridge state.
 * @returns {SwidgeStatus} The canonical swidge status.
 */
export const mapStateToStatus = (state) => STATE_TO_STATUS[state] ?? 'pending'

/**
 * Coerces a `number | bigint | string` amount into a `bigint` of base units.
 *
 * @param {number | bigint | string} value - The amount in base units.
 * @returns {bigint} The amount as a bigint.
 * @throws {RangeError} If a number amount is not an integer.
 */
export const toBigInt = (value) => BigInt(value)

/**
 * Converts a human-readable decimal string (rhino.fi wire format) into base units.
 *
 * @param {string | number} decimalString - The amount in human units (e.g. "1.5").
 * @param {number} decimals - The token's number of decimals.
 * @returns {bigint} The amount in base units.
 */
export const toBaseUnits = (decimalString, decimals) =>
  BigInt(new Decimal(decimalString).mul(new Decimal(10).pow(decimals)).toFixed(0))

/**
 * Converts a base-unit amount into a human-readable decimal string (rhino.fi wire format).
 *
 * @param {bigint | number} amount - The amount in base units.
 * @param {number} decimals - The token's number of decimals.
 * @returns {string} The amount as a decimal string.
 */
export const toDecimalString = (amount, decimals) =>
  new Decimal(amount.toString()).div(new Decimal(10).pow(decimals)).toFixed()

/**
 * Resolves a chain identifier (rhino chain key, networkId, or numeric chain id)
 * against the rhino.fi bridge config.
 *
 * @param {BridgeConfig} config - The rhino.fi `/configs` response.
 * @param {string | number} chain - The chain identifier to resolve.
 * @returns {ChainEntry} The matched chain key and config entry.
 * @throws {UnsupportedChainError} If the chain cannot be resolved.
 */
export const resolveChain = (config, chain) => {
  if (chain == null) throw new UnsupportedChainError(chain)
  const asString = String(chain)
  const keys = Object.keys(config)
  const key =
    keys.find(candidate => candidate.toLowerCase() === asString.toLowerCase()) ??
    keys.find(candidate => config[candidate].networkId === asString)
  if (!key) throw new UnsupportedChainError(chain)
  return { key, entry: config[key] }
}

/**
 * Resolves a token identifier (rhino symbol or contract address) against a
 * chain's config entry.
 *
 * @param {ChainConfig} chainEntry - A rhino.fi chain config entry (with a `tokens` map).
 * @param {string} token - The token symbol or address to resolve.
 * @param {string | number} chainLabel - The chain identifier, for error messages.
 * @returns {TokenConfig} The token entry.
 * @throws {UnsupportedTokenError} If the token cannot be resolved.
 */
export const resolveToken = (chainEntry, token, chainLabel) => {
  const tokens = chainEntry?.tokens ?? {}
  if (!token) throw new UnsupportedTokenError(token, chainLabel)
  const asLower = String(token).toLowerCase()
  const entry =
    tokens[token] ??
    tokens[String(token).toUpperCase()] ??
    Object.values(tokens).find(
      (candidate) => candidate.token?.toLowerCase() === asLower || candidate.address?.toLowerCase() === asLower
    )
  if (!entry) throw new UnsupportedTokenError(token, chainLabel)
  return entry
}

/**
 * Maps the rhino.fi `/configs` response to the list of supported chains.
 *
 * @param {BridgeConfig} config - The rhino.fi `/configs` response.
 * @returns {SwidgeSupportedChain[]} The supported chains.
 */
export const mapSupportedChains = (config) =>
  Object.entries(config)
    .filter(([, entry]) => entry.status === 'enabled')
    .map(([key, entry]) => ({
      id: key,
      name: entry.name,
      type: String(entry.type).toLowerCase(),
      nativeToken: entry.nativeTokenName
    }))

/**
 * Maps the rhino.fi config (and optional swap-token config) to the list of
 * supported tokens, optionally filtered to a route.
 *
 * @param {BridgeConfig} config - The rhino.fi `/configs` response.
 * @param {MapSupportedTokensOptions} [opts] - The swap-token config and chain-scope filter.
 * @returns {SwidgeSupportedToken[]} The supported tokens (on the scoped chain, or every chain if unscoped).
 */
export const mapSupportedTokens = (config, opts = {}) => {
  const { swapTokens = [], filter = {} } = opts
  /** @type {SwidgeSupportedToken[]} */
  const tokens = []
  const seen = new Set()

  const push = (chainKey, token) => {
    const key = `${chainKey}:${String(token.address ?? token.symbol).toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    tokens.push(token)
  }

  for (const [chainKey, entry] of Object.entries(config)) {
    if (entry.status !== 'enabled') continue
    for (const token of Object.values(entry.tokens ?? {})) {
      push(chainKey, {
        token: token.token,
        chain: chainKey,
        symbol: token.token,
        decimals: token.decimals,
        address: token.address
      })
    }
  }

  const swapTokenList = Array.isArray(swapTokens)
    ? swapTokens
    : Object.values(swapTokens || {}).flat()
  for (const token of swapTokenList) {
    if (!token?.chain) continue
    push(token.chain, {
      token: token.symbol,
      chain: token.chain,
      symbol: token.symbol,
      decimals: token.decimals,
      address: token.tokenAddress,
      ...(token.name ? { name: token.name } : {})
    })
  }

  const scope = filter.fromChain ?? filter.toChain
  if (scope === undefined) return tokens
  let scopeKey
  try {
    scopeKey = resolveChain(config, scope).key
  } catch {
    return []
  }
  return tokens.filter((token) => token.chain === scopeKey)
}

/**
 * Maps a rhino.fi quote fee breakdown to itemised {@link SwidgeFee} entries,
 * denominated in the input token. Network is gas (`gasFee` + `sourceGasFee`),
 * protocol is the rest of the total (`fee` − gas).
 *
 * @param {RhinoQuoteFees | undefined} fees - The `fees` object from a rhino.fi quote response.
 * @param {FeeContext} ctx - The input-token context the fees are denominated in.
 * @returns {SwidgeFee[]} The itemised fees (always at least the network fee).
 */
export const mapFees = (fees, { token, chain, decimals }) => {
  const network = new Decimal(fees?.gasFee ?? '0').add(fees?.sourceGasFee ?? '0')
  const total = new Decimal(fees?.fee ?? '0')
  const protocol = total.sub(network)

  /** @type {SwidgeFee[]} */
  const result = [
    {
      type: 'network',
      amount: toBaseUnits(network.toFixed(), decimals),
      token,
      chain,
      included: true,
      description: 'Network/gas fee'
    }
  ]
  if (protocol.gt(0)) {
    result.push({
      type: 'protocol',
      amount: toBaseUnits(protocol.toFixed(), decimals),
      token,
      chain,
      included: true,
      description: 'rhino.fi protocol fee'
    })
  }
  return result
}

/**
 * Computes a fee in basis points of the input amount.
 *
 * @param {bigint} feeAmount - The fee in base units of the input token.
 * @param {bigint} inputAmount - The input amount in base units of the input token.
 * @returns {bigint} The fee in basis points (bps).
 */
export const computeFeeBps = (feeAmount, inputAmount) =>
  inputAmount > 0n ? (feeAmount * 10000n) / inputAmount : 0n

/**
 * Maps a rhino.fi public/user quote response to a {@link SwidgeQuote}.
 *
 * @param {RhinoQuote} quote - The rhino.fi quote response.
 * @param {QuoteContext} ctx - The token/chain context for base-unit conversion.
 * @returns {SwidgeQuote} The mapped quote.
 */
export const mapQuote = (quote, { fromToken, fromDecimals, toDecimals, fromChain }) => {
  const fromTokenAmount = toBaseUnits(quote.payAmount, fromDecimals)
  const toTokenAmount = toBaseUnits(quote.receiveAmount, toDecimals)

  const toTokenAmountMin = quote.minReceiveAmount != null
    ? toBaseUnits(quote.minReceiveAmount, toDecimals)
    : toTokenAmount

  /** @type {SwidgeQuote} */
  const result = {
    fromTokenAmount,
    toTokenAmount,
    toTokenAmountMin,
    fees: mapFees(quote.fees, { token: fromToken, chain: fromChain, decimals: fromDecimals })
  }

  if (typeof quote.estimatedDuration === 'number') {
    result.estimatedDuration = Math.round(quote.estimatedDuration / 1000)
  }
  if (typeof quote.payAmountUsd === 'number' && typeof quote.receiveAmountUsd === 'number' && quote.payAmountUsd > 0) {
    const feeUsd = typeof quote.fees?.feeUsd === 'number' ? quote.fees.feeUsd : 0
    const impact = (quote.payAmountUsd - quote.receiveAmountUsd - feeUsd) / quote.payAmountUsd
    if (impact > MIN_PRICE_IMPACT) result.priceImpact = impact
  }
  return result
}

/**
 * Builds the {@link SwidgeTransaction} list from a rhino.fi bridge status `data`.
 *
 * @param {BridgeStatusData} data - The rhino.fi bridge status `data`.
 * @param {ChainScope} [chains] - Chain hints used to label the transactions.
 * @returns {SwidgeTransaction[]} The associated transactions.
 */
export const mapStatusTransactions = (data, chains = {}) => {
  const { fromChain, toChain } = chains
  /** @type {SwidgeTransaction[]} */
  const transactions = []
  if (data?.depositTxHash) {
    transactions.push({ hash: data.depositTxHash, type: 'source', ...(fromChain != null ? { chain: fromChain } : {}) })
  }
  if (data?.withdrawTxHash) {
    transactions.push({ hash: data.withdrawTxHash, type: 'destination', ...(toChain != null ? { chain: toChain } : {}) })
  }
  if (data?.refundTxHash) {
    transactions.push({ hash: data.refundTxHash, type: 'refund', ...(fromChain != null ? { chain: fromChain } : {}) })
  }
  return transactions
}
