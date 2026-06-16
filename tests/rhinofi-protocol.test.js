import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { ISwidgeProtocol } from '@tetherto/wdk-wallet/protocols'

// --- Fixtures -------------------------------------------------------------

const DUMMY_DEPOSITOR = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
const DUMMY_RECIPIENT = '0x8ba1f109551bD432803012645Ac136ddd64DBA72'
const DUMMY_QUOTE_ID = 'd4f9a7e2-1c3b-4e8f-9a6d-2b5c8e1f7a30'
const DUMMY_DEPOSIT_HASH = '0x6e3c7d4a92b8f1e05c6a89d273b4f8a1c5e92d7b0a4f86c3e1d95b28a7c40f63'
const DUMMY_WITHDRAW_HASH = '0x9b1f4e7c25a8d3061e9c74b8f2a5d1c08e6b39f7d2a41c85b0e67d3a9f158c24'
const DUMMY_APPROVAL_HASH = '0x2d8a5f1c7e94b3062a7d91c4f8e5b2a06c3f97e1d8b54a20c6e83f1b9d472a05'
const DUMMY_REFUND_HASH = '0x5c2e8b4f19a7d6032c8b95e1f4a7d2b08f6c31e9d5a82b47c0e19f6b3d854a17'

const DUMMY_USDT_ARBITRUM_ADDRESS = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
const DUMMY_USDC_ARBITRUM_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const DUMMY_USDC_BASE_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const DUMMY_USDC_ETHEREUM_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const DUMMY_DAI_BASE_ADDRESS = '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'

const DUMMY_CONFIG = {
  ARBITRUM: {
    name: 'Arbitrum',
    type: 'EVM',
    networkId: '42161',
    rpc: 'https://dummy-arbitrum-rpc.url/',
    contractAddress: '0x10417734001162Ea139e8b044DFe28DbB8B28ad0',
    nativeTokenName: 'ETH',
    nativeTokenDecimals: 18,
    status: 'enabled',
    enabledDepositAddress: true,
    gasBoostEnabled: true,
    tokens: {
      USDT: { token: 'USDT', address: DUMMY_USDT_ARBITRUM_ADDRESS, decimals: 6 },
      USDC: { token: 'USDC', address: DUMMY_USDC_ARBITRUM_ADDRESS, decimals: 6 }
    }
  },
  BASE: {
    name: 'Base',
    type: 'EVM',
    networkId: '8453',
    rpc: 'https://dummy-base-rpc.url/',
    contractAddress: '0x2f59E9086ec8130E21BD052065a9E6B2497bb102',
    nativeTokenName: 'ETH',
    nativeTokenDecimals: 18,
    status: 'enabled',
    enabledDepositAddress: true,
    gasBoostEnabled: true,
    tokens: {
      USDC: { token: 'USDC', address: DUMMY_USDC_BASE_ADDRESS, decimals: 6 }
    }
  },
  ETHEREUM: {
    name: 'Ethereum',
    type: 'EVM',
    networkId: '1',
    rpc: 'https://dummy-ethereum-rpc.url/',
    contractAddress: '0xeD9d63a96c27f87B07115b56b2e3572827f21646',
    nativeTokenName: 'ETH',
    nativeTokenDecimals: 18,
    status: 'disabled',
    enabledDepositAddress: false,
    gasBoostEnabled: false,
    tokens: { USDC: { token: 'USDC', address: DUMMY_USDC_ETHEREUM_ADDRESS, decimals: 6 } }
  }
}

// Bridge-swap quote: 1 USDT (Arbitrum) -> ~0.99 USDC (Base).
const DUMMY_QUOTE = {
  chainIn: 'ARBITRUM',
  chainOut: 'BASE',
  payAmount: '1',
  receiveAmount: '0.99',
  minReceiveAmount: '0.98',
  payAmountUsd: 1,
  receiveAmountUsd: 0.99,
  fees: {
    fee: '0.01',
    feeUsd: 0.01,
    gasFee: '0.005',
    platformFee: '0.003',
    percentageFee: '0.002'
  },
  estimatedDuration: 60000,
  tokenIn: 'USDT',
  tokenOut: 'USDC',
  _tag: 'bridgeSwap'
}

