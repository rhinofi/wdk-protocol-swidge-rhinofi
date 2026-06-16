import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const DUMMY_ACCOUNT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
const DUMMY_TX_HASH = '0x6e3c7d4a92b8f1e05c6a89d273b4f8a1c5e92d7b0a4f86c3e1d95b28a7c40f63'
const DUMMY_ADAPTER = { networkId: '8453' }

const getEvmChainAdapterFromWdkAccount = jest.fn(() => DUMMY_ADAPTER)
jest.unstable_mockModule('@rhino.fi/sdk/adapters/evm-wdk', () => ({ getEvmChainAdapterFromWdkAccount }))

const { getChainAdapterForAccount } = await import('../src/chain-adapter.js')
const { UnsupportedChainError } = await import('../src/errors.js')

const makeAccount = () => ({
  getAddress: jest.fn(async () => DUMMY_ACCOUNT_ADDRESS),
  sendTransaction: jest.fn(async () => ({ hash: DUMMY_TX_HASH, fee: 21000n }))
})

describe('getChainAdapterForAccount', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should hand the account straight to the SDK EVM account adapter', async () => {
    const account = makeAccount()
    const chainConfig = { type: 'EVM', name: 'Base', rpc: 'https://dummy-base-rpc.url/' }

    const adapter = await getChainAdapterForAccount(account, chainConfig)

    expect(getEvmChainAdapterFromWdkAccount).toHaveBeenCalledWith(account, chainConfig)
    expect(adapter).toBe(DUMMY_ADAPTER)
  })

  it('should throw UnsupportedChainError for non-EVM ecosystems', async () => {
    const account = makeAccount()

    await expect(
      getChainAdapterForAccount(account, { type: 'SOLANA', name: 'Solana' })
    ).rejects.toThrow(UnsupportedChainError)
    await expect(
      getChainAdapterForAccount(account, { type: 'SOLANA', name: 'Solana' })
    ).rejects.toThrow('Chain "Solana (solana) source chains are not yet supported" is not supported by the rhino.fi protocol.')
    expect(getEvmChainAdapterFromWdkAccount).not.toHaveBeenCalled()
  })
})
