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

/**
 * Collects the constructor names along an object's prototype chain.
 *
 * @param {object | null | undefined} account - The wallet account.
 * @returns {Set<string>} The constructor names in the prototype chain.
 */
const constructorNames = (account) => {
  const names = new Set()
  let proto = account
  while (proto && proto !== Object.prototype) {
    const name = proto.constructor?.name
    if (name) names.add(name)
    proto = Object.getPrototypeOf(proto)
  }
  return names
}

const FULL_ACCOUNT_CLASS_NAMES = [
  'WalletAccountEvm',
  'WalletAccountEvmErc4337',
  'WalletAccountTron'
]

/**
 * Returns whether the account is a full (signing) account — i.e. an EVM,
 * ERC-4337 or Tron account, but not a read-only one.
 *
 * @param {object | null | undefined} account - The wallet account.
 * @returns {boolean} True if the account can sign and broadcast transactions.
 */
export const isFullAccount = (account) => {
  if (!account) return false
  const names = constructorNames(account)
  return FULL_ACCOUNT_CLASS_NAMES.some((name) => names.has(name))
}

/**
 * Returns whether the account is a Tron account (full or read-only). Both
 * variants extend `WalletAccountReadOnlyTron`.
 *
 * @param {object | null | undefined} account - The wallet account.
 * @returns {boolean} True if the account is a Tron wallet account.
 */
export const isTronAccount = (account) => {
  if (!account) return false
  return constructorNames(account).has('WalletAccountReadOnlyTron')
}
