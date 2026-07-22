import { describe, expect, it } from '@jest/globals'
import { WalletAccountEvm, WalletAccountReadOnlyEvm } from '@tetherto/wdk-wallet-evm'
import { WalletAccountEvmErc4337, WalletAccountReadOnlyEvmErc4337 } from '@tetherto/wdk-wallet-evm-erc-4337'
import { WalletAccountTron, WalletAccountReadOnlyTron } from '@tetherto/wdk-wallet-tron'

import { isFullAccount, isTronAccount } from '../src/account-type.js'

const onPrototype = (Class) => Object.create(Class.prototype)

describe('account-type', () => {
  describe('isFullAccount', () => {
    it('accepts full (signing) accounts of every ecosystem', () => {
      expect(isFullAccount(onPrototype(WalletAccountEvm))).toBe(true)
      expect(isFullAccount(onPrototype(WalletAccountEvmErc4337))).toBe(true)
      expect(isFullAccount(onPrototype(WalletAccountTron))).toBe(true)
    })

    it('rejects read-only accounts of every ecosystem', () => {
      expect(isFullAccount(onPrototype(WalletAccountReadOnlyEvm))).toBe(false)
      expect(isFullAccount(onPrototype(WalletAccountReadOnlyEvmErc4337))).toBe(false)
      expect(isFullAccount(onPrototype(WalletAccountReadOnlyTron))).toBe(false)
    })

    it('rejects missing accounts', () => {
      expect(isFullAccount(undefined)).toBe(false)
      expect(isFullAccount(null)).toBe(false)
    })

    it('detects a full account from a different module copy (fails instanceof)', () => {
      class WalletAccountTron { }
      const foreign = new WalletAccountTron()

      expect(foreign instanceof WalletAccountTron).toBe(true)
      expect(isFullAccount(foreign)).toBe(true)
    })
  })

  describe('isTronAccount', () => {
    it('accepts both full and read-only tron accounts', () => {
      expect(isTronAccount(onPrototype(WalletAccountTron))).toBe(true)
      expect(isTronAccount(onPrototype(WalletAccountReadOnlyTron))).toBe(true)
    })

    it('rejects non-tron accounts', () => {
      expect(isTronAccount(onPrototype(WalletAccountEvm))).toBe(false)
      expect(isTronAccount(onPrototype(WalletAccountReadOnlyEvm))).toBe(false)
      expect(isTronAccount(undefined)).toBe(false)
    })

    it('detects a tron account from a different module copy', () => {
      class WalletAccountReadOnlyTron { }
      expect(isTronAccount(new WalletAccountReadOnlyTron())).toBe(true)
    })
  })
})
