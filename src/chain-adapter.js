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

import { RhinofiProtocolError, UnsupportedChainError } from './errors.js'
import { isErc4337Account, isSolanaAccount, isTronAccount } from './account-type.js'
import { getEvmChainAdapterFromWdkAccount } from '@rhino.fi/sdk/adapters/evm-wdk'
import { getSolanaChainAdapterFromWdkAccount } from '@rhino.fi/sdk/adapters/solana-wdk'
import { getTronChainAdapterFromWdkAccount } from '@rhino.fi/sdk/adapters/tron-wdk'

/** @typedef {import('@tetherto/wdk-wallet-evm').WalletAccountEvm} WalletAccountEvm */
/** @typedef {import('@tetherto/wdk-wallet-evm').WalletAccountReadOnlyEvm} WalletAccountReadOnlyEvm */
/** @typedef {import('@tetherto/wdk-wallet-evm-erc-4337').WalletAccountEvmErc4337} WalletAccountEvmErc4337 */
/** @typedef {import('@tetherto/wdk-wallet-evm-erc-4337').WalletAccountReadOnlyEvmErc4337} WalletAccountReadOnlyEvmErc4337 */
/** @typedef {import('@tetherto/wdk-wallet-solana').WalletAccountSolana} WalletAccountSolana */
/** @typedef {import('@tetherto/wdk-wallet-solana').WalletAccountReadOnlySolana} WalletAccountReadOnlySolana */
/** @typedef {import('@tetherto/wdk-wallet-tron').WalletAccountTron} WalletAccountTron */
/** @typedef {import('@tetherto/wdk-wallet-tron').WalletAccountReadOnlyTron} WalletAccountReadOnlyTron */
/** @typedef {WalletAccountEvm | WalletAccountReadOnlyEvm | WalletAccountEvmErc4337 | WalletAccountReadOnlyEvmErc4337 | WalletAccountSolana | WalletAccountReadOnlySolana | WalletAccountTron | WalletAccountReadOnlyTron} SupportedAccount */
/** @typedef {import('@rhino.fi/sdk').ChainConfig} ChainConfig */
/** @typedef {import('@rhino.fi/sdk').ChainAdapter} ChainAdapter */

const TRON_CHAIN_KEY = 'TRON'
const SOLANA_CHAIN_KEY = 'SOLANA'

/**
 * Reads the chain the account is connected to, which is the source chain for a
 * swidge (the WDK `SwidgeOptions` carry only a destination `toChain`). The WDK
 * account interface exposes no network accessor, so this reads the client the
 * account signs with. EVM accounts expose an ethers provider (`getNetwork`);
 * ERC-4337 accounts expose an EIP-1193 provider (`request`) — the chain id is
 * read through whichever this is. Tron accounts sign through a `TronWeb` client
 * and Solana accounts through a Solana RPC client — neither has a chain id, so
 * their rhino chain key is returned when a client is connected.
 * An account without a connected client returns `null` (the caller then has no
 * source chain and must error).
 *
 * @internal
 * @param {SupportedAccount | undefined} account - The WDK wallet account.
 * @returns {Promise<number | string | null>} The source chain identifier (rhino `networkId`, or the tron/solana chain key), or `null` if not discoverable.
 * @throws {RhinofiProtocolError} If the account has a provider but reading its network fails (e.g. a connection error).
 */
export const getAccountNetworkId = async (account) => {
  if (isTronAccount(account)) {
    return account._tronWeb ? TRON_CHAIN_KEY : null
  }
  if (isSolanaAccount(account)) {
    return account._rpc ? SOLANA_CHAIN_KEY : null
  }
  const provider = account?._provider
  if (!provider) return null
  try {
    const chainId = typeof provider.getNetwork === 'function'
      ? (await provider.getNetwork()).chainId
      : await provider.request({ method: 'eth_chainId' })
    return Number(chainId)
  } catch (cause) {
    throw new RhinofiProtocolError('Failed to read the source chain from the wallet account provider.', { cause })
  }
}

/**
 * Reads the provider the account signs through, so the adapter can read chain state over the same
 * transport the integrator configured rather than the RPC in rhino.fi's chain config. EVM accounts
 * hold an ethers provider and ERC-4337 accounts an EIP-1193 one; the rhino.fi SDK accepts either.
 *
 * @internal
 * @param {SupportedAccount | undefined} account - The WDK wallet account.
 * @returns {unknown} The account's provider, or `undefined` if it exposes neither shape — in which case the SDK falls back to the chain config RPC.
 */
const getAccountProvider = (account) => {
  const provider = account?._provider
  if (!provider) return undefined
  const isUsable = typeof provider.getNetwork === 'function' ||
    typeof provider.request === 'function'
  return isUsable ? provider : undefined
}

/**
 * The token an ERC-4337 account pays gas in when it pays through a token paymaster, rather than
 * the chain's native token. The WDK keeps the paymaster setup on the account's wallet config,
 * read here the way the provider is. Sponsored and native-paying ERC-4337 accounts, and every
 * other account type, pay in the native token.
 *
 * @internal
 * @param {SupportedAccount | undefined} account - The WDK wallet account.
 * @returns {string | undefined} The paymaster token's address, or `undefined` when gas is paid in the native token.
 */
export const getAccountFeeTokenAddress = (account) => {
  if (!isErc4337Account(account)) return undefined
  const config = account._config
  if (!config || config.isSponsored || config.useNativeCoins) return undefined
  return config.paymasterToken?.address
}

/**
 * Builds a rhino.fi chain adapter for the source chain that signs through the WDK
 * account. The account is handed to the rhino.fi SDK's dedicated account-based
 * factory, which broadcasts via `account.sendTransaction` — keys never leave the
 * account. A read-only account works for the adapter's read-only members (balances,
 * fee quotes); only its signing members then fail.
 *
 * @internal
 * @param {SupportedAccount} account - The WDK wallet account (source-chain signer).
 * @param {ChainConfig} chainConfig - The rhino.fi chain config entry for the source chain.
 * @returns {ChainAdapter} The rhino.fi chain adapter.
 * @throws {UnsupportedChainError} If the source chain's ecosystem is not supported.
 */
export const getChainAdapterForAccount = (account, chainConfig) => {
  const type = String(chainConfig.type).toLowerCase()

  switch (type) {
    case 'evm': {
      const provider = getAccountProvider(account)
      return getEvmChainAdapterFromWdkAccount(account, chainConfig, {
        ...(provider ? { provider } : {})
      })
    }
    case 'sol': {
      return getSolanaChainAdapterFromWdkAccount(account, chainConfig)
    }
    case 'tron': {
      return getTronChainAdapterFromWdkAccount(account, chainConfig)
    }
    default:
      throw new UnsupportedChainError(`${chainConfig.name} (${type}) source chains are not yet supported`)
  }
}
