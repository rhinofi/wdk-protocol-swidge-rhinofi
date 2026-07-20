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
import { isTronAccount } from './account-type.js'

/** @typedef {import('@tetherto/wdk-wallet-evm').WalletAccountEvm} WalletAccountEvm */
/** @typedef {import('@tetherto/wdk-wallet-evm').WalletAccountReadOnlyEvm} WalletAccountReadOnlyEvm */
/** @typedef {import('@tetherto/wdk-wallet-evm-erc-4337').WalletAccountEvmErc4337} WalletAccountEvmErc4337 */
/** @typedef {import('@tetherto/wdk-wallet-evm-erc-4337').WalletAccountReadOnlyEvmErc4337} WalletAccountReadOnlyEvmErc4337 */
/** @typedef {import('@tetherto/wdk-wallet-tron').WalletAccountTron} WalletAccountTron */
/** @typedef {import('@tetherto/wdk-wallet-tron').WalletAccountReadOnlyTron} WalletAccountReadOnlyTron */
/** @typedef {WalletAccountEvm | WalletAccountReadOnlyEvm | WalletAccountEvmErc4337 | WalletAccountReadOnlyEvmErc4337 | WalletAccountTron | WalletAccountReadOnlyTron} SupportedAccount */
/** @typedef {import('@rhino.fi/sdk').ChainConfig} ChainConfig */
/** @typedef {import('@rhino.fi/sdk').ChainAdapter} ChainAdapter */

const TRON_CHAIN_KEY = 'TRON'

/**
 * Reads the chain the account is connected to, which is the source chain for a
 * swidge (the WDK `SwidgeOptions` carry only a destination `toChain`). The WDK
 * account interface exposes no network accessor, so this reads the client the
 * account signs with. EVM accounts expose an ethers provider (`getNetwork`);
 * ERC-4337 accounts expose an EIP-1193 provider (`request`) — the chain id is
 * read through whichever this is. Tron accounts sign through a `TronWeb` client
 * and have no chain id, so the tron chain key is returned when one is connected.
 * An account without a connected client returns `null` (the caller then has no
 * source chain and must error).
 *
 * @internal
 * @param {SupportedAccount | undefined} account - The WDK wallet account.
 * @returns {Promise<number | string | null>} The source chain identifier (rhino `networkId`, or the tron chain key), or `null` if not discoverable.
 * @throws {RhinofiProtocolError} If the account has a provider but reading its network fails (e.g. a connection error).
 */
export const getAccountNetworkId = async (account) => {
  if (isTronAccount(account)) {
    return account._tronWeb ? TRON_CHAIN_KEY : null
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
 * Builds a rhino.fi chain adapter for the source chain that signs through the WDK
 * account. The account is handed to the rhino.fi SDK's dedicated account-based
 * factory, which broadcasts via `account.sendTransaction` — keys never leave the
 * account. The per-ecosystem SDK adapter is imported lazily.
 *
 * @internal
 * @param {WalletAccountEvm | WalletAccountEvmErc4337 | WalletAccountTron} account - The WDK wallet account (source-chain signer).
 * @param {ChainConfig} chainConfig - The rhino.fi chain config entry for the source chain.
 * @returns {Promise<ChainAdapter>} The rhino.fi chain adapter.
 * @throws {UnsupportedChainError} If the source chain's ecosystem is not supported.
 */
export const getChainAdapterForAccount = async (account, chainConfig) => {
  const type = String(chainConfig.type).toLowerCase()

  switch (type) {
    case 'evm': {
      const { getEvmChainAdapterFromWdkAccount } = await import('@rhino.fi/sdk/adapters/evm-wdk')
      return getEvmChainAdapterFromWdkAccount(account, chainConfig)
    }
    case 'tron': {
      const { getTronChainAdapterFromWdkAccount } = await import('@rhino.fi/sdk/adapters/tron-wdk')
      return getTronChainAdapterFromWdkAccount(account, chainConfig)
    }
    default:
      throw new UnsupportedChainError(`${chainConfig.name} (${type}) source chains are not yet supported`)
  }
}
