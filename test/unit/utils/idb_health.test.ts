import assert from 'assert'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { isIDBInstalled, probeIdb } from '../../../src/utils/cli/idb/idb-helper.js'

async function run() {
  const binDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-idb-health-'))
  const idbPath = path.join(binDir, 'idb')
  const python3Path = path.join(binDir, 'python3')
  const pythonPath = path.join(binDir, 'python')
  const pythonLog = path.join(binDir, 'python.log')
  const originalIdbPath = process.env.MCP_IDB_PATH
  const originalPath = process.env.PATH

  try {
    await fs.writeFile(idbPath, `#!/bin/sh
if [ "$1" = "list-targets" ] && [ "$2" = "--json" ]; then
  printf '{"targets":[]}\n'
  exit 0
fi
if [ "$1" = "--version" ]; then
  printf 'idb: error: unrecognized arguments: --version\n' >&2
  exit 2
fi
exit 0
`, { mode: 0o755 })

    await fs.writeFile(python3Path, `#!/bin/sh
printf 'python3 called\\n' >> "${pythonLog}"
exit 0
`, { mode: 0o755 })

    await fs.writeFile(pythonPath, `#!/bin/sh
printf 'python called\\n' >> "${pythonLog}"
exit 0
`, { mode: 0o755 })

    process.env.MCP_IDB_PATH = idbPath
    process.env.PATH = `${binDir}${path.delimiter}${originalPath || ''}`

    const probe = probeIdb(idbPath)
    assert.strictEqual(probe.ok, true)
    assert.strictEqual(isIDBInstalled(), true)
    assert(probe.raw === null || typeof probe.raw === 'string')

    await fs.rm(pythonLog, { force: true }).catch(() => {})
    const failedIdbPath = path.join(binDir, 'idb-failing')
    await fs.writeFile(failedIdbPath, `#!/bin/sh
if [ "$1" = "list-targets" ] && [ "$2" = "--json" ]; then
  printf 'idb unavailable\\n' >&2
  exit 2
fi
exit 2
`, { mode: 0o755 })

    const failureProbe = probeIdb(failedIdbPath)
    assert.strictEqual(failureProbe.ok, false)
    assert.strictEqual(await fs.readFile(pythonLog, 'utf8').catch(() => ''), '')

    console.log('idb health probe test passed')
  } finally {
    if (originalIdbPath === undefined) delete process.env.MCP_IDB_PATH
    else process.env.MCP_IDB_PATH = originalIdbPath

    if (originalPath === undefined) delete process.env.PATH
    else process.env.PATH = originalPath

    await fs.rm(binDir, { recursive: true, force: true }).catch(() => {})
  }
}

run().catch((error) => { console.error(error); process.exit(1) })
