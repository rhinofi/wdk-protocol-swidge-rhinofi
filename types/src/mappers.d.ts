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
 * @typedef {object} RhinoQuoteFees
 * @property {string} [fee] - The total fee in token units (authoritative).
 * @property {number} [feeUsd] - The total fee in USD.
 * @property {string} [gasFee] - The destination-chain gas fee.
 * @property {string} [sourceGasFee] - The source-chain gas fee.
 */
/**
 * The subset of a rhino.fi quote response this module consumes. Both the public
 * quote (`getSwapPublicQuote`) and the user quote (`prepareBridge`) satisfy it.
 *
 * @typedef {object} RhinoQuote
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
 * @typedef {object} BridgeStatusData
 * @property {string} [depositTxHash] - The source-chain deposit transaction hash.
 * @property {string} [withdrawTxHash] - The destination-chain withdrawal hash.
 * @property {string} [refundTxHash] - The refund transaction hash, if refunded.
 */
/**
 * A rhino.fi swap-token config entry (the fields this module consumes).
 *
 * @typedef {object} SwapTokenEntry
 * @property {string} chain - The rhino chain key.
 * @property {string} symbol - The token symbol.
 * @property {number} decimals - The token's number of decimals.
 * @property {string} tokenAddress - The token's contract address.
 * @property {string} [name] - The token's display name.
 */
/**
 * Maps rhino.fi bridge `state` values to the canonical WDK {@link SwidgeStatus}.
 * Unknown states default to `pending` (still in flight) to stay forward-compatible.
 *
 * @type {Record<string, SwidgeStatus>}
 */
export const STATE_TO_STATUS: Record<string, SwidgeStatus>;
export function mapStateToStatus(state: string): SwidgeStatus;
export function toBigInt(value: number | bigint | string): bigint;
export function toBaseUnits(decimalString: string | number, decimals: number): bigint;
export function toDecimalString(amount: bigint | number, decimals: number): string;
export function resolveChain(config: BridgeConfig, chain: string | number): {
    key: string;
    entry: ChainConfig;
};
export function resolveToken(chainEntry: ChainConfig, token: string, chainLabel: string | number): TokenConfig;
export function mapSupportedChains(config: BridgeConfig): SwidgeSupportedChain[];
export function mapSupportedTokens(config: BridgeConfig, opts?: {
    swapTokens?: SwapTokenEntry[] | Record<string, SwapTokenEntry[]>;
    filter?: {
        fromChain?: string | number;
        toChain?: string | number;
    };
}): SwidgeSupportedToken[];
export function mapFees(fees: RhinoQuoteFees | undefined, { token, chain, decimals }: {
    token: string;
    chain: string | number;
    decimals: number;
}): SwidgeFee[];
export function computeFeeBps(feeAmount: bigint, inputAmount: bigint): bigint;
export function mapQuote(quote: RhinoQuote, { fromToken, fromDecimals, toDecimals, fromChain }: {
    fromToken: string;
    fromDecimals: number;
    toDecimals: number;
    fromChain: string | number;
}): SwidgeQuote;
export function mapStatusTransactions(data: BridgeStatusData, chains?: {
    fromChain?: string | number;
    toChain?: string | number;
}): SwidgeTransaction[];
export type SwidgeStatus = import("@tetherto/wdk-wallet/protocols").SwidgeStatus;
export type SwidgeFee = import("@tetherto/wdk-wallet/protocols").SwidgeFee;
export type SwidgeQuote = import("@tetherto/wdk-wallet/protocols").SwidgeQuote;
export type SwidgeTransaction = import("@tetherto/wdk-wallet/protocols").SwidgeTransaction;
export type SwidgeSupportedChain = import("@tetherto/wdk-wallet/protocols").SwidgeSupportedChain;
export type SwidgeSupportedToken = import("@tetherto/wdk-wallet/protocols").SwidgeSupportedToken;
export type BridgeConfig = import("@rhino.fi/sdk").BridgeConfig;
export type ChainConfig = import("@rhino.fi/sdk").ChainConfig;
export type TokenConfig = import("@rhino.fi/sdk").TokenConfig;
/**
 * The fee fields this module reads from a rhino.fi quote (amounts are decimal strings).
 */
export type RhinoQuoteFees = {
    /**
     * - The total fee in token units (authoritative).
     */
    fee?: string;
    /**
     * - The total fee in USD.
     */
    feeUsd?: number;
    /**
     * - The destination-chain gas fee.
     */
    gasFee?: string;
    /**
     * - The source-chain gas fee.
     */
    sourceGasFee?: string;
};
/**
 * The subset of a rhino.fi quote response this module consumes. Both the public
 * quote (`getSwapPublicQuote`) and the user quote (`prepareBridge`) satisfy it.
 */
export type RhinoQuote = {
    /**
     * - The input amount (decimal string).
     */
    payAmount: string;
    /**
     * - The output amount (decimal string).
     */
    receiveAmount: string;
    /**
     * - The guaranteed minimum output, when present.
     */
    minReceiveAmount?: string;
    /**
     * - The fee breakdown.
     */
    fees?: RhinoQuoteFees;
    /**
     * - The estimated duration in milliseconds.
     */
    estimatedDuration?: number;
    /**
     * - The USD value of the input.
     */
    payAmountUsd?: number;
    /**
     * - The USD value of the output.
     */
    receiveAmountUsd?: number;
};
/**
 * The transaction-hash fields this module reads from a rhino.fi bridge status.
 */
export type BridgeStatusData = {
    /**
     * - The source-chain deposit transaction hash.
     */
    depositTxHash?: string;
    /**
     * - The destination-chain withdrawal hash.
     */
    withdrawTxHash?: string;
    /**
     * - The refund transaction hash, if refunded.
     */
    refundTxHash?: string;
};
/**
 * A rhino.fi swap-token config entry (the fields this module consumes).
 */
export type SwapTokenEntry = {
    /**
     * - The rhino chain key.
     */
    chain: string;
    /**
     * - The token symbol.
     */
    symbol: string;
    /**
     * - The token's number of decimals.
     */
    decimals: number;
    /**
     * - The token's contract address.
     */
    tokenAddress: string;
    /**
     * - The token's display name.
     */
    name?: string;
};
