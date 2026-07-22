# Changelog

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
