import { beforeEach, describe, expect, it, jest } from '@jest/globals'

// --- Fixtures -------------------------------------------------------------

const DEPOSITOR = '0xDEPOSITOR'
const QUOTE_ID = 'quote-123'
const DEPOSIT_HASH = '0xdeposit'
const WITHDRAW_HASH = '0xwithdraw'
const APPROVAL_HASH = '0xapproval'

const CONFIG = {
  ARBITRUM: {
    name: 'Arbitrum',
    type: 'EVM',
    networkId: '42161',
    rpc: 'https://arb.example',
    contractAddress: '0xbridgeArb',
    nativeTokenName: 'ETH',
    nativeTokenDecimals: 18,
    status: 'enabled',
    enabledDepositAddress: true,
    gasBoostEnabled: true,
    tokens: {
      USDT: { token: 'USDT', address: '0xusdt', decimals: 6 },
      USDC: { token: 'USDC', address: '0xusdcArb', decimals: 6 }
    }
  },
  BASE: {
    name: 'Base',
    type: 'EVM',
    networkId: '8453',
    rpc: 'https://base.example',
    contractAddress: '0xbridgeBase',
    nativeTokenName: 'ETH',
    nativeTokenDecimals: 18,
    status: 'enabled',
    enabledDepositAddress: true,
    gasBoostEnabled: true,
    tokens: {
      USDC: { token: 'USDC', address: '0xusdcBase', decimals: 6 }
    }
  },
  ETHEREUM: {
    name: 'Ethereum',
    type: 'EVM',
    networkId: '1',
    rpc: 'https://eth.example',
    contractAddress: '0xbridgeEth',
    nativeTokenName: 'ETH',
    nativeTokenDecimals: 18,
    status: 'disabled',
    enabledDepositAddress: false,
    gasBoostEnabled: false,
    tokens: { USDC: { token: 'USDC', address: '0xusdcEth', decimals: 6 } }
  }
}

// Bridge-swap quote: 1 USDT (Arbitrum) -> ~0.99 USDC (Base).
const QUOTE = {
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
  FeeLimitExceededError,
  UnknownOperationError,
  ConfigurationError,
  SwidgeExecutionError
} = await import('../src/errors.js')
const { toBaseUnits, toDecimalString } = await import('../src/mappers.js')

// --- Helpers --------------------------------------------------------------

const fullAccount = () => ({
  getAddress: jest.fn(async () => DEPOSITOR),
  sendTransaction: jest.fn(async () => ({ hash: DEPOSIT_HASH, fee: 1n }))
})

// A WalletAccountEvm-like account whose ethers provider reports a chain id.
const evmAccount = (chainId = 42161, getNetwork = jest.fn(async () => ({ chainId: BigInt(chainId) }))) => ({
  ...fullAccount(),
  _provider: { getNetwork }
})

const noApprovalPrep = () =>
  prepareBridge.mockImplementation(async (_bridgeData, options) => ({
    type: 'no-approval-needed',
    quote: { ...QUOTE, quoteId: QUOTE_ID },
    bridge: async () => {
      options.hooks.onBridgeStatusChange({
        status: 'waiting-for-deposit-tx-completion',
        depositTxHash: DEPOSIT_HASH
      })
      return { data: { depositTxHash: DEPOSIT_HASH, withdrawTxHash: WITHDRAW_HASH } }
    }
  }))

// Default account is a provider-connected EVM account on Arbitrum, so the source
// chain (chainIn) is derived as 'ARBITRUM'.
const makeProtocol = (config = {}, account = evmAccount(42161)) =>
  new RhinofiProtocol(account, { apiKey: 'test-key', ...config })

// --- Tests ----------------------------------------------------------------

