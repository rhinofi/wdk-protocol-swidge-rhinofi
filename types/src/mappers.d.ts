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
export function resolveChain(config: BridgeConfig, chain: string | number): ChainEntry;
export function resolveToken(chainEntry: ChainConfig, token: string, chainLabel: string | number): TokenConfig;
export function mapSupportedChains(config: BridgeConfig): SwidgeSupportedChain[];
export function mapSupportedTokens(config: BridgeConfig, opts?: MapSupportedTokensOptions): SwidgeSupportedToken[];
export function mapFees(fees: RhinoQuoteFees | undefined, ctx: FeeContext): SwidgeFee[];
export function computeFeeBps(feeAmount: bigint, inputAmount: bigint): bigint;
export function mapQuote(quote: RhinoQuote, ctx: QuoteContext): SwidgeQuote;
export function mapStatusTransactions(data: BridgeStatusData, chains?: ChainScope): SwidgeTransaction[];
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
/**
 * A rhino.fi chain key paired with its bridge-config entry.
 */
export type ChainEntry = {
    /**
     * - The rhino chain key (e.g. 'ARBITRUM').
     */
    key: string;
    /**
     * - The chain's config entry.
     */
    entry: ChainConfig;
};
/**
 * A chain scope: the source and/or destination chain of an operation.
 */
export type ChainScope = {
    /**
     * - The source chain identifier (rhino key or network id).
     */
    fromChain?: string | number;
    /**
     * - The destination chain identifier (rhino key or network id).
     */
    toChain?: string | number;
};
/**
 * The input-token context a fee is denominated in.
 */
export type FeeContext = {
    /**
     * - The input token symbol (fee denomination).
     */
    token: string;
    /**
     * - The chain the fee is charged on.
     */
    chain: string | number;
    /**
     * - The input token's number of decimals.
     */
    decimals: number;
};
/**
 * The token/chain context used to map a rhino.fi quote into base-unit amounts.
 */
export type QuoteContext = {
    /**
     * - The source token symbol (fee denomination).
     */
    fromToken: string;
    /**
     * - The source token's number of decimals.
     */
    fromDecimals: number;
    /**
     * - The destination token's number of decimals.
     */
    toDecimals: number;
    /**
     * - The source chain identifier (fee chain).
     */
    fromChain: string | number;
};
/**
 * The options accepted by {@link mapSupportedTokens}.
 */
export type MapSupportedTokensOptions = {
    /**
     * - The rhino.fi swap-token config (a flat list, or keyed by chain).
     */
    swapTokens?: SwapTokenEntry[] | Record<string, SwapTokenEntry[]>;
    /**
     * - Chain scope; results are limited to `fromChain`, or `toChain` if `fromChain` is absent.
     */
    filter?: ChainScope;
};
