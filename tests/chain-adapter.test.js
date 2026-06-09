import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const getEvmChainAdapterFromWdkAccount = jest.fn(() => ({ networkId: '8453' }))
jest.unstable_mockModule('@rhino.fi/sdk/adapters/evm-wdk', () => ({ getEvmChainAdapterFromWdkAccount }))

const { getChainAdapterForAccount } = await import('../src/chain-adapter.js')
const { UnsupportedChainError } = await import('../src/errors.js')

const makeAccount = () => ({
  getAddress: jest.fn(async () => '0xACCOUNT'),
  sendTransaction: jest.fn(async () => ({ hash: '0xTX', fee: 21000n }))
})

describe('getChainAdapterForAccount', () => {
  beforeEach(() => jest.clearAllMocks())

  it('hands the account straight to the SDK EVM account adapter', async () => {
    const account = makeAccount()
    const chainConfig = { type: 'EVM', name: 'Base', rpc: 'https://base.example' }

    const adapter = await getChainAdapterForAccount(account, chainConfig)

    expect(getEvmChainAdapterFromWdkAccount).toHaveBeenCalledWith(account, chainConfig)
    expect(adapter).toEqual({ networkId: '8453' })
  })

  it('throws UnsupportedChainError for non-EVM ecosystems', async () => {
    for (const type of ['solana', 'ton', 'tron', 'starknet']) {
      await expect(
        getChainAdapterForAccount(makeAccount(), { type, name: type })
      ).rejects.toThrow(UnsupportedChainError)
    }
  })
})
