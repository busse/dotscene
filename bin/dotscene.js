#!/usr/bin/env node
// The CLI is TypeScript, loaded by Node's type stripping — on by default from 22.18 and 23.6.
// A static import would resolve before any check could run, so guard, then import dynamically.
const [major = 0, minor = 0] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 18)) {
  process.stderr.write(
    `dotscene needs Node >=22.18, which strips types from the .ts sources it loads. ` +
      `This is Node ${process.versions.node}.\n`,
  )
  process.exit(1)
}

const { main } = await import('../src/cli.ts')

await main(process.argv.slice(2))
