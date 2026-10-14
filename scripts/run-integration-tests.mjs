import jest from 'jest'

await jest.run(['--runInBand', 'tests/integration', ...process.argv.slice(2)])
