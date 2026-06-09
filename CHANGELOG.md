# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0-beta.1]: https://github.com/rhinofi/wdk-protocol-swidge-rhinofi/releases/tag/v1.0.0-beta.1