// The SwidgeFee entries mapQuote derives from DUMMY_QUOTE.fees.
const DUMMY_QUOTE_FEES = [
  { type: 'network', amount: 5000n, token: 'USDT', chain: 'ARBITRUM', included: true, description: 'Network/gas fee' },
  { type: 'protocol', amount: 5000n, token: 'USDT', chain: 'ARBITRUM', included: true, description: 'rhino.fi protocol fee' }
]

// --- Mocks ----------------------------------------------------------------

const bridgeApi = {
  getBridgeConfig: jest.fn(),
  getSwapTokensConfig: jest.fn(),
  getSwapPublicQuote: jest.fn(),
  getBridgeStatus: jest.fn()
}
const prepareBridge = jest.fn()
const RhinoSdk = jest.fn(() => ({ api: { bridge: bridgeApi }, prepareBridge }))

jest.unstable_mockModule('@rhino.fi/sdk', () => ({ RhinoSdk }))
jest.unstable_mockModule('@rhino.fi/sdk/adapters/evm-wdk', () => ({ getEvmChainAdapterFromWdkAccount: jest.fn(() => ({ networkId: '42161' })) }))

const indexModule = await import('../index.js')
const RhinofiProtocol = indexModule.default
const {
  RhinofiProtocolError,
  AccountRequiredError,
  ConfigurationError,
  UnsupportedChainError,
  UnsupportedTokenError,
  FeeLimitExceededError,
  UnknownOperationError,
  SwidgeExecutionError
} = await import('../src/errors.js')
const { toBaseUnits, toDecimalString } = await import('../src/mappers.js')

// --- Helpers --------------------------------------------------------------

const fullAccount = () => ({
  getAddress: jest.fn(async () => DUMMY_DEPOSITOR),
  sendTransaction: jest.fn(async () => ({ hash: DUMMY_DEPOSIT_HASH, fee: 1n }))
})

// A WalletAccountEvm-like account whose ethers provider reports a chain id.
const evmAccount = (chainId = 42161, getNetwork = jest.fn(async () => ({ chainId: BigInt(chainId) }))) => ({
  ...fullAccount(),
  _provider: { getNetwork }
})

const noApprovalPrep = () =>
  prepareBridge.mockImplementation(async (_bridgeData, options) => ({
    type: 'no-approval-needed',
    quote: { ...DUMMY_QUOTE, quoteId: DUMMY_QUOTE_ID },
    bridge: async () => {
      options.hooks.onBridgeStatusChange({
        status: 'waiting-for-deposit-tx-completion',
        depositTxHash: DUMMY_DEPOSIT_HASH
      })
      return { data: { depositTxHash: DUMMY_DEPOSIT_HASH, withdrawTxHash: DUMMY_WITHDRAW_HASH } }
    }
  }))

// Default account is a provider-connected EVM account on Arbitrum, so the source
// chain (chainIn) is derived as 'ARBITRUM'.
const makeProtocol = (config = {}, account = evmAccount(42161)) =>
  new RhinofiProtocol(account, { apiKey: 'dummy-api-key', ...config })

// --- Tests ----------------------------------------------------------------

