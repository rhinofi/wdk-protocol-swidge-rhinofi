// Integration tests: exercise the protocol against a real wallet account
// connected to a live (hardhat) blockchain node, rather than the plain-object
// mocks used by the unit tests. This proves the parts the unit tests can only
// fake — that a real `WalletAccountEvm` passes the `instanceof` execution gate,
// and that the source chain is read from the account's live ethers provider.
//
// The rhino.fi HTTP SDK is still stubbed: its contracts are not deployed on the
// local node, so the integration boundary is the wallet <-> provider <-> module
// seam. The node is started/stopped per file (see globalSetup/globalTeardown).

import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RPC_PORT = 18545
const RPC_URL = `http://127.0.0.1:${RPC_PORT}`
const TEST_MNEMONIC = 'test test test test test test test test test test test junk'
const HARDHAT_CHAIN_ID = 42161 // Arbitrum, per hardhat.config.cjs

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// --- rhino.fi SDK mock ----------------------------------------------------

const DUMMY_CONFIG = {
  ARBITRUM: {
    name: 'Arbitrum',
    type: 'EVM',
    networkId: '42161',
    rpc: RPC_URL,
    contractAddress: '0x10417734001162Ea139e8b044DFe28DbB8B28ad0',
    nativeTokenName: 'ETH',
    nativeTokenDecimals: 18,
    status: 'enabled',
    tokens: {
      USDT: { token: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
      DAI: { token: 'DAI', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18 }
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
    tokens: { DAI: { token: 'DAI', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18 } }
  }
}

const bridgeApi = {
  getBridgeConfig: jest.fn(),
  getSwapTokensConfig: jest.fn(),
  getSwapPublicQuote: jest.fn(),
  getBridgeStatus: jest.fn()
}
const prepareBridge = jest.fn()
const RhinoSdk = jest.fn(() => ({ api: { bridge: bridgeApi }, prepareBridge }))

jest.unstable_mockModule('@rhino.fi/sdk', () => ({ RhinoSdk }))

const { default: RhinofiProtocol } = await import('../../index.js')
const { WalletAccountEvm } = await import('@tetherto/wdk-wallet-evm')

// --- hardhat node lifecycle ----------------------------------------------

let nodeProcess

const waitForRpc = async (timeoutMs = 60000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] })
      })
      if (res.ok) {
        const { result } = await res.json()
        if (result) return Number(result)
      }
    } catch {
      // node not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('hardhat node did not become ready in time')
}

beforeAll(async () => {
  nodeProcess = spawn(
    join(ROOT, 'node_modules', '.bin', 'hardhat'),
    ['node', '--hostname', '127.0.0.1', '--port', String(RPC_PORT)],
    { cwd: ROOT, stdio: 'ignore' }
  )
  const chainId = await waitForRpc()
  expect(chainId).toBe(HARDHAT_CHAIN_ID)
}, 90000)

afterAll(() => {
  if (nodeProcess) nodeProcess.kill('SIGTERM')
})

beforeEach(() => {
  jest.clearAllMocks()
  bridgeApi.getBridgeConfig.mockResolvedValue({ data: DUMMY_CONFIG })
  bridgeApi.getSwapTokensConfig.mockResolvedValue({ data: {} })
})

// A real signing account derived from the test mnemonic, connected to the node.
const makeAccount = () =>
  new WalletAccountEvm(TEST_MNEMONIC, "0'/0/0", { provider: RPC_URL, chainId: HARDHAT_CHAIN_ID })

const makeProtocol = (config = {}) =>
  new RhinofiProtocol(makeAccount(), { apiKey: 'dummy-api-key', ...config })

// --- Tests ----------------------------------------------------------------

describe('integration: real account against a live node', () => {
  it('derives the source chain from the account live provider', async () => {
    bridgeApi.getSwapPublicQuote.mockResolvedValue({
      data: {
        chainIn: 'ARBITRUM',
        chainOut: 'BASE',
        payAmount: '1',
        receiveAmount: '0.99',
        minReceiveAmount: '0.98',
        fees: { fee: '0.01', gasFee: '0.005', platformFee: '0.003', percentageFee: '0.002' },
        tokenIn: 'DAI',
        tokenOut: 'DAI',
        _tag: 'bridgeSwap'
      }
    })

    const protocol = makeProtocol()
    await protocol.quoteSwidge({ fromToken: 'DAI', toToken: 'DAI', toChain: 'BASE', fromTokenAmount: 1000000000000000000n })

    // chainIn was resolved from the node's chain id (42161 -> ARBITRUM), read
    // through the real WalletAccountEvm provider, not from any explicit option.
    const [args] = bridgeApi.getSwapPublicQuote.mock.calls[0]
    expect(args.chainIn).toBe('ARBITRUM')
    expect(args.chainOut).toBe('BASE')
  })

  it('preserves 18-decimal precision through the public quote', async () => {
    bridgeApi.getSwapPublicQuote.mockResolvedValue({
      data: {
        chainIn: 'ARBITRUM',
        chainOut: 'BASE',
        payAmount: '1234.123456789012345678',
        receiveAmount: '1230.000000000000000001',
        minReceiveAmount: '1229.000000000000000000',
        fees: { fee: '0.01', gasFee: '0.005', platformFee: '0.003', percentageFee: '0.002' },
        tokenIn: 'DAI',
        tokenOut: 'DAI',
        _tag: 'bridgeSwap'
      }
    })

    const protocol = makeProtocol()
    const quote = await protocol.quoteSwidge({
      fromToken: 'DAI',
      toToken: 'DAI',
      toChain: 'BASE',
      fromTokenAmount: 1234123456789012345678n
    })

    expect(quote.fromTokenAmount).toBe(1234123456789012345678n)
    expect(quote.toTokenAmount).toBe(1230000000000000000001n)
  })

  it('lets a real signing account pass the execution gate', async () => {
    // prepareBridge erroring proves we got *past* the instanceof full-account
    // gate (a read-only / missing account would throw AccountRequiredError
    // before prepareBridge is ever called).
    prepareBridge.mockResolvedValue({ type: 'error', error: { _tag: 'QuoteRejected' } })

    const protocol = makeProtocol()
    await expect(
      protocol.swidge({ fromToken: 'DAI', toToken: 'DAI', toChain: 'BASE', fromTokenAmount: 1000000000000000000n })
    ).rejects.toThrow('rhino.fi failed to prepare the swidge')
    expect(prepareBridge).toHaveBeenCalledTimes(1)
  })
})
