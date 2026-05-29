import assert from 'assert'
import { ToolsInteract } from '../../../src/interact/index.js'

async function run() {
  console.log('Starting subtree_collection unit tests...')

  const elements = [
    { text: 'Root', resourceId: 'root-node', stable_id: 'root-stable', bounds: [0, 0, 100, 100], visible: true, enabled: true, clickable: true },
    { text: 'Numeric child', parentId: '0', stable_id: 'numeric-child', bounds: [0, 0, 50, 50], visible: true, enabled: true, clickable: true },
    { text: 'Resource child', parentId: 'root-node', stable_id: 'resource-child', bounds: [0, 50, 50, 100], visible: true, enabled: true, clickable: true },
    { text: 'Stable child', parentId: 'root-stable', stable_id: 'stable-child', bounds: [50, 0, 100, 50], visible: true, enabled: true, clickable: true },
    { text: 'Grandchild', parentId: 'resource-child', bounds: [50, 50, 100, 100], visible: true, enabled: true, clickable: true }
  ] as any[]

  const indices = (ToolsInteract as any)._collectSubtreeIndices(elements, 0)
  assert.deepStrictEqual(indices, [0, 1, 2, 3, 4])

  console.log('subtree_collection unit tests passed')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
