/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: '0.8.24',
  networks: {
    hardhat: {
      chainId: 42161,
      accounts: {
        mnemonic: 'test test test test test test test test test test test junk',
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
        accountsBalance: '10000000000000000000000'
      },
      mining: {
        auto: true,
        interval: 0
      }
    }
  }
}
