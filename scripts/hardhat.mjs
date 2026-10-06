import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const hardhatRoot = dirname(require.resolve('hardhat/package.json'))
const { main } = await import(pathToFileURL(join(hardhatRoot, 'dist/src/internal/cli/main.js')))

await main(process.argv.slice(2), {
  registerTsx: false,
  // Hardhat's node_modules lookup does not recognize a local Yarn PnP package.
  allowNonlocalHardhatInstallation: Boolean(process.versions.pnp)
})
