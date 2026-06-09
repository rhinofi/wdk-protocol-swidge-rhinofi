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
     * The rhino.fi SDK instance.
     *
     * @private
     */
    private _sdk;
    /**
     * How long (ms) to cache the rhino.fi config / swap-token lists.
     *
     * @private
     * @type {number}
     */
    private _configTtlMs;
    /**
     * TTL cache for the (rarely-changing) config fetches, keyed by fetch name.
     *
     * @private
     * @type {Map<string, { expiresAt: number, promise: Promise<unknown> }>}
     */
    private _cache;
    /**
     * Memoizes an async fetch for `configTtlMs`, so bursts of calls (e.g. quoting
     * on every keystroke) reuse one in-flight or recent result while staying fresh
     * within the window. Failures are not cached, so the next call retries.
     *
     * @private
     * @template T
     * @param {string} key - The cache key.
     * @param {() => Promise<T>} fetcher - The underlying fetch.
     * @returns {Promise<T>} The cached (or freshly fetched) result.
     */
    private _cached;
    /**
     * Awaits a rhino.fi SDK call, converting both transport rejections (network,
     * DNS, TLS) and `{ error }` results into a {@link SwidgeExecutionError}.
     *
     * @private
     * @template T
     * @param {Promise<{ data?: T, error?: unknown }>} promise - The SDK call.
     * @param {string} message - The contextual error message.
     * @returns {Promise<T | undefined>} The unwrapped result data.
     */
    private _call;
    /**
     * Fetches the rhino.fi bridge config (`/configs`). Fetched fresh each call so
     * newly added chains/tokens or updated contract addresses are picked up.
     *
     * @private
     * @returns {Promise<BridgeConfig>} The bridge config, keyed by chain.
     */
    private _getConfig;
    /**
     * Fetches the rhino.fi swap-token config. Returns an empty list if the endpoint
     * is unavailable, since swap tokens are supplementary to the bridge config.
     *
     * @private
     * @returns {Promise<SwapTokens>} The swap-token config entries.
     */
    private _getSwapTokens;
    /**
     * Ensures the protocol has a full (signing) account — one that can sign and
     * broadcast transactions via `sendTransaction`.
     *
     * @private
     * @param {string} operation - A description of the operation requiring the account.
     * @returns {IWalletAccount} The full wallet account.
     * @throws {AccountRequiredError} If the account is missing or read-only.
     */
    private _requireFullAccount;
    /**
     * Resolves the source/destination chains and tokens for a swidge operation.
     * The source chain is taken from the account (the WDK `SwidgeOptions` carry
     * only `toChain`), so the account must be connected to a provider.
     *
     * @private
     * @param {SwidgeOptions} options - The swidge options.
     * @returns {Promise<ResolvedRoute>} The resolved route.
     * @throws {RhinofiProtocolError} If the source chain cannot be determined from the account.
     */
    private _resolveRoute;
    /**
     * Determines the rhino.fi quote `amount` (decimal string) and `mode` from the
     * exact-in / exact-out options.
     *
     * @private
     * @param {SwidgeOptions} options - The swidge options.
     * @param {{ fromToken: TokenConfig, toToken: TokenConfig }} route - The resolved route.
     * @returns {{ amount: string, mode: 'pay' | 'receive' }} The quote amount and mode.
     */
    private _resolveAmount;
    /**
     * Builds the rhino.fi bridge data for a swidge operation.
     *
     * @private
     * @param {{ route: ResolvedRoute, amount: string, mode: 'pay' | 'receive', depositor: string, recipient: string, options: SwidgeOptions }} args - The build arguments.
     * @returns {BridgeData} The rhino.fi bridge data.
     */
    private _buildBridgeData;
    /**
     * Runs the approval (if needed) and deposit steps of a prepared bridge.
     *
     * @private
     * @param {Exclude<PrepareBridgeFunctionResult, { type: 'error' }>} prep - The (non-error) result of `prepareBridge`.
     * @param {(approvalTxHash: string) => void} onApproval - Called with the approval transaction hash when one is broadcast.
     * @returns {Promise<BridgeResult>} The bridge result (resolves only on full settlement).
     */
    private _runBridge;
    /**
     * Enforces the configured network/protocol fee limits against a quote.
     *
     * @private
     * @param {SwidgeFee[]} fees - The mapped fees.
     * @param {bigint} inputAmount - The input amount in base units.
     * @param {RhinofiProtocolConfig} config - The resolved configuration.
     * @throws {FeeLimitExceededError} If a fee exceeds its configured maximum.
     */
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
export type SwidgeFee = import("@tetherto/wdk-wallet/protocols").SwidgeFee;
export type SwidgeTransaction = import("@tetherto/wdk-wallet/protocols").SwidgeTransaction;
export type SwidgeExecutionError = import("./errors.js").SwidgeExecutionError;
export type UnsupportedChainError = import("./errors.js").UnsupportedChainError;
export type UnsupportedTokenError = import("./errors.js").UnsupportedTokenError;
export type BridgeConfig = import("@rhino.fi/sdk").BridgeConfig;
export type ChainConfig = import("@rhino.fi/sdk").ChainConfig;
export type TokenConfig = import("@rhino.fi/sdk").TokenConfig;
export type BridgeData = import("@rhino.fi/sdk").BridgeData;
export type BridgeResult = import("@rhino.fi/sdk").BridgeResult;
export type PrepareBridgeFunctionResult = import("@rhino.fi/sdk").PrepareBridgeFunctionResult;
export type SwapTokenEntry = import("./mappers.js").SwapTokenEntry;
export type SwapTokens = SwapTokenEntry[] | Record<string, SwapTokenEntry[]>;
export type ResolvedChain = {
    key: string;
    entry: ChainConfig;
};
export type ResolvedRoute = {
    config: BridgeConfig;
    from: ResolvedChain;
    to: ResolvedChain;
    fromToken: TokenConfig;
    toToken: TokenConfig;
};
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
