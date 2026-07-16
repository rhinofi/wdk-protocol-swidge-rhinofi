export default class RhinofiProtocol extends SwidgeProtocol {
    /**
     * Creates a new rhinofi swidge protocol without binding it to a wallet account.
     *
     * @overload
     * @param {undefined} [account] - The wallet account to use to interact with the protocol.
     * @param {RhinofiProtocolConfig} config - The rhinofi protocol configuration.
     */
    constructor(account?: undefined, config: RhinofiProtocolConfig);
    /**
     * Creates a new read-only rhinofi swidge protocol.
     *
     * @overload
     * @param {WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337 | WalletAccountReadOnlyTron} account - The wallet account to use to interact with the protocol.
     * @param {RhinofiProtocolConfig} config - The rhinofi protocol configuration.
     */
    constructor(account: WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337 | WalletAccountReadOnlyTron, config: RhinofiProtocolConfig);
    /**
     * Creates a new rhinofi swidge protocol.
     *
     * @overload
     * @param {WalletAccountEvm | WalletAccountEvmErc4337 | WalletAccountTron} account - The wallet account to use to interact with the protocol.
     * @param {RhinofiProtocolConfig} config - The rhinofi protocol configuration.
     */
    constructor(account: WalletAccountEvm | WalletAccountEvmErc4337 | WalletAccountTron, config: RhinofiProtocolConfig);
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
     *
     * The returned quote carries the underlying rhino.fi quote on its `quote`
     * field. Pass that value back to {@link swidge} (as `config.quote`) to execute
     * against this exact quote instead of re-fetching — so the amounts quoted here
     * are the amounts that execute, even if the market moves in between. rhino.fi
     * quotes expire, so a stale quote will be rejected at execution; re-quote when
     * that happens. Callers that quote frequently (e.g. on every keystroke) should
     * throttle/debounce these calls themselves.
     *
     * @param {SwidgeOptions} options - The swidge options.
     * @returns {Promise<SwidgeQuote & { quote: object }>} The quoted swidge details, plus the raw rhino.fi quote to reuse.
     * @throws {RhinofiProtocolError} If the source chain cannot be determined from the account.
     * @throws {UnsupportedChainError} If the source or destination chain is unsupported.
     * @throws {UnsupportedTokenError} If a token is unsupported on its chain.
     * @throws {SwidgeExecutionError} If the rhino.fi quote request fails.
     */
    quoteSwidge(options: SwidgeOptions): Promise<SwidgeQuote & {
        quote: object;
    }>;
    /**
     * Executes a swidge operation. Submits the source-chain deposit (after any
     * required token approval) and returns as soon as the deposit transaction is
     * broadcast; use {@link getSwidgeStatus} to track the operation to completion.
     *
     * @param {SwidgeOptions} options - The swidge options.
     * @param {Pick<RhinofiProtocolConfig, 'maxNetworkFeeBps' | 'maxProtocolFeeBps'> & { quote?: object }} [config] - Optional per-call configuration (overrides constructor config). Pass `quote` (the `quote` field from a {@link quoteSwidge} result) to execute against that exact quote instead of re-fetching.
     * @returns {Promise<SwidgeResult>} The swidge execution result.
     * @throws {AccountRequiredError} If no account, or a read-only account, was given at construction.
     * @throws {RhinofiProtocolError} If the source chain cannot be determined from the account.
     * @throws {UnsupportedChainError} If the source or destination chain is unsupported.
     * @throws {UnsupportedTokenError} If a token is unsupported on its chain.
     * @throws {FeeLimitExceededError} If the quoted fees exceed the configured maximums.
     * @throws {SwidgeExecutionError} If the underlying rhino.fi operation fails.
     */
    swidge(options: SwidgeOptions, config?: Pick<RhinofiProtocolConfig, "maxNetworkFeeBps" | "maxProtocolFeeBps"> & {
        quote?: object;
    }): Promise<SwidgeResult>;
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
export type WalletAccountEvm = import("@tetherto/wdk-wallet-evm").WalletAccountEvm;
export type WalletAccountReadOnlyEvm = import("@tetherto/wdk-wallet-evm").WalletAccountReadOnlyEvm;
export type WalletAccountEvmErc4337 = import("@tetherto/wdk-wallet-evm-erc-4337").WalletAccountEvmErc4337;
export type WalletAccountReadOnlyEvmErc4337 = import("@tetherto/wdk-wallet-evm-erc-4337").WalletAccountReadOnlyEvmErc4337;
export type WalletAccountTron = import("@tetherto/wdk-wallet-tron").WalletAccountTron;
export type WalletAccountReadOnlyTron = import("@tetherto/wdk-wallet-tron").WalletAccountReadOnlyTron;
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
import { WalletAccountEvm } from '@tetherto/wdk-wallet-evm';
import { WalletAccountEvmErc4337 } from '@tetherto/wdk-wallet-evm-erc-4337';
import { WalletAccountTron } from '@tetherto/wdk-wallet-tron';
