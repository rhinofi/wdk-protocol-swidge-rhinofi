// Execute a cross-chain swap with a WDK wallet account, then track it to
// completion.
//
//   RHINO_API_KEY=<your key> WALLET_SEED="<mnemonic>" RPC_URL=<source-chain rpc> \
//     node examples/swidge.mjs

import RhinofiProtocol from '@rhino.fi/wdk-protocol-swidge-rhinofi'
import { WalletAccountEvm } from '@tetherto/wdk-wallet-evm'

// Your source-chain WDK account. In a real app it comes from your WDK wallet
// manager; here we derive one from a seed (2nd arg is the BIP-44 path suffix).
// To execute (not just quote), the account must be connected to a provider for
// its source chain so it can broadcast the deposit transaction.
const account = new WalletAccountEvm(process.env.WALLET_SEED, "0'/0/0", {
  provider: process.env.RPC_URL // an RPC endpoint for the source chain
})

const swidge = new RhinofiProtocol(account, {
  apiKey: process.env.RHINO_API_KEY
})

// Submit the swap. Resolves once the source-chain deposit is broadcast; the
// cross-chain settlement then continues asynchronously. The source chain is
// derived from the account's provider, so only the destination `toChain` is set.
const result = await swidge.swidge({
  fromToken: 'USDT',
  toToken: 'USDC',
  toChain: 'BASE',
  fromTokenAmount: 100_000_000n // 100 USDT; recipient defaults to the account address
})

console.log(`Submitted swidge ${result.id} (deposit tx ${result.hash})`)

// Poll until the operation reaches a terminal state.
const TERMINAL = ['completed', 'failed', 'refunded', 'cancelled', 'expired']
let status
do {
  await new Promise((resolve) => setTimeout(resolve, 5000))
  status = await swidge.getSwidgeStatus(result.id)
  console.log('Status:', status.status)
} while (!TERMINAL.includes(status.status))
