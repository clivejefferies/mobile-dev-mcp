import assert from 'assert'
import { ToolsInteract } from '../../../src/interact/index.js'
import * as Observe from '../../../src/observe/index.js'

async function run() {
  console.log('Starting adjust_control unit tests...')

    const originalGetUITreeHandler = (Observe as any).ToolsObserve.getUITreeHandler
    const originalGetScreenFingerprintHandler = (Observe as any).ToolsObserve.getScreenFingerprintHandler
    const originalTapHandler = (ToolsInteract as any).tapHandler
    const originalSwipeHandler = (ToolsInteract as any).swipeHandler
    const originalExpectStateHandler = (ToolsInteract as any).expectStateHandler
    const originalGetInteractionService = (ToolsInteract as any).getInteractionService

  try {
    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
      screen: '',
      resolution: { width: 1080, height: 2400 },
      elements: [
        {
          text: 'Duration',
          type: 'android.widget.SeekBar',
          contentDescription: null,
          clickable: true,
          enabled: true,
          visible: true,
          bounds: [0, 0, 200, 40],
          resourceId: 'seek_duration',
          state: {
            value: 10,
            raw_value: 10,
            value_range: { min: 0, max: 100 }
          }
        }
      ]
    })

    ;(Observe as any).ToolsObserve.getScreenFingerprintHandler = async () => ({ fingerprint: 'fp_slider', activity: 'MainActivity' })

    const wait = await ToolsInteract.waitForUIHandler({
      selector: { text: 'Duration' },
      condition: 'clickable',
      timeout_ms: 200,
      poll_interval_ms: 50,
      platform: 'android'
    })
    assert.strictEqual(wait.status, 'success')
    assert.ok(wait.element?.elementId)

    const tapCalls: Array<{ platform?: string, x: number, y: number, deviceId?: string }> = []
    const swipeCalls: Array<{ platform?: string, x1: number, y1: number, x2: number, y2: number, duration: number, deviceId?: string }> = []
    ;(ToolsInteract as any).tapHandler = async ({ platform, x, y, deviceId }: any) => {
      tapCalls.push({ platform, x, y, deviceId })
      return {
        device: { platform: platform || 'android', id: deviceId || 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
        success: true,
        x,
        y
      }
    }
    ;(ToolsInteract as any).swipeHandler = async ({ platform, x1, y1, x2, y2, duration, deviceId }: any) => {
      swipeCalls.push({ platform, x1, y1, x2, y2, duration, deviceId })
      return {
        device: { platform: platform || 'android', id: deviceId || 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
        success: true,
        start: [x1, y1],
        end: [x2, y2],
        duration
      }
    }

    ;(ToolsInteract as any).expectStateHandler = async () => ({
      success: true,
      selector: { text: 'Duration' },
      element_id: wait.element.elementId,
      expected_state: { property: 'value', expected: 30 },
      element: {
        elementId: wait.element.elementId,
        text: 'Duration',
        resource_id: 'seek_duration',
        accessibility_id: null,
        class: 'android.widget.SeekBar',
        bounds: [0, 0, 200, 40],
        index: 0,
        state: { value: 30, raw_value: 30, value_range: { min: 0, max: 100 } }
      },
      observed_state: { property: 'value', value: 30, raw_value: 30 },
      reason: 'value matches expected value'
    })

    const adjust = await ToolsInteract.adjustControlHandler({
      element_id: wait.element.elementId,
      property: 'value',
      targetValue: 30,
      tolerance: 0.5,
      maxAttempts: 2,
      platform: 'android'
    })

    assert.strictEqual(adjust.success, true)
    assert.strictEqual(adjust.converged, true)
    assert.strictEqual(adjust.within_tolerance, true)
    assert.strictEqual(adjust.adjustment_mode, 'coordinate')
    assert.strictEqual(adjust.target_state.target_value, 30)
    assert.strictEqual(adjust.attempts, 1)
    assert.strictEqual(tapCalls.length, 1)
    assert.strictEqual(swipeCalls.length, 0)
    assert.ok(tapCalls[0].x <= 66, 'tap should bias inward from the exact target point')
    assert.strictEqual(adjust.action_type, 'adjust_control')
    assert.strictEqual(adjust.target.selector.elementId, wait.element.elementId)

    ;(ToolsInteract as any).expectStateHandler = async () => ({
      success: true,
      selector: { text: 'Duration' },
      element_id: wait.element.elementId,
      expected_state: { property: 'value', expected: 2 },
      element: {
        elementId: wait.element.elementId,
        text: 'Duration',
        resource_id: 'seek_duration',
        accessibility_id: null,
        class: 'android.widget.SeekBar',
        bounds: [0, 0, 200, 40],
        index: 0,
        state: { value: 2, raw_value: 2, value_range: { min: 0, max: 100 } }
      },
      observed_state: { property: 'value', value: 2, raw_value: 2 },
      reason: 'value matches expected value'
    })

    const lowEndAdjust = await ToolsInteract.adjustControlHandler({
      element_id: wait.element.elementId,
      property: 'value',
      targetValue: 2,
      tolerance: 0.5,
      maxAttempts: 2,
      platform: 'android'
    })

    assert.strictEqual(lowEndAdjust.success, true)
    assert.strictEqual(lowEndAdjust.converged, true)
    assert.strictEqual(lowEndAdjust.within_tolerance, true)
    assert.strictEqual(lowEndAdjust.attempts, 1)
    assert.strictEqual(tapCalls.length, 2)
    assert.strictEqual(swipeCalls.length, 0)
    assert.ok(tapCalls[1].x >= 22, 'low-end tap should stay inside the first step instead of hugging the edge')

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
      screen: '',
      resolution: { width: 1080, height: 2400 },
      elements: [
        {
          text: 'Duration',
          type: 'android.widget.SeekBar',
          contentDescription: null,
          clickable: true,
          enabled: true,
          visible: true,
          bounds: [0, 0, 200, 40],
          resourceId: 'seek_duration',
          state: {
            value: 18,
            raw_value: 18,
            value_range: { min: 0, max: 20 }
          }
        }
      ]
    })

    ;(ToolsInteract as any).expectStateHandler = async () => ({
      success: true,
      selector: { text: 'Duration' },
      element_id: wait.element.elementId,
      expected_state: { property: 'value', expected: 20 },
      element: {
        elementId: wait.element.elementId,
        text: 'Duration',
        resource_id: 'seek_duration',
        accessibility_id: null,
        class: 'android.widget.SeekBar',
        bounds: [0, 0, 200, 40],
        index: 0,
        state: { value: 20, raw_value: 20, value_range: { min: 0, max: 20 } }
      },
      observed_state: { property: 'value', value: 20, raw_value: 20 },
      reason: 'value matches expected value'
    })

    const highEndAdjust = await ToolsInteract.adjustControlHandler({
      element_id: wait.element.elementId,
      property: 'value',
      targetValue: 20,
      tolerance: 0.5,
      maxAttempts: 2,
      platform: 'android'
    })

    assert.strictEqual(highEndAdjust.success, true)
    assert.strictEqual(highEndAdjust.converged, true)
    assert.strictEqual(highEndAdjust.within_tolerance, true)
    assert.strictEqual(highEndAdjust.attempts, 1)
    assert.strictEqual(tapCalls.length, 3)
    assert.strictEqual(swipeCalls.length, 0)
    assert.ok(tapCalls[2].x >= 180, 'high-end tap should bias into the last step without hitting the edge')

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
      screen: '',
      resolution: { width: 1440, height: 3200 },
      elements: [
        {
          text: 'Precision',
          type: 'android.widget.SeekBar',
          contentDescription: null,
          clickable: true,
          enabled: true,
          visible: true,
          bounds: [0, 0, 3000, 40],
          resourceId: 'seek_precision',
          state: {
            value: 9000,
            raw_value: 9000,
            value_range: { min: 0, max: 10000 }
          }
        }
      ]
    })

    ;(ToolsInteract as any).expectStateHandler = async () => ({
      success: true,
      selector: { text: 'Precision' },
      element_id: wait.element.elementId,
      expected_state: { property: 'value', expected: 9999 },
      element: {
        elementId: wait.element.elementId,
        text: 'Precision',
        resource_id: 'seek_precision',
        accessibility_id: null,
        class: 'android.widget.SeekBar',
        bounds: [0, 0, 3000, 40],
        index: 0,
        state: { value: 9999, raw_value: 9999, value_range: { min: 0, max: 10000 } }
      },
      observed_state: { property: 'value', value: 9999, raw_value: 9999 },
      reason: 'value matches expected value'
    })

    const precisionAdjust = await ToolsInteract.adjustControlHandler({
      selector: { text: 'Precision' },
      property: 'value',
      targetValue: 9999,
      tolerance: 0.5,
      maxAttempts: 2,
      platform: 'android'
    })

    assert.strictEqual(precisionAdjust.success, true)
    assert.strictEqual(precisionAdjust.converged, true)
    assert.strictEqual(precisionAdjust.within_tolerance, true)
    assert.strictEqual(precisionAdjust.attempts, 1)
    assert.strictEqual(tapCalls.length, 4)
    assert.strictEqual(swipeCalls.length, 0)
    assert.ok(tapCalls[3].x > 2750, 'wide, high-range control should not be clamped to a 3% endpoint margin')

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
      screen: '',
      resolution: { width: 1080, height: 2400 },
      elements: [
        {
          text: 'Duration',
          type: 'android.widget.SeekBar',
          contentDescription: null,
          clickable: true,
          enabled: false,
          visible: true,
          bounds: [0, 0, 200, 40],
          resourceId: 'seek_duration',
          state: {
            value: 10,
            raw_value: 10,
            value_range: { min: 0, max: 20 }
          }
        }
      ]
    })

    const disabledAdjust = await ToolsInteract.adjustControlHandler({
      element_id: wait.element.elementId,
      property: 'value',
      targetValue: 8,
      tolerance: 0.5,
      maxAttempts: 1,
      platform: 'android'
    })

    assert.strictEqual(disabledAdjust.success, false)
    assert.strictEqual(disabledAdjust.failure_code, 'ELEMENT_NOT_INTERACTABLE')

    const bothTargetsAdjust = await ToolsInteract.adjustControlHandler({
      selector: { text: 'Duration' },
      element_id: wait.element.elementId,
      property: 'value',
      targetValue: 8,
      platform: 'android'
    })

    assert.strictEqual(bothTargetsAdjust.success, false)
    assert.strictEqual(bothTargetsAdjust.failure_code, 'ELEMENT_NOT_FOUND')

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
      screen: '',
      resolution: { width: 1080, height: 2400 },
      elements: [
        {
          text: 'Plain button',
          type: 'android.widget.Button',
          contentDescription: null,
          clickable: true,
          enabled: true,
          visible: true,
          bounds: [0, 0, 200, 40],
          resourceId: 'plain_button',
          state: null
        }
      ]
    })

    const nonAdjustable = await ToolsInteract.adjustControlHandler({
      selector: { text: 'Plain button' },
      property: 'value',
      targetValue: 1,
      platform: 'android'
    })

    assert.strictEqual(nonAdjustable.success, false)
    assert.strictEqual(nonAdjustable.failure_code, 'ELEMENT_NOT_INTERACTABLE')

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
      screen: '',
      resolution: { width: 1080, height: 2400 },
      elements: [
        {
          text: 'Direct slider',
          type: 'android.widget.SeekBar',
          contentDescription: null,
          clickable: true,
          enabled: true,
          visible: true,
          bounds: [0, 0, 200, 40],
          resourceId: 'seek_direct',
          actions: ['ACTION_SET_PROGRESS'],
          state: {
            value: 10,
            raw_value: 10,
            value_range: { min: 0, max: 100 }
          }
        }
      ]
    })

    let directCalls = 0
    ;(ToolsInteract as any).getInteractionService = async () => ({
      resolved: { id: 'mock-device' },
      interact: {
        setAdjustableValue: async ({ value }: any) => {
          directCalls++
          assert.strictEqual(value, 42)
          return {
            device: { platform: 'android', id: 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
            success: true
          }
        }
      },
      platform: 'android'
    })

    ;(ToolsInteract as any).expectStateHandler = async () => ({
      success: true,
      selector: { text: 'Direct slider' },
      element_id: null,
      expected_state: { property: 'value', expected: 42 },
      observed_state: { property: 'value', value: 42, raw_value: 42 },
      reason: 'value matches expected value'
    })

    const directAdjust = await ToolsInteract.adjustControlHandler({
      selector: { text: 'Direct slider' },
      property: 'value',
      targetValue: 42,
      platform: 'android'
    })

    assert.strictEqual(directAdjust.success, true)
    assert.strictEqual(directAdjust.adjustment_mode, 'semantic')
    assert.strictEqual(directAdjust.attempts, 1)
    assert.strictEqual(directCalls, 1)

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'ios', id: 'booted', osVersion: '17', model: 'Simulator', simulator: true },
      screen: '',
      resolution: { width: 390, height: 844 },
      elements: [
        {
          text: 'Stepper',
          type: 'XCUIElementTypeStepper',
          contentDescription: null,
          clickable: true,
          enabled: true,
          visible: true,
          bounds: [0, 0, 120, 44],
          resourceId: 'stepper',
          actions: ['increment', 'decrement'],
          state: {
            value: 1,
            raw_value: 1,
            value_range: { min: 0, max: 5, step: 1 },
            step: 1
          }
        }
      ]
    })

    const directions: string[] = []
    ;(ToolsInteract as any).getInteractionService = async () => ({
      resolved: { id: 'booted' },
      interact: {
        adjustAccessibleValue: async ({ direction }: any) => {
          directions.push(direction)
          return {
            device: { platform: 'ios', id: 'booted', osVersion: '17', model: 'Simulator', simulator: true },
            success: true
          }
        }
      },
      platform: 'ios'
    })

    let incrementalVerificationCount = 0
    ;(ToolsInteract as any).expectStateHandler = async () => {
      incrementalVerificationCount++
      const value = incrementalVerificationCount === 1 ? 2 : 3
      return {
        success: value === 3,
        selector: { text: 'Stepper' },
        element_id: null,
        expected_state: { property: 'value', expected: 3 },
        observed_state: { property: 'value', value, raw_value: value },
        reason: value === 3 ? 'value matches expected value' : 'value still below target'
      }
    }

    const incrementalAdjust = await ToolsInteract.adjustControlHandler({
      selector: { text: 'Stepper' },
      property: 'value',
      targetValue: 3,
      maxAttempts: 5,
      platform: 'ios'
    })

    assert.strictEqual(incrementalAdjust.success, true)
    assert.strictEqual(incrementalAdjust.adjustment_mode, 'semantic')
    assert.strictEqual(incrementalAdjust.attempts, 2)
    assert.deepStrictEqual(directions, ['increment', 'increment'])
    assert.strictEqual(incrementalAdjust.target_state.tolerance, 0)

    ;(ToolsInteract as any).getInteractionService = originalGetInteractionService

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
      screen: '',
      resolution: { width: 1080, height: 2400 },
      elements: [
        {
          text: 'Stable slider',
          type: 'android.widget.SeekBar',
          contentDescription: null,
          clickable: true,
          enabled: true,
          visible: true,
          bounds: [0, 0, 200, 40],
          resourceId: 'seek_stable',
          stable_id: 'stable-1',
          state: {
            value: 4,
            raw_value: 4,
            value_range: { min: 0, max: 10 }
          }
        }
      ]
    })

    const stableWait = await ToolsInteract.waitForUIHandler({
      selector: { text: 'Stable slider' },
      condition: 'clickable',
      timeout_ms: 200,
      poll_interval_ms: 50,
      platform: 'android'
    })
    assert.strictEqual(stableWait.status, 'success')

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
      screen: '',
      resolution: { width: 1080, height: 2400 },
      elements: [
        {
          text: 'Stable slider',
          type: 'android.widget.SeekBar',
          contentDescription: null,
          clickable: true,
          enabled: true,
          visible: true,
          bounds: [0, 0, 200, 40],
          resourceId: 'seek_stable',
          stable_id: 'stable-2',
          state: {
            value: 4,
            raw_value: 4,
            value_range: { min: 0, max: 10 }
          }
        }
      ]
    })

    const staleAdjust = await ToolsInteract.adjustControlHandler({
      element_id: stableWait.element.elementId,
      property: 'value',
      targetValue: 6,
      tolerance: 0.5,
      maxAttempts: 1,
      platform: 'android'
    })

    assert.strictEqual(staleAdjust.success, false)
    assert.strictEqual(staleAdjust.failure_code, 'STALE_REFERENCE')

    let treeFetches = 0
    let retryVerificationCount = 0
    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => {
      treeFetches++
      return {
        device: { platform: 'android', id: 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
        screen: '',
        resolution: { width: 1080, height: 2400 },
        elements: [
          {
            text: 'Duration',
            type: 'android.widget.SeekBar',
            contentDescription: null,
            clickable: true,
            enabled: true,
            visible: true,
            bounds: [0, 0, 200, 40],
            resourceId: 'seek_duration',
            state: {
              value: 10,
              raw_value: 10,
              value_range: { min: 0, max: 20 }
            }
          }
        ]
      }
    }

    ;(ToolsInteract as any).tapHandler = async ({ platform, x, y, deviceId }: any) => {
      tapCalls.push({ platform, x, y, deviceId })
      return {
        device: { platform: platform || 'android', id: deviceId || 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
        success: true,
        x,
        y
      }
    }

    ;(ToolsInteract as any).swipeHandler = async ({ platform, x1, y1, x2, y2, duration, deviceId }: any) => {
      swipeCalls.push({ platform, x1, y1, x2, y2, duration, deviceId })
      return {
        device: { platform: platform || 'android', id: deviceId || 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
        success: true,
        start: [x1, y1],
        end: [x2, y2],
        duration
      }
    }

    ;(ToolsInteract as any).expectStateHandler = async () => {
      retryVerificationCount++
      const value = retryVerificationCount === 1 ? 11 : 12
      return {
        success: true,
        selector: { text: 'Duration' },
        element_id: wait.element.elementId,
        expected_state: { property: 'value', expected: 12 },
        element: {
          elementId: wait.element.elementId,
          text: 'Duration',
          resource_id: 'seek_duration',
          accessibility_id: null,
          class: 'android.widget.SeekBar',
          bounds: [0, 0, 200, 40],
          index: 0,
          state: { value, raw_value: value, value_range: { min: 0, max: 20 } }
        },
        observed_state: { property: 'value', value, raw_value: value },
        reason: value === 12 ? 'value matches expected value' : 'value still below target'
      }
    }

    const cachedResolveAdjust = await ToolsInteract.adjustControlHandler({
      element_id: wait.element.elementId,
      property: 'value',
      targetValue: 12,
      tolerance: 0.5,
      maxAttempts: 2,
      platform: 'android'
    })

    assert.strictEqual(cachedResolveAdjust.success, true)
    assert.strictEqual(cachedResolveAdjust.converged, true)
    assert.strictEqual(cachedResolveAdjust.within_tolerance, true)
    assert.strictEqual(cachedResolveAdjust.attempts, 2)
    assert.strictEqual(treeFetches, 1, 'second attempt should reuse the resolved element instead of refetching the UI tree')

    const probeTapStart = tapCalls.length
    const probeSwipeStart = swipeCalls.length
    let probeVerificationCount = 0
    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
      screen: '',
      resolution: { width: 1080, height: 2400 },
      elements: [
        {
          text: 'Duration',
          type: 'android.widget.SeekBar',
          contentDescription: null,
          clickable: true,
          enabled: true,
          visible: true,
          bounds: [0, 0, 200, 40],
          resourceId: 'seek_duration',
          state: {
            value: 10,
            raw_value: 10,
            value_range: { min: 0, max: 20 }
          }
        }
      ]
    })

    ;(ToolsInteract as any).tapHandler = async ({ platform, x, y, deviceId }: any) => {
      tapCalls.push({ platform, x, y, deviceId })
      return {
        device: { platform: platform || 'android', id: deviceId || 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
        success: true,
        x,
        y
      }
    }

    ;(ToolsInteract as any).expectStateHandler = async () => {
      probeVerificationCount++
      const value = probeVerificationCount === 1 ? 11 : 12
      return {
        success: true,
        selector: { text: 'Duration' },
        element_id: wait.element.elementId,
        expected_state: { property: 'value', expected: 12 },
        element: {
          elementId: wait.element.elementId,
          text: 'Duration',
          resource_id: 'seek_duration',
          accessibility_id: null,
          class: 'android.widget.SeekBar',
          bounds: [0, 0, 200, 40],
          index: 0,
          state: { value, raw_value: value, value_range: { min: 0, max: 20 } }
        },
        observed_state: { property: 'value', value, raw_value: value },
        reason: value === 12 ? 'value matches expected value' : 'value still below target'
      }
    }

    const probeAdjust = await ToolsInteract.adjustControlHandler({
      element_id: wait.element.elementId,
      property: 'value',
      targetValue: 12,
      tolerance: 0.5,
      maxAttempts: 3,
      platform: 'android'
    })

    assert.strictEqual(probeAdjust.success, true)
    assert.strictEqual(probeAdjust.converged, true)
    assert.strictEqual(probeAdjust.within_tolerance, true)
    assert.strictEqual(probeAdjust.adjustment_mode, 'coordinate')
    assert.strictEqual(probeAdjust.attempts, 2)
    assert.strictEqual(tapCalls.length, probeTapStart + 2)
    assert.strictEqual(swipeCalls.length, probeSwipeStart)

    let defaultToleranceVerificationCount = 0
    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
      screen: '',
      resolution: { width: 1080, height: 2400 },
      elements: [
        {
          text: 'Default tolerance',
          type: 'android.widget.SeekBar',
          contentDescription: null,
          clickable: true,
          enabled: true,
          visible: true,
          bounds: [0, 0, 200, 40],
          resourceId: 'seek_default',
          state: {
            value: 10,
            raw_value: 10,
            value_range: { min: 0, max: 100 }
          }
        }
      ]
    })

    ;(ToolsInteract as any).expectStateHandler = async () => {
      defaultToleranceVerificationCount++
      return {
        success: false,
        selector: { text: 'Default tolerance' },
        element_id: null,
        expected_state: { property: 'value', expected: 50 },
        observed_state: { property: 'value', value: 50.6, raw_value: 50.6 },
        reason: 'exact value mismatch'
      }
    }

    const defaultToleranceAdjust = await ToolsInteract.adjustControlHandler({
      selector: { text: 'Default tolerance' },
      property: 'value',
      targetValue: 50,
      platform: 'android'
    })

    assert.strictEqual(defaultToleranceAdjust.success, true)
    assert.strictEqual(defaultToleranceAdjust.target_state.tolerance, 1)
    assert.strictEqual(defaultToleranceVerificationCount, 1)

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
      screen: '',
      resolution: { width: 1080, height: 2400 },
      elements: [
        {
          text: 'Discrete slider',
          type: 'android.widget.SeekBar',
          contentDescription: null,
          clickable: true,
          enabled: true,
          visible: true,
          bounds: [0, 0, 200, 40],
          resourceId: 'seek_discrete',
          state: {
            value: 0,
            raw_value: 0,
            value_range: { min: 0, max: 20, step: 5 },
            step: 5
          }
        }
      ]
    })

    ;(ToolsInteract as any).expectStateHandler = async () => ({
      success: true,
      selector: { text: 'Discrete slider' },
      element_id: null,
      expected_state: { property: 'value', expected: 10 },
      observed_state: { property: 'value', value: 10, raw_value: 10 },
      reason: 'value matches expected value'
    })

    const discreteAdjust = await ToolsInteract.adjustControlHandler({
      selector: { text: 'Discrete slider' },
      property: 'value',
      targetValue: 12,
      platform: 'android'
    })

    assert.strictEqual(discreteAdjust.success, true)
    assert.strictEqual(discreteAdjust.target_state.target_value, 10)
    assert.strictEqual(discreteAdjust.target_state.tolerance, 0)

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => ({
      device: { platform: 'android', id: 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
      screen: '',
      resolution: { width: 1080, height: 2400 },
      elements: [
        {
          text: 'Out of range',
          type: 'android.widget.SeekBar',
          contentDescription: null,
          clickable: true,
          enabled: true,
          visible: true,
          bounds: [0, 0, 200, 40],
          resourceId: 'seek_range',
          state: {
            value: 10,
            raw_value: 10,
            value_range: { min: 0, max: 20 }
          }
        }
      ]
    })

    const outOfRangeAdjust = await ToolsInteract.adjustControlHandler({
      selector: { text: 'Out of range' },
      property: 'value',
      targetValue: 30,
      platform: 'android'
    })

    assert.strictEqual(outOfRangeAdjust.success, false)
    assert.strictEqual(outOfRangeAdjust.failure_code, 'CONTROL_CONVERGENCE_FAILED')

    let inferredLabelTreeValue = 3
    const inferredLabelTree = () => ({
      device: { platform: 'android', id: 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
      screen: '',
      resolution: { width: 1280, height: 2856 },
      elements: [
        {
          text: 'Duration',
          type: 'android.widget.TextView',
          contentDescription: null,
          clickable: false,
          enabled: true,
          visible: true,
          bounds: [132, 1855, 404, 1951],
          resourceId: null,
          state: { value: 'Duration' }
        },
        {
          text: String(inferredLabelTreeValue),
          type: 'android.widget.TextView',
          contentDescription: null,
          clickable: false,
          enabled: true,
          visible: true,
          bounds: [987, 1827, 1063, 1985],
          resourceId: null,
          state: { value: String(inferredLabelTreeValue) }
        },
        {
          text: 'min',
          type: 'android.widget.TextView',
          contentDescription: null,
          clickable: false,
          enabled: true,
          visible: true,
          bounds: [1075, 1891, 1148, 1951],
          resourceId: null,
          state: { value: 'min' }
        },
        {
          text: '1 min',
          type: 'android.widget.TextView',
          contentDescription: null,
          clickable: false,
          enabled: true,
          visible: true,
          bounds: [132, 2177, 228, 2225],
          resourceId: null,
          state: { value: '1 min' }
        },
        {
          text: '15 min',
          type: 'android.widget.TextView',
          contentDescription: null,
          clickable: false,
          enabled: true,
          visible: true,
          bounds: [1031, 2177, 1148, 2225],
          resourceId: null,
          state: { value: '15 min' }
        },
        {
          text: null,
          type: 'android.view.View',
          contentDescription: null,
          clickable: true,
          enabled: true,
          visible: true,
          bounds: [84, 2369, 1196, 2513],
          resourceId: null,
          state: { selected: true, enabled: true }
        }
      ]
    })

    ;(Observe as any).ToolsObserve.getUITreeHandler = async () => inferredLabelTree()
    ;(ToolsInteract as any).tapHandler = async ({ platform, x, y, deviceId }: any) => {
      tapCalls.push({ platform, x, y, deviceId })
      return {
        device: { platform: platform || 'android', id: deviceId || 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
        success: true,
        x,
        y
      }
    }
    ;(ToolsInteract as any).swipeHandler = async ({ platform, x1, y1, x2, y2, duration, deviceId }: any) => {
      swipeCalls.push({ platform, x1, y1, x2, y2, duration, deviceId })
      inferredLabelTreeValue = 5
      return {
        device: { platform: platform || 'android', id: deviceId || 'mock-device', osVersion: '14', model: 'Pixel', simulator: true },
        success: true,
        start: [x1, y1],
        end: [x2, y2],
        duration
      }
    }

    const inferredTapStart = tapCalls.length
    const inferredSwipeStart = swipeCalls.length
    const inferredLabelAdjust = await ToolsInteract.adjustControlHandler({
      selector: { text: 'Duration' },
      property: 'value',
      targetValue: 5,
      tolerance: 0.5,
      platform: 'android'
    })

    assert.strictEqual(inferredLabelAdjust.success, true)
    assert.strictEqual(inferredLabelAdjust.adjustment_mode, 'gesture')
    assert.strictEqual(inferredLabelAdjust.target_state.target_value, 5)
    assert.strictEqual(inferredLabelAdjust.actual_state?.value, 5)
    assert.strictEqual(tapCalls.length, inferredTapStart + 1)
    assert.strictEqual(swipeCalls.length, inferredSwipeStart + 1)
    assert.strictEqual(swipeCalls[swipeCalls.length - 1].duration, 520)
    assert.ok(tapCalls[tapCalls.length - 1].y < 2369, 'inferred slider tap should avoid the clickable view below the min/max labels')
    assert.ok(swipeCalls[swipeCalls.length - 1].y1 < 2369, 'inferred slider drag should start above the clickable view below the min/max labels')
    assert.ok(swipeCalls[swipeCalls.length - 1].y2 < 2369, 'inferred slider drag should end above the clickable view below the min/max labels')

    console.log('adjust_control unit tests passed')
  } finally {
    ;(Observe as any).ToolsObserve.getUITreeHandler = originalGetUITreeHandler
    ;(Observe as any).ToolsObserve.getScreenFingerprintHandler = originalGetScreenFingerprintHandler
    ;(ToolsInteract as any).tapHandler = originalTapHandler
    ;(ToolsInteract as any).swipeHandler = originalSwipeHandler
    ;(ToolsInteract as any).expectStateHandler = originalExpectStateHandler
    ;(ToolsInteract as any).getInteractionService = originalGetInteractionService
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
