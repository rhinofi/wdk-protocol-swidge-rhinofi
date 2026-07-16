# @rhino.fi/wdk-protocol-swidge-rhinofi

A [Tether WDK](https://docs.wdk.tether.io) `SwidgeProtocol` module that performs
cross-chain swaps and bridges through the [rhino.fi](https://rhino.fi) protocol.

[![Powered by WDK](https://img.shields.io/badge/Powered%20by-WDK-5A4FFF)](https://docs.wdk.tether.io)

## Installation

```bash
npm install @rhino.fi/wdk-protocol-swidge-rhinofi @tetherto/wdk-wallet-evm
# add the wallet module for each source ecosystem you sign from, e.g. Tron:
npm install @tetherto/wdk-wallet-tron
```

## Usage

```javascript
import RhinofiProtocol from '@rhino.fi/wdk-protocol-swidge-rhinofi'

const rhinofi = new RhinofiProtocol(account, {
  apiKey: process.env.RHINO_API_KEY, // required for every call (the SDK authenticates each request)
  maxNetworkFeeBps: 50,              // optional fee guards (basis points of input)
  maxProtocolFeeBps: 30
})

// Discover.
const chains = await rhinofi.getSupportedChains()
const tokens = await rhinofi.getSupportedTokens({ fromChain: 'ARBITRUM' })

// Quote. The source chain is taken from `account` (see note below).
const options = {
  fromToken: 'USDT',
  toToken: 'USDC',
  toChain: 'BASE',
  fromTokenAmount: 1_000_000n // exact-in; use `toTokenAmount` for exact-out
}
const quote = await rhinofi.quoteSwidge(options)

// Execute. Pass `quote.quote` to bridge against the exact quote shown to the
// user instead of re-fetching — so the amounts can't move in between. Omit it to
// fetch a fresh quote at execution time. Returns once the source deposit is
// broadcast.
const result = await rhinofi.swidge(options, { quote: quote.quote })

// Poll to completion.
const status = await rhinofi.getSwidgeStatus(result.id)
console.log(status.status) // 'pending' | 'completed' | …
```


## Configuration

| Option | Type | Description |
| --- | --- | --- |
| `apiKey` | `string` | rhino.fi API key. **Required for every call** — the SDK authenticates each request (even quotes). |
| `apiBaseUrl` | `string` | Override the rhino.fi API base URL (defaults to mainnet). **Use `https://`** — an `http://` URL 302-redirects and breaks the SDK's auth request. |
| `maxNetworkFeeBps` | `number \| bigint` | Reject execution if the network fee exceeds this many basis points of the input. |
| `maxProtocolFeeBps` | `number \| bigint` | Reject execution if the protocol fee exceeds this many basis points of the input. |
| `configTtlMs` | `number` | How long to cache the rhino.fi chain/token config (default `60000` = 60s). Bursts of calls (e.g. quoting on every keystroke) reuse one fetch; set to `0` to always fetch fresh. |

Per-call config passed to `swidge(options, config)` overrides the constructor config.

## Execution model

`swidge()` submits the source-chain deposit (after any required ERC-20 approval)
and resolves as soon as that transaction is broadcast, returning
`{ id, hash, … }`. The cross-chain settlement continues in the background; track
it with `getSwidgeStatus(id)`. The returned `id` is the rhino.fi quote/commitment
id.

## Caching

The rhino.fi chain config and swap-token lists are cached for `configTtlMs`
(default 60s), so they're fetched once and reused across calls rather than
re-requested each time. Set `configTtlMs` to `0` to always fetch fresh.

## Supported chains & tokens

`getSupportedChains()` / `getSupportedTokens()` reflect the live rhino.fi config.
Any rhino.fi chain is a valid **destination**. Supported **source** chains (which
sign the deposit) are those where the WDK provides a wallet module and rhino.fi
provides an on-chain adapter:

| Ecosystem | As source | Notes |
| --- | --- | --- |
| EVM | ✅ Supported | `@tetherto/wdk-wallet-evm` (incl. ERC-4337); signs via `account.sendTransaction` |
| Tron | ✅ Supported | `@tetherto/wdk-wallet-tron`; signs the TRC-20 approval + deposit via `account.sendTransaction` |
| Solana | 🔜 Planned | |
| TON | 🔜 Planned |  |

## Status mapping

rhino.fi bridge states are mapped to the canonical `SwidgeStatus`:

| rhino.fi state | `SwidgeStatus` |
| --- | --- |
| `PENDING`, `PENDING_CONFIRMATION`, `DEPOSIT_ACCEPTED`, `ACCEPTED` | `pending` |
| `EXECUTED` | `completed` |
| `SWAP_FAILED` | `refund-pending` |
| `SWAP_FAILED_REFUNDED`, `DEPOSIT_RECEIVED_AFTER_GRACE_PERIOD_REFUNDED` | `refunded` |
| `DEPOSIT_RECEIVED_AFTER_GRACE_PERIOD` | `action-required` |
| `FAILED` | `failed` |
| `CANCELLED` | `cancelled` |

## Fee mapping

| rhino.fi quote fee | `SwidgeFee.type` | Legacy mapping |
| --- | --- | --- |
| `gasFee` + `sourceGasFee` | `network` | `fee` |
| `fee` − network (i.e. `platformFee` + `percentageFee`) | `protocol` | `bridgeFee` |

Fees are itemised in `SwidgeFee[]` and denominated in the input token. The
`network` and `protocol` amounts are disjoint and sum to the quote's total `fee`.

## Errors

All errors extend `RhinofiProtocolError`:

- `AccountRequiredError` — `swidge()` called without a full (signing) account.
- `ConfigurationError` — missing required config (e.g. `apiKey`).
- `RhinofiProtocolError` — invalid call (e.g. source chain not derivable from the account, or both/neither of `fromTokenAmount`/`toTokenAmount`).
- `UnsupportedChainError` / `UnsupportedTokenError` — unknown chain/token, or an unsupported source ecosystem.
- `FeeLimitExceededError` — quoted fees exceed `maxNetworkFeeBps` / `maxProtocolFeeBps`.
- `UnknownOperationError` — `getSwidgeStatus()` called with an unknown id.
- `SwidgeExecutionError` — the underlying rhino.fi quote/execution failed. Carries a `.code` (e.g. `InsufficientBalance`, `NegativeReceiveAmount`, `TokenApprovalFailed`) for programmatic handling, and the SDK error as `.cause`.

## API Reference

### `new RhinofiProtocol(account?, config?)`
### Methods

- `quoteSwidge(options)` — non-binding cross-chain quote.
- `swidge(options, config?)` — execute; returns once the deposit is broadcast.
- `getSwidgeStatus(id, options?)` — current status of an operation.
- `getSupportedChains()` / `getSupportedTokens(options?)` — discovery.

Inherited legacy delegations `swap` / `quoteSwap` / `bridge` / `quoteBridge`
map onto `swidge` / `quoteSwidge`. Their option shapes carry no source chain, so
it must be derivable from the account (an EVM account connected to a provider,
or a Tron account connected to a `TronWeb` client); otherwise they throw
`RhinofiProtocolError`.

## Examples

Runnable examples live in [`examples/`](./examples):

- [`quote.mjs`](./examples/quote.mjs) — discover chains/tokens and fetch a quote (read-only account connected to an RPC; no signing key).
- [`swidge.mjs`](./examples/swidge.mjs) — execute a cross-chain swap with a WDK account and poll it to completion.

```bash
RHINO_API_KEY=… RPC_URL=<arbitrum rpc> node examples/quote.mjs
```

## Development

```bash
npm install
npm test            # unit tests (rhino.fi SDK is mocked)
npm run test:coverage
npm run lint
npm run build:types # generate ./types from JSDoc
```

## Security

See [SECURITY.md](./SECURITY.md). This module signs through the WDK account's
`sendTransaction` — it never reads, logs, or persists private keys, seed phrases,
or raw signed transactions. Supply the `apiKey` via secret management and use
trusted RPC endpoints.

## License

Apache-2.0
