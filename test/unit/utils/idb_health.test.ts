import assert from 'assert'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { isIDBInstalled, probeIdb } from '../../../src/utils/cli/idb/idb-helper.js'

async function run() {
  const binDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-idb-health-'))
  const idbPath = path.join(binDir, 'idb')
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

    process.env.MCP_IDB_PATH = idbPath
    process.env.PATH = `${binDir}${path.delimiter}${originalPath || ''}`

    const probe = probeIdb(idbPath)
    assert.strictEqual(probe.ok, true)
    assert.strictEqual(isIDBInstalled(), true)
    assert(probe.raw === null || typeof probe.raw === 'string')

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
