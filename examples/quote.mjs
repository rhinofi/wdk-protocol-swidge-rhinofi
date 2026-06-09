// Discover supported routes and fetch a (non-binding) cross-chain swap quote.
//
// Discovery needs only an API key. Quoting also needs the source chain, which
// the module reads from the account's provider — so a read-only account
// connected to an RPC is enough (no signing key required).
//
//   RHINO_API_KEY=<your key> RPC_URL=<arbitrum rpc> node examples/quote.mjs

import RhinofiProtocol from '@rhino.fi/wdk-protocol-swidge-rhinofi'
import { WalletAccountReadOnlyEvm } from '@tetherto/wdk-wallet-evm'

const account = new WalletAccountReadOnlyEvm('0x0000000000000000000000000000000000000000', {
  provider: process.env.RPC_URL // an RPC endpoint for the source chain
})

const swidge = new RhinofiProtocol(account, {
  apiKey: process.env.RHINO_API_KEY
})

const chains = await swidge.getSupportedChains()
console.log('Supported chains:', chains.map((chain) => chain.id).join(', '))

const tokens = await swidge.getSupportedTokens({ fromChain: 'ARBITRUM' })
console.log('Tokens on Arbitrum:', tokens.map((token) => token.symbol).join(', '))

const quote = await swidge.quoteSwidge({
  fromToken: 'USDT',
  toToken: 'USDC',
  toChain: 'BASE',
  fromTokenAmount: 100_000_000n // 100 USDT (6 decimals)
})

console.log(`Receive ~${quote.toTokenAmount} USDC (minimum ${quote.toTokenAmountMin})`)
for (const fee of quote.fees) {
  console.log(`  ${fee.type} fee: ${fee.amount} ${fee.token}`)
}