describe('@rhino.fi/wdk-protocol-swidge-rhinofi', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    bridgeApi.getBridgeConfig.mockResolvedValue({ data: DUMMY_CONFIG })
    bridgeApi.getSwapTokensConfig.mockResolvedValue({ data: [] })
    bridgeApi.getSwapPublicQuote.mockResolvedValue({ data: DUMMY_QUOTE })
    noApprovalPrep()
  })

  describe('exports', () => {
    it('should expose the protocol as both default and named export', () => {
      expect(indexModule.default).toBe(RhinofiProtocol)
      expect(indexModule.RhinofiProtocol).toBe(RhinofiProtocol)
      expect(indexModule.ISwidgeProtocol).toBe(ISwidgeProtocol)
    })

    it('should re-export the custom error classes', () => {
      expect(indexModule.RhinofiProtocolError).toBe(RhinofiProtocolError)
      expect(indexModule.AccountRequiredError).toBe(AccountRequiredError)
      expect(indexModule.ConfigurationError).toBe(ConfigurationError)
      expect(indexModule.UnsupportedChainError).toBe(UnsupportedChainError)
      expect(indexModule.UnsupportedTokenError).toBe(UnsupportedTokenError)
      expect(indexModule.FeeLimitExceededError).toBe(FeeLimitExceededError)
      expect(indexModule.UnknownOperationError).toBe(UnknownOperationError)
      expect(indexModule.SwidgeExecutionError).toBe(SwidgeExecutionError)
    })
  })

  describe('quoteSwidge', () => {
    it('should successfully quote a swidge operation (exact-in)', async () => {
      const protocol = makeProtocol()

      const quote = await protocol.quoteSwidge({
        fromToken: 'USDT',
        toToken: 'USDC',
        toChain: 'BASE',
        fromTokenAmount: 1000000n
      })

      expect(bridgeApi.getSwapPublicQuote).toHaveBeenCalledWith({
        chainIn: 'ARBITRUM',
        chainOut: 'BASE',
        tokenIn: 'USDT',
        tokenOut: 'USDC',
        amount: '1',
        mode: 'pay'
      })
      expect(quote).toEqual({
        fromTokenAmount: 1000000n,
        toTokenAmount: 990000n,
        toTokenAmountMin: 980000n,
        estimatedDuration: 60,
        fees: DUMMY_QUOTE_FEES
      })
    })

    it('should report price impact excluding fees', async () => {
      // 100 USD in, 97 USD out, 2 USD fees -> 1% real impact (not 3%).
      bridgeApi.getSwapPublicQuote.mockResolvedValue({
        data: { ...DUMMY_QUOTE, payAmountUsd: 100, receiveAmountUsd: 97, fees: { ...DUMMY_QUOTE.fees, feeUsd: 2 } }
      })
      const protocol = makeProtocol()

      const quote = await protocol.quoteSwidge({ fromToken: 'USDT', toToken: 'USDC', toChain: 'BASE', fromTokenAmount: 1000000n })

      expect(quote.priceImpact).toBe(0.01)
    })

    it('should omit price impact when the spread is entirely fees', async () => {
      // DUMMY_QUOTE: 1 USD in, 0.99 out, 0.01 fees -> 0 impact.
      const protocol = makeProtocol()

      const quote = await protocol.quoteSwidge({ fromToken: 'USDT', toToken: 'USDC', toChain: 'BASE', fromTokenAmount: 1000000n })

      expect(quote.priceImpact).toBeUndefined()
    })

    it('should include source-chain gas in the network fee and derive protocol from the total', async () => {
      bridgeApi.getSwapPublicQuote.mockResolvedValue({
        data: {
          ...DUMMY_QUOTE,
          fees: { fee: '0.011', gasFee: '0.005', sourceGasFee: '0.001', platformFee: '0.003', percentageFee: '0.002' }
        }
      })
      const protocol = makeProtocol()

      const quote = await protocol.quoteSwidge({
        fromToken: 'USDT',
        toToken: 'USDC',
        toChain: 'BASE',
        fromTokenAmount: 1000000n
      })

      expect(quote.fees).toEqual([
        { type: 'network', amount: 6000n, token: 'USDT', chain: 'ARBITRUM', included: true, description: 'Network/gas fee' },
        { type: 'protocol', amount: 5000n, token: 'USDT', chain: 'ARBITRUM', included: true, description: 'rhino.fi protocol fee' }
      ])
    })

    it('should successfully quote a swidge operation (exact-out)', async () => {
      const protocol = makeProtocol()

      await protocol.quoteSwidge({
        fromToken: 'USDT',
        toToken: 'USDC',
        toChain: 'BASE',
        toTokenAmount: 990000n
      })

      expect(bridgeApi.getSwapPublicQuote).toHaveBeenCalledWith({
        chainIn: 'ARBITRUM',
        chainOut: 'BASE',
        tokenIn: 'USDT',
        tokenOut: 'USDC',
        amount: '0.99',
        mode: 'receive'
      })
    })

    it('should derive the source chain from the account provider', async () => {
      const getNetwork = jest.fn(async () => ({ chainId: 8453n })) // Base
      const protocol = makeProtocol({}, evmAccount(8453, getNetwork))

      await protocol.quoteSwidge({ fromToken: 'USDC', toToken: 'USDC', toChain: 'ARBITRUM', fromTokenAmount: 1000000n })

      expect(getNetwork).toHaveBeenCalled() // getNetwork() takes no arguments
      expect(bridgeApi.getSwapPublicQuote).toHaveBeenCalledWith({
        chainIn: 'BASE',
        chainOut: 'ARBITRUM',
        tokenIn: 'USDC',
        tokenOut: 'USDC',
        amount: '1',
        mode: 'pay'
      })
    })

    it('should throw ConfigurationError when constructed without an apiKey', () => {
      expect(() => new RhinofiProtocol(undefined, {})).toThrow(ConfigurationError)
      expect(() => new RhinofiProtocol(undefined, {})).toThrow('A rhino.fi `apiKey` is required: the SDK authenticates every request (including quotes).')
    })

    it('should throw if the source chain cannot be determined (no provider)', async () => {
      const protocol = makeProtocol({}, fullAccount()) // no provider

      await expect(
        protocol.quoteSwidge({ fromToken: 'USDT', toToken: 'USDC', toChain: 'BASE', fromTokenAmount: 1000000n })
      ).rejects.toThrow('The source chain could not be determined from the account. Connect the wallet account to a provider for its source chain.')
    })

    it('should throw if there is no account to derive the source chain from', async () => {
      const protocol = new RhinofiProtocol(undefined, { apiKey: 'dummy-api-key' })

      await expect(
        protocol.quoteSwidge({ fromToken: 'USDT', toToken: 'USDC', toChain: 'BASE', fromTokenAmount: 1000000n })
      ).rejects.toThrow('The source chain could not be determined from the account. Connect the wallet account to a provider for its source chain.')
    })

    it('should throw UnsupportedChainError for an unknown destination chain', async () => {
      const protocol = makeProtocol()

      await expect(
        protocol.quoteSwidge({ fromToken: 'USDT', toToken: 'USDC', toChain: 'SOLANA', fromTokenAmount: 1000000n })
      ).rejects.toThrow('Chain "SOLANA" is not supported by the rhino.fi protocol.')
    })

    it('should throw UnsupportedTokenError for an unknown token', async () => {
      const protocol = makeProtocol()

      await expect(
        protocol.quoteSwidge({ fromToken: 'PEPE', toToken: 'USDC', toChain: 'BASE', fromTokenAmount: 1000000n })
      ).rejects.toThrow('Token "PEPE" is not supported on chain "ARBITRUM".')
    })

    it('should throw if neither fromTokenAmount nor toTokenAmount is provided', async () => {
      const protocol = makeProtocol()

      await expect(
        protocol.quoteSwidge({ fromToken: 'USDT', toToken: 'USDC', toChain: 'BASE' })
      ).rejects.toThrow('Either fromTokenAmount (exact-in) or toTokenAmount (exact-out) must be provided.')
    })

    it('should throw if both fromTokenAmount and toTokenAmount are provided', async () => {
      const protocol = makeProtocol()

      await expect(
        protocol.quoteSwidge({ fromToken: 'USDT', toToken: 'USDC', toChain: 'BASE', fromTokenAmount: 1000000n, toTokenAmount: 990000n })
      ).rejects.toThrow('Provide either fromTokenAmount (exact-in) or toTokenAmount (exact-out), not both.')
    })
  })

  describe('amount precision', () => {
    it('should round-trip 18-decimal amounts without rounding', () => {
      expect(toBaseUnits('1234.123456789012345678', 18)).toBe(1234123456789012345678n)
      expect(toDecimalString(1234123456789012345678n, 18)).toBe('1234.123456789012345678')
      expect(toBaseUnits('12345678.000000000000000001', 18)).toBe(12345678000000000000000001n)
    })
  })

  describe('swidge', () => {
    const SWIDGE_OPTIONS = {
      fromToken: 'USDT',
      toToken: 'USDC',
      toChain: 'BASE',
      fromTokenAmount: 1000000n,
      recipient: DUMMY_RECIPIENT
    }

    it('should successfully perform a swidge operation (exact-in)', async () => {
      const protocol = makeProtocol()

      const result = await protocol.swidge(SWIDGE_OPTIONS)

      expect(prepareBridge).toHaveBeenCalledTimes(1)
      const [bridgeData] = prepareBridge.mock.calls[0]
      expect(bridgeData).toEqual({
        type: 'bridgeSwap',
        tokenIn: 'USDT',
        tokenOut: 'USDC',
        chainIn: 'ARBITRUM',
        chainOut: 'BASE',
        amount: '1',
        mode: 'pay',
        depositor: DUMMY_DEPOSITOR,
        recipient: DUMMY_RECIPIENT
      })
      expect(result).toEqual({
        id: DUMMY_QUOTE_ID,
        hash: DUMMY_DEPOSIT_HASH,
        fees: DUMMY_QUOTE_FEES,
        transactions: [
          { hash: DUMMY_DEPOSIT_HASH, chain: 'ARBITRUM', type: 'source' }
        ],
        fromTokenAmount: 1000000n,
        toTokenAmount: 990000n,
        toTokenAmountMin: 980000n
      })
    })

    it('should successfully perform a swidge operation (exact-out)', async () => {
      const protocol = makeProtocol()

      await protocol.swidge({
        fromToken: 'USDT',
        toToken: 'USDC',
        toChain: 'BASE',
        toTokenAmount: 990000n
      })

      const [bridgeData] = prepareBridge.mock.calls[0]
      expect(bridgeData).toEqual({
        type: 'bridgeSwap',
        tokenIn: 'USDT',
        tokenOut: 'USDC',
        chainIn: 'ARBITRUM',
        chainOut: 'BASE',
        amount: '0.99',
        mode: 'receive',
        depositor: DUMMY_DEPOSITOR,
        recipient: DUMMY_DEPOSITOR
      })
    })

    it('should perform an approval before depositing and report both transactions', async () => {
      const approve = jest.fn(async () => ({
        type: 'success',
        approvalTxHash: DUMMY_APPROVAL_HASH,
        bridge: async () => {
          lastOptions.hooks.onBridgeStatusChange({
            status: 'waiting-for-deposit-tx-completion',
            depositTxHash: DUMMY_DEPOSIT_HASH
          })
          return { data: { depositTxHash: DUMMY_DEPOSIT_HASH } }
        }
      }))
      let lastOptions
      prepareBridge.mockImplementation(async (_bridgeData, options) => {
        lastOptions = options
        return { type: 'approval-needed', quote: { ...DUMMY_QUOTE, quoteId: DUMMY_QUOTE_ID }, approve }
      })

      const protocol = makeProtocol()
      const result = await protocol.swidge(SWIDGE_OPTIONS)

      expect(approve).toHaveBeenCalledTimes(1)
      expect(result).toEqual({
        id: DUMMY_QUOTE_ID,
        hash: DUMMY_DEPOSIT_HASH,
        fees: DUMMY_QUOTE_FEES,
        transactions: [
          { hash: DUMMY_APPROVAL_HASH, chain: 'ARBITRUM', type: 'approval' },
          { hash: DUMMY_DEPOSIT_HASH, chain: 'ARBITRUM', type: 'source' }
        ],
        fromTokenAmount: 1000000n,
        toTokenAmount: 990000n,
        toTokenAmountMin: 980000n
      })
    })

    it('should build a same-token bridge (not a swap)', async () => {
      const protocol = makeProtocol()

      await protocol.swidge({
        fromToken: 'USDC',
        toToken: 'USDC',
        toChain: 'BASE',
        fromTokenAmount: 1000000n
      })

      const [bridgeData] = prepareBridge.mock.calls[0]
      expect(bridgeData).toEqual({
        type: 'bridge',
        token: 'USDC',
        chainIn: 'ARBITRUM',
        chainOut: 'BASE',
        amount: '1',
        mode: 'pay',
        depositor: DUMMY_DEPOSITOR,
        recipient: DUMMY_DEPOSITOR
      })
    })

    it('should surface the precise rhino.fi failure code and detail when prepare fails', async () => {
      prepareBridge.mockResolvedValue({
        type: 'error',
        error: { type: 'FetchQuoteFailed', originalError: { _tag: 'NegativeReceiveAmount', receiveAmount: '-0.01' } }
      })
      const protocol = makeProtocol()

      const error = await protocol.swidge(SWIDGE_OPTIONS).catch((e) => e)
      expect(error).toBeInstanceOf(SwidgeExecutionError)
      expect(error.code).toBe('NegativeReceiveAmount')
      expect(error.message).toBe('rhino.fi failed to prepare the swidge. (the requested amount is too small to cover the fees).')
    })

    it('should surface InsufficientBalance with the available balance', async () => {
      prepareBridge.mockResolvedValue({
        type: 'error',
        error: { type: 'InsufficientBalance', availableBalance: 5n }
      })
      const protocol = makeProtocol()

      const error = await protocol.swidge(SWIDGE_OPTIONS).catch((e) => e)
      expect(error).toBeInstanceOf(SwidgeExecutionError)
      expect(error.code).toBe('InsufficientBalance')
      expect(error.message).toBe('rhino.fi failed to prepare the swidge. (available balance is 5).')
    })

    it('should throw if the swidge fees exceed the max network fee configuration', async () => {
      const protocol = makeProtocol({ maxNetworkFeeBps: 10 })

      const error = await protocol.swidge(SWIDGE_OPTIONS).catch((e) => e)
      expect(error).toBeInstanceOf(FeeLimitExceededError)
      expect(error.message).toBe('The quoted network fee (50 bps) exceeds the configured maximum (10 bps).')
      expect(error.feeType).toBe('network')
      expect(error.actualBps).toBe(50n)
      expect(error.maxBps).toBe(10n)
      // Fee check happens before any deposit is attempted.
      expect(prepareBridge).toHaveBeenCalledTimes(1)
    })

    it('should throw if the swidge fees exceed the max protocol fee configuration', async () => {
      const protocol = makeProtocol({ maxNetworkFeeBps: 1000, maxProtocolFeeBps: 10 })

      const error = await protocol.swidge(SWIDGE_OPTIONS).catch((e) => e)
      expect(error).toBeInstanceOf(FeeLimitExceededError)
      expect(error.message).toBe('The quoted protocol fee (50 bps) exceeds the configured maximum (10 bps).')
      expect(error.feeType).toBe('protocol')
      expect(error.actualBps).toBe(50n)
      expect(error.maxBps).toBe(10n)
    })

    it('should respect per-call config overriding constructor config', async () => {
      const protocol = makeProtocol({ maxNetworkFeeBps: 1000 })

      await expect(
        protocol.swidge(SWIDGE_OPTIONS, { maxNetworkFeeBps: 10 })
      ).rejects.toThrow('The quoted network fee (50 bps) exceeds the configured maximum (10 bps).')
    })

    it('should throw if the account is read-only', async () => {
      const readOnly = { getAddress: jest.fn(async () => DUMMY_DEPOSITOR) }
      const protocol = new RhinofiProtocol(readOnly, { apiKey: 'dummy-api-key' })

      await expect(protocol.swidge(SWIDGE_OPTIONS)).rejects.toThrow('A wallet account with signing capabilities is required to execute a swidge.')
      expect(prepareBridge).not.toHaveBeenCalled()
    })

    it('should throw if no account was provided', async () => {
      const protocol = new RhinofiProtocol(undefined, { apiKey: 'dummy-api-key' })

      await expect(protocol.swidge(SWIDGE_OPTIONS)).rejects.toThrow('A wallet account with signing capabilities is required to execute a swidge.')
    })
  })

  describe('getSwidgeStatus', () => {
    it('should successfully return the status of an operation', async () => {
      bridgeApi.getBridgeStatus.mockResolvedValue({
        data: { state: 'EXECUTED', depositTxHash: DUMMY_DEPOSIT_HASH, withdrawTxHash: DUMMY_WITHDRAW_HASH }
      })
      const protocol = makeProtocol()

      const status = await protocol.getSwidgeStatus(DUMMY_QUOTE_ID)

      expect(bridgeApi.getBridgeStatus).toHaveBeenCalledWith(DUMMY_QUOTE_ID)
      expect(status).toEqual({
        status: 'completed',
        transactions: [
          { hash: DUMMY_DEPOSIT_HASH, type: 'source' },
          { hash: DUMMY_WITHDRAW_HASH, type: 'destination' }
        ]
      })
    })

    it('should successfully return the status of an operation by filtering the source and target chain', async () => {
      bridgeApi.getBridgeStatus.mockResolvedValue({
        data: { state: 'ACCEPTED', depositTxHash: DUMMY_DEPOSIT_HASH }
      })
      const protocol = makeProtocol()

      const status = await protocol.getSwidgeStatus(DUMMY_QUOTE_ID, { fromChain: 'ARBITRUM', toChain: 'BASE' })

      expect(status).toEqual({
        status: 'pending',
        transactions: [
          { hash: DUMMY_DEPOSIT_HASH, type: 'source', chain: 'ARBITRUM' }
        ]
      })
    })

    it('should map a refunded operation', async () => {
      bridgeApi.getBridgeStatus.mockResolvedValue({
        data: { state: 'SWAP_FAILED_REFUNDED', depositTxHash: DUMMY_DEPOSIT_HASH, refundTxHash: DUMMY_REFUND_HASH }
      })
      const protocol = makeProtocol()

      const status = await protocol.getSwidgeStatus(DUMMY_QUOTE_ID)

      expect(status).toEqual({
        status: 'refunded',
        transactions: [
          { hash: DUMMY_DEPOSIT_HASH, type: 'source' },
          { hash: DUMMY_REFUND_HASH, type: 'refund' }
        ]
      })
    })

    it('should throw UnknownOperationError on a 404 (not found)', async () => {
      bridgeApi.getBridgeStatus.mockResolvedValue({ error: { type: 'NotFound' }, response: { status: 404 } })
      const protocol = makeProtocol()

      await expect(protocol.getSwidgeStatus('unknown-id')).rejects.toThrow('No swidge operation found for id "unknown-id".')
    })

    it('should surface transient failures as SwidgeExecutionError, not "unknown id"', async () => {
      bridgeApi.getBridgeStatus.mockRejectedValue(new Error('ECONNRESET'))
      const protocol = makeProtocol()

      const error = await protocol.getSwidgeStatus(DUMMY_QUOTE_ID).catch((e) => e)
      expect(error).toBeInstanceOf(SwidgeExecutionError)
      expect(error).not.toBeInstanceOf(UnknownOperationError)
      expect(error.message).toBe('Failed to fetch the swidge status.')
    })

    it('should throw if the id is empty', async () => {
      const protocol = makeProtocol()
      await expect(protocol.getSwidgeStatus('')).rejects.toThrow('No swidge operation found for id "".')
    })
  })

  describe('getSupportedChains', () => {
    it('should successfully return supported chains (enabled only)', async () => {
      const protocol = makeProtocol()

      const chains = await protocol.getSupportedChains()

      expect(chains).toEqual([
        { id: 'ARBITRUM', name: 'Arbitrum', type: 'evm', nativeToken: 'ETH' },
        { id: 'BASE', name: 'Base', type: 'evm', nativeToken: 'ETH' }
      ])
    })
  })

  describe('getSupportedTokens', () => {
    it('should successfully return supported tokens (enabled chains only)', async () => {
      const protocol = makeProtocol()

      const tokens = await protocol.getSupportedTokens()

      // ETHEREUM is disabled, so its tokens are excluded.
      expect(tokens).toEqual([
        { token: 'USDT', chain: 'ARBITRUM', symbol: 'USDT', decimals: 6, address: DUMMY_USDT_ARBITRUM_ADDRESS },
        { token: 'USDC', chain: 'ARBITRUM', symbol: 'USDC', decimals: 6, address: DUMMY_USDC_ARBITRUM_ADDRESS },
        { token: 'USDC', chain: 'BASE', symbol: 'USDC', decimals: 6, address: DUMMY_USDC_BASE_ADDRESS }
      ])
    })

    it('should filter tokens by chain when options are provided', async () => {
      const protocol = makeProtocol()

      const tokens = await protocol.getSupportedTokens({ fromChain: 'ARBITRUM' })

      expect(tokens).toEqual([
        { token: 'USDT', chain: 'ARBITRUM', symbol: 'USDT', decimals: 6, address: DUMMY_USDT_ARBITRUM_ADDRESS },
        { token: 'USDC', chain: 'ARBITRUM', symbol: 'USDC', decimals: 6, address: DUMMY_USDC_ARBITRUM_ADDRESS }
      ])
    })

    it('should merge swap-token config entries', async () => {
      bridgeApi.getSwapTokensConfig.mockResolvedValue({
        data: [{ chain: 'BASE', symbol: 'DAI', decimals: 18, tokenAddress: DUMMY_DAI_BASE_ADDRESS, name: 'Dai' }]
      })
      const protocol = makeProtocol()

      const tokens = await protocol.getSupportedTokens({ fromChain: 'BASE' })

      expect(tokens).toEqual([
        { token: 'USDC', chain: 'BASE', symbol: 'USDC', decimals: 6, address: DUMMY_USDC_BASE_ADDRESS },
        { token: 'DAI', chain: 'BASE', symbol: 'DAI', decimals: 18, address: DUMMY_DAI_BASE_ADDRESS, name: 'Dai' }
      ])
    })
  })

  describe('legacy delegation', () => {
    // SwapOptions/BridgeOptions carry no source chain, so the inherited swap()/
    // bridge() delegations rely on it being derived from the account. They work
    // for an EVM account connected to a provider, and throw otherwise.
    it('should delegate swap() to swidge() with the derived source chain', async () => {
      const protocol = makeProtocol({}, evmAccount(42161))

      const result = await protocol.swap({
        tokenIn: 'USDT',
        tokenOut: 'USDC',
        to: DUMMY_RECIPIENT,
        tokenInAmount: 1000000n
      })

      // Base SwidgeProtocol.swap maps the swidge result to a SwapResult.
      expect(result.hash).toBe(DUMMY_QUOTE_ID)
      expect(result.tokenInAmount).toBe(1000000n)
      expect(result.tokenOutAmount).toBe(990000n)
      expect(result.fee).toBe(10000n) // network 5000 + protocol 5000
    })

    it('should delegate bridge() to swidge() with the derived source chain', async () => {
      const protocol = makeProtocol({}, evmAccount(42161))

      const result = await protocol.bridge({
        token: 'USDC',
        targetChain: 'BASE',
        recipient: DUMMY_RECIPIENT,
        amount: 1000000n
      })

      const [bridgeData] = prepareBridge.mock.calls[0]
      expect(bridgeData.type).toBe('bridge')
      expect(bridgeData.chainIn).toBe('ARBITRUM')
      expect(result.hash).toBe(DUMMY_QUOTE_ID)
      expect(result.fee).toBe(5000n) // network
      expect(result.bridgeFee).toBe(5000n) // protocol
    })

    it('should throw from swap() when the source chain cannot be derived (no provider)', async () => {
      const protocol = makeProtocol({}, fullAccount())

      await expect(protocol.swap({
        tokenIn: 'USDT',
        tokenOut: 'USDC',
        to: DUMMY_RECIPIENT,
        tokenInAmount: 1000000n
      })).rejects.toThrow('The source chain could not be determined from the account. Connect the wallet account to a provider for its source chain.')
    })
  })

  describe('config caching', () => {
    it('should reuse the config within the TTL window (default 60s)', async () => {
      const protocol = makeProtocol()

      await protocol.getSupportedChains()
      await protocol.getSupportedChains()

      expect(bridgeApi.getBridgeConfig).toHaveBeenCalledTimes(1)
    })

    it('should dedupe concurrent fetches into a single request', async () => {
      const protocol = makeProtocol()

      await Promise.all([protocol.getSupportedChains(), protocol.getSupportedChains()])

      expect(bridgeApi.getBridgeConfig).toHaveBeenCalledTimes(1)
    })

    it('should always fetch fresh when configTtlMs is 0', async () => {
      const protocol = makeProtocol({ configTtlMs: 0 })

      await protocol.getSupportedChains()
      await protocol.getSupportedChains()

      expect(bridgeApi.getBridgeConfig).toHaveBeenCalledTimes(2)
    })

    it('should not cache failures (next call retries)', async () => {
      const protocol = makeProtocol()
      bridgeApi.getBridgeConfig.mockRejectedValueOnce(new Error('network blip'))

      await expect(protocol.getSupportedChains()).rejects.toThrow('Failed to fetch the rhino.fi bridge config.')
      const chains = await protocol.getSupportedChains()

      expect(chains).toEqual([
        { id: 'ARBITRUM', name: 'Arbitrum', type: 'evm', nativeToken: 'ETH' },
        { id: 'BASE', name: 'Base', type: 'evm', nativeToken: 'ETH' }
      ])
      expect(bridgeApi.getBridgeConfig).toHaveBeenCalledTimes(2)
    })

    it('should cache the config and swap-token lists independently', async () => {
      const protocol = makeProtocol()

      await protocol.getSupportedTokens()
      await protocol.getSupportedTokens()

      expect(bridgeApi.getBridgeConfig).toHaveBeenCalledTimes(1)
      expect(bridgeApi.getSwapTokensConfig).toHaveBeenCalledTimes(1)
    })
  })
})
