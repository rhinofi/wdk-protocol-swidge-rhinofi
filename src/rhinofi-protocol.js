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

import { SwidgeProtocol } from '@tetherto/wdk-wallet/protocols'
import { RhinoSdk } from '@rhino.fi/sdk'

import { getChainAdapterForAccount, getAccountNetworkId } from './chain-adapter.js'
import {
  RhinofiProtocolError,
  AccountRequiredError,
  ConfigurationError,
  FeeLimitExceededError,
  UnknownOperationError,
  swidgeExecutionError
} from './errors.js'
import {
  resolveChain,
  resolveToken,
  toBigInt,
  toDecimalString,
  mapQuote,
  computeFeeBps,
  mapStateToStatus,
  mapStatusTransactions,
  mapSupportedChains,
  mapSupportedTokens
} from './mappers.js'

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */
/** @typedef {import('@tetherto/wdk-wallet').IWalletAccountReadOnly} IWalletAccountReadOnly */

/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeOptions} SwidgeOptions */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeQuote} SwidgeQuote */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeResult} SwidgeResult */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeProtocolConfig} SwidgeProtocolConfig */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeStatusOptions} SwidgeStatusOptions */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeStatusResult} SwidgeStatusResult */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeSupportedChain} SwidgeSupportedChain */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeSupportedToken} SwidgeSupportedToken */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeSupportedTokensOptions} SwidgeSupportedTokensOptions */
/** @typedef {import('@tetherto/wdk-wallet/protocols').SwidgeTransaction} SwidgeTransaction */

/** @typedef {import('./errors.js').SwidgeExecutionError} SwidgeExecutionError */
/** @typedef {import('./errors.js').UnsupportedChainError} UnsupportedChainError */
/** @typedef {import('./errors.js').UnsupportedTokenError} UnsupportedTokenError */

/**
 * Unwraps a rhino.fi SDK `{ data, error }` result, throwing on error.
 *
 * @template T
 * @param {{ data?: T, error?: unknown }} result - The SDK result.
 * @param {string} message - The error message to use if the result is an error.
 * @returns {T | undefined} The result data.
 * @throws {SwidgeExecutionError} If the result is an error.
 */
const unwrap = (result, message) => {
  if (result && result.error) {
    throw swidgeExecutionError(message, result.error)
  }
  return result ? result.data : undefined
}

/**
 * The configuration accepted by {@link RhinofiProtocol}.
 *
 * @typedef {Object} RhinofiProtocolConfig
 * @property {string} apiKey - The rhino.fi API key. Required: the SDK authenticates every request (including quotes).
 * @property {string} [apiBaseUrl] - Override for the rhino.fi API base URL (defaults to mainnet). Any trailing slash is stripped, since the SDK appends its own paths.
 * @property {number | bigint} [maxNetworkFeeBps] - Maximum acceptable network fee in basis points of the input amount.
 * @property {number | bigint} [maxProtocolFeeBps] - Maximum acceptable protocol fee in basis points of the input amount.
 * @property {number} [configTtlMs] - How long (ms) to cache the rhino.fi config and swap-token lists. Bursts of calls within the window reuse one fetch. Defaults to 60000 (60s); set to 0 to always fetch fresh.
 */

const DEFAULT_CONFIG_TTL_MS = 60_000

export default class RhinofiProtocol extends SwidgeProtocol {
  /**
   * Creates a new rhinofi swidge protocol without binding it to a wallet account.
   *
   * @overload
   * @param {undefined} [account] - The wallet account to use to interact with the protocol.
   * @param {RhinofiProtocolConfig} [config] - The rhinofi protocol configuration.
   */

  /**
   * Creates a new read-only rhinofi swidge protocol.
   *
   * @overload
   * @param {IWalletAccountReadOnly} account - The wallet account to use to interact with the protocol.
   * @param {RhinofiProtocolConfig} [config] - The rhinofi protocol configuration.
   */

  /**
   * Creates a new rhinofi swidge protocol.
   *
   * @overload
   * @param {IWalletAccount} account - The wallet account to use to interact with the protocol.
   * @param {RhinofiProtocolConfig} [config] - The rhinofi protocol configuration.
   */
  constructor (account, config = {}) {
    super(account, config)

    /**
     * The rhinofi protocol configuration.
     *
     * @protected
     * @type {RhinofiProtocolConfig}
     */
    this._config = config

    if (!config.apiKey) {
      throw new ConfigurationError('A rhino.fi `apiKey` is required: the SDK authenticates every request (including quotes).')
    }

    /** @private */
    this._sdk = RhinoSdk({
      apiKey: config.apiKey,
      ...(config.apiBaseUrl ? { apiBaseUrl: config.apiBaseUrl.replace(/\/+$/, '') } : {})
    })

    /** @private */
    this._configTtlMs = config.configTtlMs ?? DEFAULT_CONFIG_TTL_MS

    /** @private */
    this._cache = new Map()
  }

