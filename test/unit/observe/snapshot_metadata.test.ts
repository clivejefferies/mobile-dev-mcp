import assert from 'assert'
import { deriveSnapshotMetadata, resetSnapshotMetadataForTests } from '../../../src/observe/snapshot-metadata.js'

async function run() {
  console.log('Starting snapshot_metadata unit tests...')

  resetSnapshotMetadataForTests()

  const deviceKey = 'android:mock'
  const first = deriveSnapshotMetadata(deviceKey, {
    screen: 'Home',
    resolution: { width: 100, height: 200 },
    elements: [
      {
        text: 'Alpha',
        contentDescription: null,
        resourceId: 'row_1',
        type: 'TextView',
        clickable: false,
        enabled: true,
        visible: true,
        bounds: [0, 0, 10, 10],
        state: null,
        stable_id: 'stable-row'
      }
    ]
  }, 'ui_tree')

  assert.strictEqual(first.snapshot_revision, 1)
  assert.strictEqual(first.snapshot_delta, null)

  const second = deriveSnapshotMetadata(deviceKey, {
    screen: 'Home',
    resolution: { width: 100, height: 200 },
    elements: [
      {
        text: 'Beta',
        contentDescription: null,
        resourceId: 'row_1',
        type: 'TextView',
        clickable: false,
        enabled: true,
        visible: true,
        bounds: [0, 0, 10, 10],
        state: null,
        stable_id: 'stable-row'
      }
    ]
  }, 'ui_tree')

  assert.strictEqual(second.snapshot_revision, 2)
  assert.deepStrictEqual(second.snapshot_delta, {
    previous_snapshot_revision: 1,
    added_elements: 0,
    removed_elements: 0,
    mutated_elements: 1,
    total_elements: 1
  })

  resetSnapshotMetadataForTests()
  console.log('snapshot_metadata unit tests passed')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
