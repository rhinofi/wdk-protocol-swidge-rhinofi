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
     * @param {WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337} account - The wallet account to use to interact with the protocol.
     * @param {RhinofiProtocolConfig} config - The rhinofi protocol configuration.
     */
    constructor(account: WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337, config: RhinofiProtocolConfig);
    /**
     * Creates a new rhinofi swidge protocol.
     *
     * @overload
     * @param {WalletAccountEvm | WalletAccountEvmErc4337} account - The wallet account to use to interact with the protocol.
     * @param {RhinofiProtocolConfig} config - The rhinofi protocol configuration.
     */
    constructor(account: WalletAccountEvm | WalletAccountEvmErc4337, config: RhinofiProtocolConfig);
    /** @private */
    private _sdk;
    /** @private */
    private _configTtlMs;
    /** @private */
    private _cache;
    /** @private */
    private _cached;
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