  // Memoizes an async fetch for `configTtlMs`, so bursts of calls (e.g. quoting
  // on every keystroke) reuse one in-flight or recent result while staying fresh
  // within the window. Failures are not cached, so the next call retries.
  /** @private */
  _cached (key, fetcher) {
    const cached = this._cache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise
    }
    const promise = fetcher().catch((error) => {
      if (this._cache.get(key)?.promise === promise) this._cache.delete(key)
      throw error
    })
    this._cache.set(key, { expiresAt: Date.now() + this._configTtlMs, promise })
    return promise
  }

  /**
   * Quotes the estimated costs and output of a swidge operation.
   * Returns a non-binding quote; the actual execution is performed
   * by {@link swidge}.
   *
   * @param {SwidgeOptions} options - The swidge options.
   * @returns {Promise<SwidgeQuote>} The quoted swidge details.
   * @throws {RhinofiProtocolError} If the source chain cannot be determined from the account.
   * @throws {UnsupportedChainError} If the source or destination chain is unsupported.
   * @throws {UnsupportedTokenError} If a token is unsupported on its chain.
   * @throws {SwidgeExecutionError} If the rhino.fi quote request fails.
   */
  async quoteSwidge (options) {
    const route = await this._resolveRoute(options)
    const { amount, mode } = this._resolveAmount(options, route)

    const quote = await this._call(
      this._sdk.api.bridge.getSwapPublicQuote({
        chainIn: route.from.key,
        chainOut: route.to.key,
        tokenIn: route.fromToken.token,
        tokenOut: route.toToken.token,
        amount,
        mode
      }),
      'Failed to fetch a rhino.fi quote.'
    )

    return mapQuote(quote, {
      fromToken: route.fromToken.token,
      fromDecimals: route.fromToken.decimals,
      toDecimals: route.toToken.decimals,
      fromChain: route.from.key
    })
  }

  /**
   * Executes a swidge operation. Submits the source-chain deposit (after any
   * required token approval) and returns as soon as the deposit transaction is
   * broadcast; use {@link getSwidgeStatus} to track the operation to completion.
   *
   * @param {SwidgeOptions} options - The swidge options.
   * @param {SwidgeProtocolConfig} [config] - Optional per-call configuration (overrides constructor config).
   * @returns {Promise<SwidgeResult>} The swidge execution result.
   * @throws {AccountRequiredError} If no account, or a read-only account, was given at construction.
   * @throws {RhinofiProtocolError} If the source chain cannot be determined from the account.
   * @throws {UnsupportedChainError} If the source or destination chain is unsupported.
   * @throws {UnsupportedTokenError} If a token is unsupported on its chain.
   * @throws {FeeLimitExceededError} If the quoted fees exceed the configured maximums.
   * @throws {SwidgeExecutionError} If the underlying rhino.fi operation fails.
   */
  async swidge (options, config) {
    const account = this._requireFullAccount('execute a swidge')
    const route = await this._resolveRoute(options)
    const { amount, mode } = this._resolveAmount(options, route)

    const depositor = await account.getAddress()
    const recipient = options.recipient ?? depositor

    const bridgeData = this._buildBridgeData({ route, amount, mode, depositor, recipient, options })

    let depositTxHash
    let resolveDeposit
    const depositSubmitted = new Promise((resolve) => { resolveDeposit = resolve })
    const onBridgeStatusChange = (status) => {
      if (status && status.depositTxHash && resolveDeposit) {
        depositTxHash = status.depositTxHash
        resolveDeposit(status.depositTxHash)
        resolveDeposit = null
      }
    }

    const prep = await this._sdk.prepareBridge(bridgeData, {
      getChainAdapter: (chainConfig) => getChainAdapterForAccount(account, chainConfig),
      hooks: { onBridgeStatusChange },
      bridgeConfig: route.config
    })
    if (prep.type === 'error') {
      throw swidgeExecutionError('rhino.fi failed to prepare the swidge.', prep.error)
    }

    const mapped = mapQuote(prep.quote, {
      fromToken: route.fromToken.token,
      fromDecimals: route.fromToken.decimals,
      toDecimals: route.toToken.decimals,
      fromChain: route.from.key
    })
    const mergedConfig = { ...this._config, ...config }
    this._enforceFeeLimits(mapped.fees, mapped.fromTokenAmount, mergedConfig)

    let approvalTxHash
    let bridgeError
    this._runBridge(prep, (hash) => { approvalTxHash = hash })
      .then((bridgeResult) => { if (bridgeResult && bridgeResult.error) bridgeError = bridgeResult.error })
      .catch((error) => { bridgeError = error })
      .finally(() => {
        if (resolveDeposit) {
          resolveDeposit(null)
          resolveDeposit = null
        }
      })

    await depositSubmitted
    if (!depositTxHash) {
      throw swidgeExecutionError('rhino.fi did not submit a deposit for the swidge.', bridgeError)
    }

    /** @type {SwidgeTransaction[]} */
    const transactions = []
    if (approvalTxHash) {
      transactions.push({ hash: approvalTxHash, chain: route.from.key, type: 'approval' })
    }
    transactions.push({ hash: depositTxHash, chain: route.from.key, type: 'source' })

    /** @type {SwidgeResult} */
    return {
      id: prep.quote.quoteId,
      hash: depositTxHash,
      fees: mapped.fees,
      transactions,
      fromTokenAmount: mapped.fromTokenAmount,
      toTokenAmount: mapped.toTokenAmount,
      toTokenAmountMin: mapped.toTokenAmountMin
    }
  }

  /**
   * Retrieves the current status of an in-flight swidge.
   *
   * @param {string} id - The swidge execution identifier returned by swidge.
   * @param {SwidgeStatusOptions} [options] - Optional hints to assist provider lookups.
   * @returns {Promise<SwidgeStatusResult>} The current swidge status.
   * @throws {UnknownOperationError} If the id is invalid, or no swidge exists with the given identifier.
   * @throws {SwidgeExecutionError} If the rhino.fi status request fails.
   */
  async getSwidgeStatus (id, options = {}) {
    if (!id) throw new UnknownOperationError(id)

    let result
    try {
      result = await this._sdk.api.bridge.getBridgeStatus(id)
    } catch (error) {
      throw swidgeExecutionError('Failed to fetch the swidge status.', error)
    }
    if (result?.response?.status === 404) throw new UnknownOperationError(id)
    const data = unwrap(result, 'Failed to fetch the swidge status.')
    if (!data || !data.state) throw new UnknownOperationError(id)

    return {
      status: mapStateToStatus(data.state),
      transactions: mapStatusTransactions(data, {
        fromChain: options.fromChain,
        toChain: options.toChain
      })
    }
  }

  /**
   * Retrieves the chains supported by the provider for swidge operations.
   *
   * @returns {Promise<SwidgeSupportedChain[]>} The supported chains.
   */
  async getSupportedChains () {
    const config = await this._getConfig()
    return mapSupportedChains(config)
  }

  /**
   * Retrieves the tokens supported by the provider for swidge operations.
   *
   * Results are scoped to a single chain — `fromChain` if given, otherwise
   * `toChain`. This lists the tokens available per chain; it does not check
   * whether a specific token pair/route is supported (some are not). `fromToken`
   * is therefore not applied here — use {@link quoteSwidge} to validate a route,
   * which fails for an unsupported pair.
   *
   * @param {SwidgeSupportedTokensOptions} [options] - Optional chain scope (`fromChain`, or `toChain`).
   * @returns {Promise<SwidgeSupportedToken[]>} The supported tokens on the scoped chain (or every chain if unscoped).
   */
  async getSupportedTokens (options = {}) {
    const [config, swapTokens] = await Promise.all([
      this._getConfig(),
      this._getSwapTokens()
    ])
    return mapSupportedTokens(config, { swapTokens, filter: options })
  }

  // Awaits a rhino.fi SDK call, converting both transport rejections (network,
  // DNS, TLS) and `{ error }` results into a SwidgeExecutionError.
  /** @private */
  async _call (promise, message) {
    let result
    try {
      result = await promise
    } catch (error) {
      throw swidgeExecutionError(message, error)
    }
    return unwrap(result, message)
  }

  /** @private */
  async _getConfig () {
    return this._cached('config', () =>
      this._call(this._sdk.api.bridge.getBridgeConfig(), 'Failed to fetch the rhino.fi bridge config.')
    )
  }

  // Returns an empty list if the endpoint is unavailable, since swap tokens
  // are supplementary to the bridge config.
  /** @private */
  async _getSwapTokens () {
    try {
      const swapTokens = await this._cached('swapTokens', () =>
        this._call(this._sdk.api.bridge.getSwapTokensConfig(), 'Failed to fetch the rhino.fi swap-token config.')
      )
      return swapTokens ?? []
    } catch {
      return []
    }
  }

  /** @private */
  _requireFullAccount (operation) {
    const account = /** @type {IWalletAccount | undefined} */ (this._account)
    if (!account || typeof account.sendTransaction !== 'function') {
      throw new AccountRequiredError(operation)
    }
    return account
  }

  // The source chain is taken from the account (the WDK `SwidgeOptions` carry
  // only `toChain`), so the account must be connected to a provider.
  /** @private */
  async _resolveRoute (options) {
    const config = await this._getConfig()
    const networkId = await getAccountNetworkId(this._account)
    if (networkId === undefined) {
      throw new RhinofiProtocolError('The source chain could not be determined from the account. Connect the wallet account to a provider for its source chain.')
    }
    const from = resolveChain(config, networkId)
    const to = options.toChain != null
      ? resolveChain(config, options.toChain)
      : from
    const fromToken = resolveToken(from.entry, options.fromToken, from.key)
    const toToken = resolveToken(to.entry, options.toToken, to.key)
    return { config, from, to, fromToken, toToken }
  }

  // Determines the rhino.fi quote `amount` (decimal string) and `mode` from
  // the exact-in / exact-out options.
  /** @private */
  _resolveAmount (options, route) {
    const hasIn = options.fromTokenAmount != null
    const hasOut = options.toTokenAmount != null
    if (!hasIn && !hasOut) {
      throw new RhinofiProtocolError('Either fromTokenAmount (exact-in) or toTokenAmount (exact-out) must be provided.')
    }
    if (hasIn && hasOut) {
      throw new RhinofiProtocolError('Provide either fromTokenAmount (exact-in) or toTokenAmount (exact-out), not both.')
    }
    const mode = hasOut ? 'receive' : 'pay'
    const token = hasOut ? route.toToken : route.fromToken
    const amountBase = toBigInt(hasOut ? options.toTokenAmount : options.fromTokenAmount)
    return { amount: toDecimalString(amountBase, token.decimals), mode }
  }

  /** @private */
  _buildBridgeData ({ route, amount, mode, depositor, recipient, options }) {
    const base = {
      chainIn: route.from.key,
      chainOut: route.to.key,
      amount,
      depositor,
      recipient,
      mode
    }
    if (route.fromToken.token === route.toToken.token) {
      return { type: 'bridge', token: route.fromToken.token, ...base }
    }
    return {
      type: 'bridgeSwap',
      tokenIn: route.fromToken.token,
      tokenOut: route.toToken.token,
      ...base,
      ...(options.refundAddress ? { refundAddress: options.refundAddress } : {})
    }
  }

  // Runs the approval (if needed) and deposit steps of a prepared bridge.
  // Resolves only on full settlement.
  /** @private */
  async _runBridge (prep, onApproval) {
    if (prep.type === 'approval-needed') {
      const approveResult = await prep.approve()
      if (approveResult.type !== 'success') {
        throw swidgeExecutionError('rhino.fi token approval failed.', approveResult.error)
      }
      const { approvalTxHash } = /** @type {{ approvalTxHash?: string }} */ (approveResult)
      if (approvalTxHash) onApproval(approvalTxHash)
      return approveResult.bridge()
    }
    return prep.bridge()
  }

  /** @private */
  _enforceFeeLimits (fees, inputAmount, config) {
    const sumByType = (type) =>
      fees.filter((fee) => fee.type === type).reduce((sum, fee) => sum + fee.amount, 0n)

    if (config.maxNetworkFeeBps != null) {
      const bps = computeFeeBps(sumByType('network'), inputAmount)
      const max = BigInt(config.maxNetworkFeeBps)
      if (bps > max) throw new FeeLimitExceededError('network', bps, max)
    }
    if (config.maxProtocolFeeBps != null) {
      const bps = computeFeeBps(sumByType('protocol'), inputAmount)
      const max = BigInt(config.maxProtocolFeeBps)
      if (bps > max) throw new FeeLimitExceededError('protocol', bps, max)
    }
  }
}
