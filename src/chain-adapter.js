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

import { UnsupportedChainError } from './errors.js'

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */
/** @typedef {import('@tetherto/wdk-wallet').IWalletAccountReadOnly} IWalletAccountReadOnly */
/** @typedef {import('ethers').Provider} Provider */
/** @typedef {import('@rhino.fi/sdk').ChainConfig} ChainConfig */
/** @typedef {import('@rhino.fi/sdk').ChainAdapter} ChainAdapter */

/**
 * Reads the chain the account is connected to, which is the source chain for a
 * swidge (the WDK `SwidgeOptions` carry only a destination `toChain`). The
 * generic WDK account interface exposes no network accessor, so this reaches
 * into the EVM account's ethers provider — the same one it signs with. Other
 * ecosystems, and EVM accounts constructed without a provider, return
 * `undefined` (the caller then has no source chain and must error).
 *
 * @param {IWalletAccount | IWalletAccountReadOnly | undefined} account - The WDK wallet account.
 * @returns {Promise<number | undefined>} The connected chain id (rhino `networkId`), or `undefined` if not discoverable.
 */
export const getAccountNetworkId = async (account) => {
  const provider = /** @type {{ _provider?: Provider }} */ (account)?._provider
  if (!provider || typeof provider.getNetwork !== 'function') return undefined
  try {
    const { chainId } = await provider.getNetwork()
    return Number(chainId)
  } catch {
    return undefined
  }
}

/**
 * Builds a rhino.fi chain adapter for the source chain that signs through the WDK
 * account. The account is handed to the rhino.fi SDK's dedicated account-based
 * factory, which broadcasts via `account.sendTransaction` — keys never leave the
 * account. The per-ecosystem SDK adapter is imported lazily.
 *
 * @param {IWalletAccount} account - The WDK wallet account (source-chain signer).
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
    default:
      throw new UnsupportedChainError(`${chainConfig.name} (${type}) source chains are not yet supported`)
  }
}
