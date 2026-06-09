export function getAccountNetworkId(account: IWalletAccount | IWalletAccountReadOnly | undefined): Promise<number | undefined>;
export function getChainAdapterForAccount(account: IWalletAccount, chainConfig: ChainConfig): Promise<ChainAdapter>;
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
export type IWalletAccountReadOnly = import("@tetherto/wdk-wallet").IWalletAccountReadOnly;
export type Provider = import("ethers").Provider;
export type ChainConfig = import("@rhino.fi/sdk").ChainConfig;
export type ChainAdapter = import("@rhino.fi/sdk").ChainAdapter;
