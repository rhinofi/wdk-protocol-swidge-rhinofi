# Changelog

## 1.3.0

### Minor Changes

- 376a3fd: `quoteSwidge()` and `swidge()` now also quote the source-chain network fee the wallet pays to make the deposit (and the token approval, when the allowance is short), simulated through the account. It is reported as a `network` fee on the source chain with `included: false`, in the token the wallet pays gas in, the chain's native token, or an ERC-4337 paymaster token.

### Patch Changes

- 3bfb3b3: Improved error handling for the WDK module, bundle approval + submit for erc4337 accounts
- Updated dependencies [3bfb3b3]
- Updated dependencies [376a3fd]
  - @rhino.fi/sdk@3.2.0

## 1.2.0

### Minor Changes

- 5c1d45e: Read chain state through the provider the wallet account is already configured with, rather than the RPC in rhino.fi's chain config, so reachability from the end user's device is under the integrator's control.

  Add an `onDepositSubmitted` hook to the per-call `swidge` config. It fires once the deposit has been handed off but before it is known to be on chain, distinguishing "no deposit was sent" (safe to retry) from "sent, not yet mined" (not safe to retry). For ERC-4337 accounts it carries the user operation hash; the settled transaction hash still arrives as the resolved result's `hash`.

### Patch Changes

- Updated dependencies [5c1d45e]
  - @rhino.fi/sdk@3.1.0

## 1.1.1

### Patch Changes

- Updated dependencies [c40b9a6]
  - @rhino.fi/sdk@3.0.0

## 1.1.0

### Minor Changes

- e4d44bf: Support Solana as a source chain: a `@tetherto/wdk-wallet-solana` account can now quote and execute swidges, with the deposit signed through the account.

### Patch Changes

- bbfbcf0: No functional changes.
- Updated dependencies [35ffa64]
- Updated dependencies [0f7d6e7]
- Updated dependencies [e4d44bf]
- Updated dependencies [5690559]
- Updated dependencies [cfa8c16]
  - @rhino.fi/sdk@2.0.0

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-15

### Fixed

- **Fee chains**: the destination-chain gas fee (`gasFee`) is now reported on the
  destination chain instead of being merged with source gas and labelled as the
  source chain. When the route swaps on the source chain, that source-swap gas
  (`sourceGasFee`) is reported separately on the source chain. The rhino.fi
  protocol fee (not tied to a chain) now carries no `chain`.

### Added

- **Quote reuse**: `quoteSwidge` now returns a committable rhino.fi quote on the
  result's `quote` field. Pass it back to `swidge(options, { quote })` to execute
  against that exact quote instead of re-fetching — so the amounts quoted are the
  amounts that execute, even if the market moves in between. `quoteSwidge` now
  fetches a committable user quote (previously a non-binding public quote).
- On-chain **Tron** source-chain support: signs the TRC-20 approval and deposit
  through the WDK `@tetherto/wdk-wallet-tron` account via the rhino.fi SDK's
  `getTronChainAdapterFromWdkAccount`. A Tron account's source chain is derived
  from the account being connected to a `TronWeb` client (Tron has no queryable
  chain id).

## [1.0.0-beta.1] - 2026-06-03

### Added

- Initial rhino.fi `SwidgeProtocol` implementation: `quoteSwidge`, `swidge`,
  `getSwidgeStatus`, `getSupportedChains`, `getSupportedTokens`.
- On-chain **EVM** source-chain support: signs through the WDK account via the
  rhino.fi SDK's `getEvmChainAdapterFromWdkAccount`
- Status and fee mapping from rhino.fi to the canonical WDK shapes.
- Typed error classes (`AccountRequiredError`, `ConfigurationError`,
  `UnsupportedChainError`, `UnsupportedTokenError`, `FeeLimitExceededError`,
  `UnknownOperationError`, `SwidgeExecutionError`).

### Notes

- Requires `@rhino.fi/sdk` with the additive `getEvmChainAdapterFromWdkAccount`
  adapter factory.

[1.0.0]: https://github.com/rhinofi/wdk-protocol-swidge-rhinofi/releases/tag/v1.0.0
[1.0.0-beta.1]: https://github.com/rhinofi/wdk-protocol-swidge-rhinofi/releases/tag/v1.0.0-beta.1
