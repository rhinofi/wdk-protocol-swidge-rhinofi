export default class RhinofiProtocol extends SwidgeProtocol {
    /**
     * Creates a new rhinofi swidge protocol without binding it to a wallet account.
     *
     * @overload
     * @param {undefined} [account] - The wallet account to use to interact with the protocol.
     * @param {RhinofiProtocolConfig} [config] - The rhinofi protocol configuration.
     */
    constructor(account?: undefined, config?: RhinofiProtocolConfig);
    /**
     * Creates a new read-only rhinofi swidge protocol.
     *
     * @overload
     * @param {IWalletAccountReadOnly} account - The wallet account to use to interact with the protocol.
     * @param {RhinofiProtocolConfig} [config] - The rhinofi protocol configuration.
     */
    constructor(account: IWalletAccountReadOnly, config?: RhinofiProtocolConfig);
    /**
     * Creates a new rhinofi swidge protocol.
     *
     * @overload
     * @param {IWalletAccount} account - The wallet account to use to interact with the protocol.
     * @param {RhinofiProtocolConfig} [config] - The rhinofi protocol configuration.
     */
    constructor(account: IWalletAccount, config?: RhinofiProtocolConfig);
    /**
     * The rhinofi protocol configuration.
     *
     * @protected
     * @type {RhinofiProtocolConfig}
     */
    protected _config: RhinofiProtocolConfig;
    /** @private */
    private _sdk;
    /** @private */
    private _configTtlMs;
    /** @private */
    private _cache;
    /** @private */
    private _cached;
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
    quoteSwidge(options: SwidgeOptions): Promise<SwidgeQuote>;
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
    swidge(options: SwidgeOptions, config?: SwidgeProtocolConfig): Promise<SwidgeResult>;
    /**
     * Retrieves the current status of an in-flight swidge.
     *
     * @param {string} id - The swidge execution identifier returned by swidge.
     * @param {SwidgeStatusOptions} [options] - Optional hints to assist provider lookups.
     * @returns {Promise<SwidgeStatusResult>} The current swidge status.
     * @throws {UnknownOperationError} If the id is invalid, or no swidge exists with the given identifier.
     * @throws {SwidgeExecutionError} If the rhino.fi status request fails.
     */
    getSwidgeStatus(id: string, options?: SwidgeStatusOptions): Promise<SwidgeStatusResult>;
    /**
     * Retrieves the chains supported by the provider for swidge operations.
     *
     * @returns {Promise<SwidgeSupportedChain[]>} The supported chains.
     */
    getSupportedChains(): Promise<SwidgeSupportedChain[]>;
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
    getSupportedTokens(options?: SwidgeSupportedTokensOptions): Promise<SwidgeSupportedToken[]>;
    /** @private */
    private _call;
    /** @private */
    private _getConfig;
    /** @private */
    private _getSwapTokens;
    /** @private */
    private _requireFullAccount;
    /** @private */
    private _resolveRoute;
    /** @private */
    private _resolveAmount;
    /** @private */
    private _buildBridgeData;
    /** @private */
    private _runBridge;
    /** @private */
    private _enforceFeeLimits;
}
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
export type IWalletAccountReadOnly = import("@tetherto/wdk-wallet").IWalletAccountReadOnly;
export type SwidgeOptions = import("@tetherto/wdk-wallet/protocols").SwidgeOptions;
export type SwidgeQuote = import("@tetherto/wdk-wallet/protocols").SwidgeQuote;
export type SwidgeResult = import("@tetherto/wdk-wallet/protocols").SwidgeResult;
export type SwidgeProtocolConfig = import("@tetherto/wdk-wallet/protocols").SwidgeProtocolConfig;
export type SwidgeStatusOptions = import("@tetherto/wdk-wallet/protocols").SwidgeStatusOptions;
export type SwidgeStatusResult = import("@tetherto/wdk-wallet/protocols").SwidgeStatusResult;
export type SwidgeSupportedChain = import("@tetherto/wdk-wallet/protocols").SwidgeSupportedChain;
export type SwidgeSupportedToken = import("@tetherto/wdk-wallet/protocols").SwidgeSupportedToken;
export type SwidgeSupportedTokensOptions = import("@tetherto/wdk-wallet/protocols").SwidgeSupportedTokensOptions;
export type SwidgeTransaction = import("@tetherto/wdk-wallet/protocols").SwidgeTransaction;
export type SwidgeExecutionError = import("./errors.js").SwidgeExecutionError;
export type UnsupportedChainError = import("./errors.js").UnsupportedChainError;
export type UnsupportedTokenError = import("./errors.js").UnsupportedTokenError;
/**
 * The configuration accepted by {@link RhinofiProtocol}.
 */
export type RhinofiProtocolConfig = {
    /**
     * - The rhino.fi API key. Required: the SDK authenticates every request (including quotes).
     */
    apiKey: string;
    /**
     * - Override for the rhino.fi API base URL (defaults to mainnet). Any trailing slash is stripped, since the SDK appends its own paths.
     */
    apiBaseUrl?: string;
    /**
     * - Maximum acceptable network fee in basis points of the input amount.
     */
    maxNetworkFeeBps?: number | bigint;
    /**
     * - Maximum acceptable protocol fee in basis points of the input amount.
     */
    maxProtocolFeeBps?: number | bigint;
    /**
     * - How long (ms) to cache the rhino.fi config and swap-token lists. Bursts of calls within the window reuse one fetch. Defaults to 60000 (60s); set to 0 to always fetch fresh.
     */
    configTtlMs?: number;
};
import { SwidgeProtocol } from '@tetherto/wdk-wallet/protocols';