describe('RhinofiProtocol', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    bridgeApi.getBridgeConfig.mockResolvedValue({ data: CONFIG })
    bridgeApi.getSwapTokensConfig.mockResolvedValue({ data: [] })
    bridgeApi.getSwapPublicQuote.mockResolvedValue({ data: QUOTE })
    noApprovalPrep()
  })

  describe('exports', () => {
    it('exposes default plus named class and interface symbol', () => {
      expect(indexModule.default).toBe(indexModule.RhinofiProtocol)
      expect(typeof indexModule.RhinofiProtocol).toBe('function')
      expect(typeof indexModule.ISwidgeProtocol).toBe('function')
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
      expect(quote.fromTokenAmount).toBe(1000000n)
      expect(quote.toTokenAmount).toBe(990000n)
      expect(quote.toTokenAmountMin).toBe(980000n)
      expect(quote.estimatedDuration).toBe(60)
      expect(quote.fees).toEqual([
        expect.objectContaining({ type: 'network', amount: 5000n, token: 'USDT' }),
        expect.objectContaining({ type: 'protocol', amount: 5000n, token: 'USDT' })
      ])
    })

    it('reports price impact excluding fees', async () => {
      // 100 USD in, 97 USD out, 2 USD fees -> 1% real impact (not 3%).
      bridgeApi.getSwapPublicQuote.mockResolvedValue({
        data: { ...QUOTE, payAmountUsd: 100, receiveAmountUsd: 97, fees: { ...QUOTE.fees, feeUsd: 2 } }
      })
      const protocol = makeProtocol()

      const quote = await protocol.quoteSwidge({ fromToken: 'USDT', toToken: 'USDC', toChain: 'BASE', fromTokenAmount: 1000000n })

      expect(quote.priceImpact).toBeCloseTo(0.01, 10)
    })

    it('omits price impact when the spread is entirely fees', async () => {
      // QUOTE: 1 USD in, 0.99 out, 0.01 fees -> 0 impact.
      const protocol = makeProtocol()

      const quote = await protocol.quoteSwidge({ fromToken: 'USDT', toToken: 'USDC', toChain: 'BASE', fromTokenAmount: 1000000n })

      expect(quote.priceImpact).toBeUndefined()
    })

    it('includes source-chain gas in the network fee and derives protocol from the total', async () => {
      bridgeApi.getSwapPublicQuote.mockResolvedValue({
        data: {
          ...QUOTE,
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
        expect.objectContaining({ type: 'network', amount: 6000n }),
        expect.objectContaining({ type: 'protocol', amount: 5000n })
      ])
      expect(quote.fees.reduce((sum, f) => sum + f.amount, 0n)).toBe(11000n)
    })

    it('should successfully quote a swidge operation (exact-out)', async () => {
      const protocol = makeProtocol()

      await protocol.quoteSwidge({
        fromToken: 'USDT',
        toToken: 'USDC',
        toChain: 'BASE',
        toTokenAmount: 990000n
      })

      expect(bridgeApi.getSwapPublicQuote).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '0.99', mode: 'receive' })
      )
    })

    it('derives the source chain from the account provider', async () => {
      const account = evmAccount(8453) // Base
      const protocol = makeProtocol({}, account)

      await protocol.quoteSwidge({ fromToken: 'USDC', toToken: 'USDC', toChain: 'ARBITRUM', fromTokenAmount: 1000000n })

      expect(account._provider.getNetwork).toHaveBeenCalled()
      expect(bridgeApi.getSwapPublicQuote).toHaveBeenCalledWith(
        expect.objectContaining({ chainIn: 'BASE', chainOut: 'ARBITRUM' })
      )
    })

    it('should throw ConfigurationError when constructed without an apiKey', () => {
      expect(() => new RhinofiProtocol(undefined, {})).toThrow(ConfigurationError)
    })

    it('should throw if the source chain cannot be determined (no provider)', async () => {
      const protocol = makeProtocol({}, fullAccount()) // no provider

      await expect(
        protocol.quoteSwidge({ fromToken: 'USDT', toToken: 'USDC', toChain: 'BASE', fromTokenAmount: 1000000n })
      ).rejects.toThrow(RhinofiProtocolError)
    })

    it('should throw if there is no account to derive the source chain from', async () => {
      const protocol = new RhinofiProtocol(undefined, { apiKey: 'k' })

      await expect(
        protocol.quoteSwidge({ fromToken: 'USDT', toToken: 'USDC', toChain: 'BASE', fromTokenAmount: 1000000n })
      ).rejects.toThrow(RhinofiProtocolError)
    })

    it('should throw if both fromTokenAmount and toTokenAmount are provided', async () => {
      const protocol = makeProtocol()

      await expect(
        protocol.quoteSwidge({ fromToken: 'USDT', toToken: 'USDC', toChain: 'BASE', fromTokenAmount: 1000000n, toTokenAmount: 990000n })
      ).rejects.toThrow(/not both/)
    })
  })

  describe('amount precision', () => {
    it('round-trips 18-decimal amounts without rounding', () => {
      expect(toBaseUnits('1234.123456789012345678', 18)).toBe(1234123456789012345678n)
      expect(toDecimalString(1234123456789012345678n, 18)).toBe('1234.123456789012345678')
      expect(toBaseUnits('12345678.000000000000000001', 18)).toBe(12345678000000000000000001n)
    })
  })

  describe('swidge', () => {
    const swidgeOptions = {
      fromToken: 'USDT',
      toToken: 'USDC',
      toChain: 'BASE',
      fromTokenAmount: 1000000n,
      recipient: '0xRECIPIENT'
    }

    it('should successfully perform a swidge operation (exact-in)', async () => {
      const protocol = makeProtocol()

      const result = await protocol.swidge(swidgeOptions)

      expect(prepareBridge).toHaveBeenCalledTimes(1)
      const [bridgeData] = prepareBridge.mock.calls[0]
      expect(bridgeData).toMatchObject({
        type: 'bridgeSwap',
        tokenIn: 'USDT',
        tokenOut: 'USDC',
        chainIn: 'ARBITRUM',
        chainOut: 'BASE',
        amount: '1',
        mode: 'pay',
        depositor: DEPOSITOR,
        recipient: '0xRECIPIENT'
      })
      expect(result.id).toBe(QUOTE_ID)
      expect(result.hash).toBe(DEPOSIT_HASH)
      expect(result.fromTokenAmount).toBe(1000000n)
      expect(result.toTokenAmount).toBe(990000n)
      expect(result.transactions).toEqual([
        { hash: DEPOSIT_HASH, chain: 'ARBITRUM', type: 'source' }
      ])
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
      expect(bridgeData).toMatchObject({ mode: 'receive', amount: '0.99' })
      expect(bridgeData.recipient).toBe(DEPOSITOR)
    })

    it('should perform an approval before depositing and report both transactions', async () => {
      const approve = jest.fn(async () => ({
        type: 'success',
        approvalTxHash: APPROVAL_HASH,
        bridge: async () => {
          lastOptions.hooks.onBridgeStatusChange({
            status: 'waiting-for-deposit-tx-completion',
            depositTxHash: DEPOSIT_HASH
          })
          return { data: { depositTxHash: DEPOSIT_HASH } }
        }
      }))
      let lastOptions
      prepareBridge.mockImplementation(async (_bridgeData, options) => {
        lastOptions = options
        return { type: 'approval-needed', quote: { ...QUOTE, quoteId: QUOTE_ID }, approve }
      })

      const protocol = makeProtocol()
      const result = await protocol.swidge(swidgeOptions)

      expect(approve).toHaveBeenCalledTimes(1)
      expect(result.id).toBe(QUOTE_ID)
      expect(result.hash).toBe(DEPOSIT_HASH)
      expect(result.transactions).toEqual([
        { hash: APPROVAL_HASH, chain: 'ARBITRUM', type: 'approval' },
        { hash: DEPOSIT_HASH, chain: 'ARBITRUM', type: 'source' }
      ])
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
      expect(bridgeData).toMatchObject({ type: 'bridge', token: 'USDC' })
      expect(bridgeData.tokenIn).toBeUndefined()
    })

    it('surfaces the precise rhino.fi failure code and detail when prepare fails', async () => {
      prepareBridge.mockResolvedValue({
        type: 'error',
        error: { type: 'FetchQuoteFailed', originalError: { _tag: 'NegativeReceiveAmount', receiveAmount: '-0.01' } }
      })
      const protocol = makeProtocol()

      await expect(protocol.swidge(swidgeOptions)).rejects.toMatchObject({
        name: 'SwidgeExecutionError',
        code: 'NegativeReceiveAmount',
        message: expect.stringContaining('too small to cover the fees')
      })
    })

    it('surfaces InsufficientBalance with the available balance', async () => {
      prepareBridge.mockResolvedValue({
        type: 'error',
        error: { type: 'InsufficientBalance', availableBalance: 5n }
      })
      const protocol = makeProtocol()

      const error = await protocol.swidge(swidgeOptions).catch((e) => e)
      expect(error).toBeInstanceOf(SwidgeExecutionError)
      expect(error.code).toBe('InsufficientBalance')
      expect(error.message).toContain('available balance is 5')
    })

    it('should throw if the swidge fees exceed the max network fee configuration', async () => {
      const protocol = makeProtocol({ maxNetworkFeeBps: 10 })

      await expect(protocol.swidge(swidgeOptions)).rejects.toThrow(FeeLimitExceededError)
      // Fee check happens before any deposit is attempted.
      expect(prepareBridge).toHaveBeenCalledTimes(1)
    })

    it('should throw if the swidge fees exceed the max protocol fee configuration', async () => {
      const protocol = makeProtocol({ maxNetworkFeeBps: 1000, maxProtocolFeeBps: 10 })

      await expect(protocol.swidge(swidgeOptions)).rejects.toThrow(FeeLimitExceededError)
    })

    it('should respect per-call config overriding constructor config', async () => {
      const protocol = makeProtocol({ maxNetworkFeeBps: 1000 })

      await expect(
        protocol.swidge(swidgeOptions, { maxNetworkFeeBps: 10 })
      ).rejects.toThrow(FeeLimitExceededError)
    })

    it('should throw if the account is read-only', async () => {
      const readOnly = { getAddress: jest.fn(async () => DEPOSITOR) }
      const protocol = new RhinofiProtocol(readOnly, { apiKey: 'k' })

      await expect(protocol.swidge(swidgeOptions)).rejects.toThrow(AccountRequiredError)
      expect(prepareBridge).not.toHaveBeenCalled()
    })

    it('should throw if no account was provided', async () => {
      const protocol = new RhinofiProtocol(undefined, { apiKey: 'k' })

      await expect(protocol.swidge(swidgeOptions)).rejects.toThrow(AccountRequiredError)
    })
  })

  describe('getSwidgeStatus', () => {
    it('should successfully return the status of an operation', async () => {
      bridgeApi.getBridgeStatus.mockResolvedValue({
        data: { state: 'EXECUTED', depositTxHash: DEPOSIT_HASH, withdrawTxHash: WITHDRAW_HASH }
      })
      const protocol = makeProtocol()

      const status = await protocol.getSwidgeStatus(QUOTE_ID)

      expect(bridgeApi.getBridgeStatus).toHaveBeenCalledWith(QUOTE_ID)
      expect(status.status).toBe('completed')
      expect(status.transactions).toEqual([
        { hash: DEPOSIT_HASH, type: 'source' },
        { hash: WITHDRAW_HASH, type: 'destination' }
      ])
    })

    it('should successfully return the status of an operation by filtering the source and target chain', async () => {
      bridgeApi.getBridgeStatus.mockResolvedValue({
        data: { state: 'ACCEPTED', depositTxHash: DEPOSIT_HASH }
      })
      const protocol = makeProtocol()

      const status = await protocol.getSwidgeStatus(QUOTE_ID, { fromChain: 'ARBITRUM', toChain: 'BASE' })

      expect(status.status).toBe('pending')
      expect(status.transactions).toEqual([
        { hash: DEPOSIT_HASH, type: 'source', chain: 'ARBITRUM' }
      ])
    })

    it('should map a refunded operation', async () => {
      bridgeApi.getBridgeStatus.mockResolvedValue({
        data: { state: 'SWAP_FAILED_REFUNDED', depositTxHash: DEPOSIT_HASH, refundTxHash: '0xrefund' }
      })
      const protocol = makeProtocol()

      const status = await protocol.getSwidgeStatus(QUOTE_ID)

      expect(status.status).toBe('refunded')
      expect(status.transactions).toContainEqual({ hash: '0xrefund', type: 'refund' })
    })

    it('should throw UnknownOperationError on a 404 (not found)', async () => {
      bridgeApi.getBridgeStatus.mockResolvedValue({ error: { type: 'NotFound' }, response: { status: 404 } })
      const protocol = makeProtocol()

      await expect(protocol.getSwidgeStatus('unknown-id')).rejects.toThrow(UnknownOperationError)
    })

    it('should surface transient failures as SwidgeExecutionError, not "unknown id"', async () => {
      bridgeApi.getBridgeStatus.mockRejectedValue(new Error('ECONNRESET'))
      const protocol = makeProtocol()

      const error = await protocol.getSwidgeStatus(QUOTE_ID).catch((e) => e)
      expect(error).toBeInstanceOf(SwidgeExecutionError)
      expect(error).not.toBeInstanceOf(UnknownOperationError)
    })

    it('should throw if the id is empty', async () => {
      const protocol = makeProtocol()
      await expect(protocol.getSwidgeStatus('')).rejects.toThrow(UnknownOperationError)
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
    it('should successfully return supported tokens', async () => {
      const protocol = makeProtocol()

      const tokens = await protocol.getSupportedTokens()

      expect(tokens).toContainEqual({
        token: 'USDT', chain: 'ARBITRUM', symbol: 'USDT', decimals: 6, address: '0xusdt'
      })
      expect(tokens).toContainEqual({
        token: 'USDC', chain: 'BASE', symbol: 'USDC', decimals: 6, address: '0xusdcBase'
      })
      // ETHEREUM is disabled, so its tokens are excluded.
      expect(tokens.some((t) => t.chain === 'ETHEREUM')).toBe(false)
    })

    it('should filter tokens by chain when options are provided', async () => {
      const protocol = makeProtocol()

      const tokens = await protocol.getSupportedTokens({ fromChain: 'ARBITRUM' })

      expect(tokens).toHaveLength(2)
      expect(tokens.every((t) => t.chain === 'ARBITRUM')).toBe(true)
    })

    it('should merge swap-token config entries', async () => {
      bridgeApi.getSwapTokensConfig.mockResolvedValue({
        data: [{ chain: 'BASE', symbol: 'DAI', decimals: 18, tokenAddress: '0xdai', name: 'Dai' }]
      })
      const protocol = makeProtocol()

      const tokens = await protocol.getSupportedTokens({ fromChain: 'BASE' })

      expect(tokens).toContainEqual({
        token: 'DAI', chain: 'BASE', symbol: 'DAI', decimals: 18, address: '0xdai', name: 'Dai'
      })
    })
  })

  describe('legacy delegation', () => {
    // SwapOptions/BridgeOptions carry no source chain, so the inherited swap()/
    // bridge() delegations rely on it being derived from the account. They work
    // for an EVM account connected to a provider, and throw otherwise.
    it('swap() delegates to swidge() with the derived source chain', async () => {
      const protocol = makeProtocol({}, evmAccount(42161))

      const result = await protocol.swap({
        tokenIn: 'USDT',
        tokenOut: 'USDC',
        to: '0xRECIPIENT',
        tokenInAmount: 1000000n
      })

      // Base SwidgeProtocol.swap maps the swidge result to a SwapResult.
      expect(result.hash).toBe(QUOTE_ID)
      expect(result.tokenInAmount).toBe(1000000n)
      expect(result.tokenOutAmount).toBe(990000n)
      expect(result.fee).toBe(10000n) // network 5000 + protocol 5000
    })

    it('bridge() delegates to swidge() with the derived source chain', async () => {
      const protocol = makeProtocol({}, evmAccount(42161))

      const result = await protocol.bridge({
        token: 'USDC',
        targetChain: 'BASE',
        recipient: '0xRECIPIENT',
        amount: 1000000n
      })

      const [bridgeData] = prepareBridge.mock.calls[0]
      expect(bridgeData.type).toBe('bridge')
      expect(bridgeData.chainIn).toBe('ARBITRUM')
      expect(result.hash).toBe(QUOTE_ID)
      expect(result.fee).toBe(5000n) // network
      expect(result.bridgeFee).toBe(5000n) // protocol
    })

    it('swap() throws when the source chain cannot be derived (no provider)', async () => {
      const protocol = makeProtocol({}, fullAccount())

      await expect(protocol.swap({
        tokenIn: 'USDT',
        tokenOut: 'USDC',
        to: '0xRECIPIENT',
        tokenInAmount: 1000000n
      })).rejects.toThrow(RhinofiProtocolError)
    })
  })

  describe('config caching', () => {
    it('reuses the config within the TTL window (default 60s)', async () => {
      const protocol = makeProtocol()

      await protocol.getSupportedChains()
      await protocol.getSupportedChains()

      expect(bridgeApi.getBridgeConfig).toHaveBeenCalledTimes(1)
    })

    it('dedupes concurrent fetches into a single request', async () => {
      const protocol = makeProtocol()

      await Promise.all([protocol.getSupportedChains(), protocol.getSupportedChains()])

      expect(bridgeApi.getBridgeConfig).toHaveBeenCalledTimes(1)
    })

    it('always fetches fresh when configTtlMs is 0', async () => {
      const protocol = makeProtocol({ configTtlMs: 0 })

      await protocol.getSupportedChains()
      await protocol.getSupportedChains()

      expect(bridgeApi.getBridgeConfig).toHaveBeenCalledTimes(2)
    })

    it('does not cache failures (next call retries)', async () => {
      const protocol = makeProtocol()
      bridgeApi.getBridgeConfig.mockRejectedValueOnce(new Error('network blip'))

      await expect(protocol.getSupportedChains()).rejects.toThrow()
      const chains = await protocol.getSupportedChains()

      expect(chains.length).toBeGreaterThan(0)
      expect(bridgeApi.getBridgeConfig).toHaveBeenCalledTimes(2)
    })

    it('caches the config and swap-token lists independently', async () => {
      const protocol = makeProtocol()

      await protocol.getSupportedTokens()
      await protocol.getSupportedTokens()

      expect(bridgeApi.getBridgeConfig).toHaveBeenCalledTimes(1)
      expect(bridgeApi.getSwapTokensConfig).toHaveBeenCalledTimes(1)
    })
  })
})
