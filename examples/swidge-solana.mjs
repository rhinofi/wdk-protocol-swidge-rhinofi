// Execute a cross-chain swap FROM Solana with a WDK wallet account, then track
// it to completion.
//
//   RHINO_API_KEY=<your key> WALLET_SEED="<mnemonic>" \
//   RECIPIENT=0x<destination-chain address> RPC_URL=<solana node> \
//     node examples/swidge-solana.mjs

import RhinofiProtocol from '@rhino.fi/wdk-protocol-swidge-rhinofi'
import { WalletAccountSolana } from '@tetherto/wdk-wallet-solana'

// Your source-chain WDK account. In a real app it comes from your WDK wallet
// manager; here we derive one from a seed (2nd arg is the SLIP-0010 path — on
// Solana every child segment must be hardened). To execute (not just quote),
// the account must be connected to a provider for its source chain so it can
// broadcast the deposit transaction.
const account = new WalletAccountSolana(process.env.WALLET_SEED, "0'/0'/0'", {
  provider: process.env.RPC_URL // a Solana node RPC endpoint
})

const swidge = new RhinofiProtocol(account, {
  apiKey: process.env.RHINO_API_KEY
})

// Submit the swap. Resolves once the source-chain deposit is broadcast; the
// cross-chain settlement then continues asynchronously. The source chain
// (Solana) is derived from the account, so only the destination `toChain` is
// set.
const result = await swidge.swidge({
  fromToken: 'USDT',
  toToken: 'USDC',
  toChain: 'BASE',
  fromTokenAmount: 100_000_000n, // 100 USDT (6 decimals)
  recipient: process.env.RECIPIENT // an address on the destination chain
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
