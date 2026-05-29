import assert from 'assert'
import { ToolsInteract } from '../../../src/interact/index.js'
import { ToolsObserve } from '../../../src/observe/index.js'

type UiTree = {
  device: { platform: 'android', id: string, osVersion: string, model: string, simulator: boolean }
  screen: string
  resolution: { width: number, height: number }
  elements: Array<{ text: string, type: string, bounds: number[], visible: boolean }>
  snapshot_revision: number
  captured_at_ms: number
}

function makeTree(screen: string, revision: number): UiTree {
  return {
    device: { platform: 'android', id: 'mock', osVersion: '14', model: 'Pixel', simulator: true },
    screen,
    resolution: { width: 1080, height: 2400 },
    elements: [{ text: screen, type: 'TextView', bounds: [0, 0, 100, 40], visible: true }],
    snapshot_revision: revision,
    captured_at_ms: 1000 + revision
  }
}

async function runScenario({
  snapshots,
  expectedChange,
  timeoutMs,
  stabilityWindowMs,
  stepMs
}: {
  snapshots: UiTree[]
  expectedChange: 'hierarchy_diff' | 'text_change' | 'state_change'
  timeoutMs: number
  stabilityWindowMs?: number
  stepMs: number
}) {
  const originalGetUITreeHandler = (ToolsObserve as any).getUITreeHandler
  const originalSetTimeout = globalThis.setTimeout
  const originalDateNow = Date.now
  let now = 0
  let calls = 0
  const delays: number[] = []

  try {
    ;(Date as any).now = () => now
    ;(globalThis as any).setTimeout = (callback: (...args: any[]) => void, delay?: number) => {
      delays.push(typeof delay === 'number' ? delay : 0)
      now += stepMs
      callback()
      return 0
    }

    ;(ToolsObserve as any).getUITreeHandler = async () => {
      calls++
      return snapshots[Math.min(calls - 1, snapshots.length - 1)]
    }

    const result = await ToolsInteract.waitForUIChangeHandler({
      platform: 'android',
      deviceId: 'mock',
      expected_change: expectedChange,
      timeout_ms: timeoutMs,
      stability_window_ms: stabilityWindowMs
    })

    return { result, calls, delays }
  } finally {
    ;(ToolsObserve as any).getUITreeHandler = originalGetUITreeHandler
    ;(globalThis as any).setTimeout = originalSetTimeout
    ;(Date as any).now = originalDateNow
  }
}

async function run() {
  const success = await runScenario({
    snapshots: [makeTree('Loading', 1), makeTree('Loaded', 2)],
    expectedChange: 'text_change',
    timeoutMs: 1500,
    stabilityWindowMs: 1,
    stepMs: 1
  })

  assert.strictEqual(success.result.success, true)
  assert.strictEqual(success.result.observed_change, 'text_change')
  assert.strictEqual(success.result.snapshot_revision, 2)
  assert.strictEqual(success.result.timeout, false)

  const timeout = await runScenario({
    snapshots: [makeTree('Static', 9)],
    expectedChange: 'state_change',
    timeoutMs: 5,
    stabilityWindowMs: 1,
    stepMs: 1
  })

  assert.strictEqual(timeout.result.success, false)
  assert.strictEqual(timeout.result.observed_change, null)
  assert.strictEqual(timeout.result.timeout, true)

  const defaultWindow = await runScenario({
    snapshots: [makeTree('Loading', 1), makeTree('Loaded', 2), makeTree('Loaded', 3), makeTree('Loaded', 4)],
    expectedChange: 'text_change',
    timeoutMs: 2000,
    stepMs: 260
  })

  assert.strictEqual(defaultWindow.result.success, true)
  assert.strictEqual(defaultWindow.calls, 4)
  assert.deepStrictEqual(defaultWindow.delays, [300, 300, 300])

  const resetWindow = await runScenario({
    snapshots: [makeTree('Loading', 1), makeTree('Loaded', 2), makeTree('Loaded-again', 3), makeTree('Loaded-again', 4), makeTree('Loaded-again', 5)],
    expectedChange: 'text_change',
    timeoutMs: 2000,
    stabilityWindowMs: 300,
    stepMs: 150
  })

  assert.strictEqual(resetWindow.result.success, true)
  assert.strictEqual(resetWindow.calls, 5)

  console.log('wait_for_ui_change tests passed')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
