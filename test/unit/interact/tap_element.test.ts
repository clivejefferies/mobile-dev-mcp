import assert from 'assert'
import { ToolsInteract } from '../../../src/interact/index.js'
import * as Observe from '../../../src/observe/index.js'

async function run() {
  console.log('Starting tap_element unit tests...')
  const originalGetUITreeHandler = (Observe as any).ToolsObserve.getUITreeHandler
  const originalGetScreenFingerprintHandler = (Observe as any).ToolsObserve.getScreenFingerprintHandler
  const originalTapHandler = (ToolsInteract as any).tapHandler
  const originalComputeElementId = (ToolsInteract as any)._computeElementId
  ;(ToolsInteract as any)._resetResolvedUiElementsForTests()

  try {
    let fingerprintCalls = 0
    ;(Observe as any).ToolsObserve.getScreenFingerprintHandler = async () => {
      fingerprintCalls++
      return { fingerprint: 'fp_mock' }
    }

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device' },
      elements: [
        { text: 'Submit', resourceId: 'btn_submit', bounds: [0, 0, 20, 20], visible: true, enabled: true, clickable: true }
      ]
    })

    const waitSuccess = await ToolsInteract.waitForUIHandler({
      selector: { text: 'Submit' },
      condition: 'exists',
      timeout_ms: 200,
      poll_interval_ms: 50,
      platform: 'android'
    })
    assert.strictEqual(waitSuccess.status, 'success')
    const successElementId = waitSuccess.element.elementId

    let tapped: { x: number, y: number, platform?: string, deviceId?: string } | null = null
    ;(ToolsInteract as any).tapHandler = async ({ platform, x, y, deviceId }: any) => {
      tapped = { platform, x, y, deviceId }
      return { success: true, device: { platform: platform || 'android', id: deviceId || 'mock-device' }, x, y }
    }

    const tapSuccess = await ToolsInteract.tapElementHandler({ elementId: successElementId })
    assert.strictEqual(tapSuccess.success, true)
    assert.strictEqual(tapSuccess.action_type, 'tap_element')
    assert.strictEqual(tapSuccess.target.selector?.elementId, successElementId)
    assert.strictEqual(tapSuccess.target.resolved?.elementId, successElementId)
    assert.strictEqual(tapSuccess.ui_fingerprint_before, 'fp_mock')
    assert.strictEqual(tapSuccess.ui_fingerprint_after, 'fp_mock')
    assert.deepStrictEqual(tapped, { platform: 'android', x: 10, y: 10, deviceId: 'mock-device' })

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device' },
      elements: [
        { text: 'Hidden', resourceId: 'btn_hidden', bounds: [0, 0, 20, 20], visible: false, enabled: true, clickable: true }
      ]
    })
    const waitHidden = await ToolsInteract.waitForUIHandler({
      selector: { text: 'Hidden' },
      condition: 'exists',
      timeout_ms: 200,
      poll_interval_ms: 50,
      platform: 'android'
    })
    const hiddenResult = await ToolsInteract.tapElementHandler({ elementId: waitHidden.element.elementId })
    assert.strictEqual(hiddenResult.success, false)
    assert.strictEqual(hiddenResult.failure_code, 'ELEMENT_NOT_INTERACTABLE')
    assert.strictEqual(hiddenResult.retryable, true)

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device' },
      elements: [
        { text: 'Disabled', resourceId: 'btn_disabled', bounds: [0, 0, 20, 20], visible: true, enabled: false, clickable: true }
      ]
    })
    const waitDisabled = await ToolsInteract.waitForUIHandler({
      selector: { text: 'Disabled' },
      condition: 'exists',
      timeout_ms: 200,
      poll_interval_ms: 50,
      platform: 'android'
    })
    const disabledResult = await ToolsInteract.tapElementHandler({ elementId: waitDisabled.element.elementId })
    assert.strictEqual(disabledResult.success, false)
    assert.strictEqual(disabledResult.failure_code, 'ELEMENT_NOT_INTERACTABLE')

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device' },
      elements: [
        { text: 'Plain label', resourceId: 'txt_plain', bounds: [0, 0, 20, 20], visible: true, enabled: true, clickable: false }
      ]
    })
    const waitPlain = await ToolsInteract.waitForUIHandler({
      selector: { text: 'Plain label' },
      condition: 'exists',
      timeout_ms: 200,
      poll_interval_ms: 50,
      platform: 'android'
    })
    const plainResult = await ToolsInteract.tapElementHandler({ elementId: waitPlain.element.elementId })
    assert.strictEqual(plainResult.success, false)
    assert.strictEqual(plainResult.failure_code, 'ELEMENT_NOT_INTERACTABLE')

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'ios', id: 'ios-mock' },
      elements: [
        {
          text: 'Semantic tap',
          resourceId: 'ios_semantic_tap',
          bounds: [10, 10, 30, 30],
          visible: true,
          enabled: true,
          clickable: false,
          semantic: {
            is_clickable: true,
            is_container: false,
            supported_actions: ['tap']
          }
        }
      ]
    })
    const iosSemanticWait = await ToolsInteract.waitForUIHandler({
      selector: { text: 'Semantic tap' },
      condition: 'exists',
      timeout_ms: 200,
      poll_interval_ms: 50,
      platform: 'ios'
    })
    const iosSemanticTap = await ToolsInteract.tapElementHandler({ elementId: iosSemanticWait.element.elementId })
    assert.strictEqual(iosSemanticTap.success, true)
    assert.strictEqual(iosSemanticTap.target.resolved?.elementId, iosSemanticWait.element.elementId)
    assert.deepStrictEqual(tapped, { platform: 'ios', x: 20, y: 20, deviceId: 'ios-mock' })

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device' },
      elements: [
        { text: 'Stable target', resourceId: 'btn_stable', bounds: [0, 0, 20, 20], visible: true, enabled: true, clickable: true, stable_id: 'stable-1' }
      ]
    })
    const waitStable = await ToolsInteract.waitForUIHandler({
      selector: { text: 'Stable target' },
      condition: 'exists',
      timeout_ms: 200,
      poll_interval_ms: 50,
      platform: 'android'
    })

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device' },
      elements: [
        { text: 'Stable target', resourceId: 'btn_stable', bounds: [0, 0, 20, 20], visible: true, enabled: true, clickable: true, stable_id: 'stable-2' }
      ]
    })
    const stableMismatchResult = await ToolsInteract.tapElementHandler({ elementId: waitStable.element.elementId })
    assert.strictEqual(stableMismatchResult.success, false)
    assert.strictEqual(stableMismatchResult.failure_code, 'STALE_REFERENCE')

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device' },
      elements: []
    })
    const notFoundResult = await ToolsInteract.tapElementHandler({ elementId: successElementId })
    assert.strictEqual(notFoundResult.success, false)
    assert.strictEqual(notFoundResult.failure_code, 'STALE_REFERENCE')

    ;(ToolsInteract as any)._resetResolvedUiElementsForTests()
    const targetIndex = 25
    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device' },
      elements: Array.from({ length: 50 }, (_, index) => ({
        text: index === targetIndex ? 'Indexed target' : `Filler ${index}`,
        resourceId: index === targetIndex ? 'btn_indexed_target' : `btn_filler_${index}`,
        bounds: [index, index, index + 20, index + 20],
        visible: true,
        enabled: true,
        clickable: true
      }))
    })
    const indexedWait = await ToolsInteract.waitForUIHandler({
      selector: { text: 'Indexed target' },
      condition: 'exists',
      timeout_ms: 200,
      poll_interval_ms: 50,
      platform: 'android'
    })
    assert.strictEqual(indexedWait.status, 'success')

    let computeCalls = 0
    ;(ToolsInteract as any)._computeElementId = (...args: any[]) => {
      computeCalls++
      return originalComputeElementId.apply(ToolsInteract, args)
    }
    const indexedTap = await ToolsInteract.tapElementHandler({ elementId: indexedWait.element.elementId })
    assert.strictEqual(indexedTap.success, true)
    assert.strictEqual(computeCalls, 1, 'Stored index should allow a single fast-path element ID check')
    ;(ToolsInteract as any)._computeElementId = originalComputeElementId

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device' },
      elements: Array.from({ length: 51 }, (_, index) => ({
        text: index === 0 ? 'Inserted first' : index === targetIndex + 1 ? 'Indexed target' : `Shifted filler ${index}`,
        resourceId: index === 0 ? 'btn_inserted_first' : index === targetIndex + 1 ? 'btn_indexed_target' : `btn_shifted_filler_${index}`,
        bounds: [index, index, index + 20, index + 20],
        visible: true,
        enabled: true,
        clickable: true
      }))
    })
    const shiftedIndexResult = await ToolsInteract.tapElementHandler({ elementId: indexedWait.element.elementId })
    assert.strictEqual(shiftedIndexResult.success, false)
    assert.strictEqual(shiftedIndexResult.failure_code, 'STALE_REFERENCE')

    ;(ToolsInteract as any)._resetResolvedUiElementsForTests()
    const cacheLimit = (ToolsInteract as any)._maxResolvedUiElements as number
    let oldestElementId: string | null = null
    let cacheFixtureIndex = 0
    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device' },
      elements: [
        { text: `Button ${cacheFixtureIndex}`, resourceId: `btn_${cacheFixtureIndex}`, bounds: [0, 0, 20, 20], visible: true, enabled: true, clickable: true }
      ]
    })

    for (let i = 0; i < cacheLimit + 1; i++) {
      cacheFixtureIndex = i
      const result = await ToolsInteract.waitForUIHandler({
        selector: { text: `Button ${i}` },
        condition: 'exists',
        timeout_ms: 200,
        poll_interval_ms: 50,
        platform: 'android'
      })
      assert.strictEqual(result.status, 'success')
      if (i === 0) oldestElementId = result.element.elementId
    }

    assert.ok(oldestElementId, 'Oldest element ID should be captured')
    const fingerprintCallsBeforeEvictedTap = fingerprintCalls
    const evictedResult = await ToolsInteract.tapElementHandler({ elementId: oldestElementId as string })
    assert.strictEqual(evictedResult.success, false)
    assert.strictEqual(evictedResult.failure_code, 'STALE_REFERENCE')
    assert.strictEqual(evictedResult.ui_fingerprint_before, null)
    assert.strictEqual(fingerprintCalls, fingerprintCallsBeforeEvictedTap)

    console.log('tap_element unit tests passed')
  } finally {
    ;(ToolsInteract as any)._resetResolvedUiElementsForTests()
    ;(ToolsInteract as any)._computeElementId = originalComputeElementId
    ;(Observe as any).ToolsObserve.getUITreeHandler = originalGetUITreeHandler
    ;(Observe as any).ToolsObserve.getScreenFingerprintHandler = originalGetScreenFingerprintHandler
    ;(ToolsInteract as any).tapHandler = originalTapHandler
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
