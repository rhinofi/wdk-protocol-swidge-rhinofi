# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities responsibly. **Do not open a public
GitHub issue for security reports.**

Email **security@rhino.fi** with a description of the issue, the affected
version, and steps to reproduce. You will receive an acknowledgement, and we
will keep you informed of the fix and disclosure timeline.

## Key material

This module **never accesses private keys**. To perform the on-chain deposit it
hands the WDK account to the rhino.fi SDK's account-based chain adapter
(`getEvmChainAdapterFromWdkAccount`), which encodes the approval/deposit
transactions and broadcasts them through `account.sendTransaction` — the account
signs and broadcasts, and the module only ever sees the resulting transaction
hash. It does not read `account.keyPair`, and never logs or persists private
keys, seed phrases, or raw signed transactions.

Quotes and discovery require no signing at all.

## Operational guidance

- Treat the rhino.fi `apiKey` as a secret; supply it via configuration/secret
  management, not source control.
- Use trusted RPC endpoints for the source chain.
- Set `maxNetworkFeeBps` / `maxProtocolFeeBps` to bound the fees a swidge may
  incur.
