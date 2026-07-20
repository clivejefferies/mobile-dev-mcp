import { ToolsObserve } from '../../../src/observe/index.js'
import { ToolsNetwork } from '../../../src/network/index.js'
import assert from 'assert'

async function run() {
  console.log('Starting capture_debug_snapshot unit tests...')

  // Save original ToolsObserve handlers
  const origCaptureHandler = (ToolsObserve as any).captureScreenshotHandler
  const origGetCurrentHandler = (ToolsObserve as any).getCurrentScreenHandler
  const origGetFpHandler = (ToolsObserve as any).getScreenFingerprintHandler
  const origGetTreeHandler = (ToolsObserve as any).getUITreeHandler
  const origReadLogStreamHandler = (ToolsObserve as any).readLogStreamHandler
  const origGetLogsHandler = (ToolsObserve as any).getLogsHandler
  const origGetNetworkActivity = (ToolsNetwork as any).getNetworkActivity

  try {
    // --- Test 1: all components succeed and logs come from stream ---
    ;(ToolsObserve as any).captureScreenshotHandler = async function() {
      return { device: { platform: 'android', id: 'mock', osVersion: '12', model: 'Pixel', simulator: true }, screenshot: 'BASE64PNG', resolution: { width: 1080, height: 1920 } }
    }
    ;(ToolsObserve as any).getCurrentScreenHandler = async function() {
      return { device: { platform: 'android', id: 'mock' }, package: 'com.example', activity: 'com.example.Main', shortActivity: 'Main' }
    }
    ;(ToolsObserve as any).getScreenFingerprintHandler = async function() {
      return { fingerprint: 'abc123', activity: 'Main' }
    }
    ;(ToolsObserve as any).getUITreeHandler = async function() {
      return { device: { platform: 'android', id: 'mock', osVersion: '12', model: 'Pixel', simulator: true }, screen: '', resolution: { width: 1080, height: 1920 }, elements: [] }
    }
    ;(ToolsObserve as any).readLogStreamHandler = async function() {
      return { entries: [ { timestamp: '2026-03-23T20:00:00.000Z', level: 'ERROR', message: 'Boom' } ], crash_summary: { crash_detected: true } }
    }
    ;(ToolsObserve as any).getLogsHandler = async function() {
      return { device: { platform: 'android', id: 'mock' }, logs: [], logCount: 0 }
    }
    ;(ToolsNetwork as any).getNetworkActivity = async function() {
      return { requests: [], count: 0 }
    }

    const res1: any = await ToolsObserve.captureDebugSnapshotHandler({ platform: 'android', includeLogs: true, logLines: 50, sessionId: 's1' })
    console.log('res1:', JSON.stringify(res1, null, 2))
    const pass1 = res1 && res1.raw && res1.raw.screenshot === 'BASE64PNG' && res1.raw.activity && res1.raw.fingerprint === 'abc123' && Array.isArray(res1.raw.logs) && res1.raw.logs.length === 1
    assert.ok(pass1, 'captureDebugSnapshot should aggregate successful handler results')
    assert.strictEqual(res1.semantic.screen, 'Main')
    assert.strictEqual(res1.semantic.confidence >= 0.7, true)
    assert.deepStrictEqual(res1.semantic.actions_available, null)
    console.log('Test 1:', pass1 ? 'PASS' : 'FAIL')

    // Restore handlers before next test
    ;(ToolsObserve as any).captureScreenshotHandler = origCaptureHandler
    ;(ToolsObserve as any).getCurrentScreenHandler = origGetCurrentHandler
    ;(ToolsObserve as any).getScreenFingerprintHandler = origGetFpHandler
    ;(ToolsObserve as any).getUITreeHandler = origGetTreeHandler
    ;(ToolsObserve as any).readLogStreamHandler = origReadLogStreamHandler
    ;(ToolsObserve as any).getLogsHandler = origGetLogsHandler
    ;(ToolsNetwork as any).getNetworkActivity = origGetNetworkActivity

    // --- Test 2: screenshot and ui tree fail; logs fallback to getLogs ---
    ;(ToolsObserve as any).captureScreenshotHandler = async function() { throw new Error('screencap failed') }
    ;(ToolsObserve as any).getUITreeHandler = async function() { throw new Error('uie_error') }
    ;(ToolsObserve as any).readLogStreamHandler = async function() { return { entries: [] } }
    ;(ToolsObserve as any).getLogsHandler = async function() { return { device: { platform: 'android', id: 'mock' }, logs: ['INFO starting','ERROR crash here'], logCount: 2 } }
    ;(ToolsNetwork as any).getNetworkActivity = async function() { return { requests: [], count: 0 } }

    const res2: any = await ToolsObserve.captureDebugSnapshotHandler({ platform: 'android', includeLogs: true, logLines: 10, appId: 'com.example' })
    console.log('res2:', JSON.stringify(res2, null, 2))
    const pass2 = res2 && res2.raw && res2.raw.screenshot_error && res2.raw.ui_tree_error && Array.isArray(res2.raw.logs) && res2.raw.logs.length === 2
    assert.ok(pass2, 'captureDebugSnapshot should surface partial failures and fallback logs')
    console.log('Test 2:', pass2 ? 'PASS' : 'FAIL')

    // Restore handlers before next test
    ;(ToolsObserve as any).captureScreenshotHandler = origCaptureHandler
    ;(ToolsObserve as any).getCurrentScreenHandler = origGetCurrentHandler
    ;(ToolsObserve as any).getScreenFingerprintHandler = origGetFpHandler
    ;(ToolsObserve as any).getUITreeHandler = origGetTreeHandler
    ;(ToolsObserve as any).readLogStreamHandler = origReadLogStreamHandler
    ;(ToolsObserve as any).getLogsHandler = origGetLogsHandler
    ;(ToolsNetwork as any).getNetworkActivity = origGetNetworkActivity

    // --- Test 3: includeLogs=false should omit logs ---
    ;(ToolsObserve as any).captureScreenshotHandler = async function() { return { device: { platform: 'android', id: 'mock' }, screenshot: null } }
    ;(ToolsObserve as any).getCurrentScreenHandler = async function() { return { device: { platform: 'android', id: 'mock' }, package: '', activity: '', shortActivity: '' } }
    ;(ToolsObserve as any).getScreenFingerprintHandler = async function() { return { fingerprint: null } }
    ;(ToolsObserve as any).getUITreeHandler = async function() { return { device: { platform: 'android', id: 'mock' }, screen: '', resolution: { width: 0, height: 0 }, elements: [] } }
    ;(ToolsObserve as any).readLogStreamHandler = async function() { return { entries: [] } }
    ;(ToolsNetwork as any).getNetworkActivity = async function() { return { requests: [], count: 0 } }

    const res3: any = await ToolsObserve.captureDebugSnapshotHandler({ platform: 'android', includeLogs: false })
    console.log('res3:', JSON.stringify(res3, null, 2))
    const pass3 = res3 && res3.raw && typeof res3.raw.logs !== 'undefined' && res3.raw.logs.length === 0
    assert.ok(pass3, 'captureDebugSnapshot should return an empty logs array when includeLogs is false')
    console.log('Test 3:', pass3 ? 'PASS' : 'FAIL')

    // Restore handlers before next test
    ;(ToolsObserve as any).captureScreenshotHandler = origCaptureHandler
    ;(ToolsObserve as any).getCurrentScreenHandler = origGetCurrentHandler
    ;(ToolsObserve as any).getScreenFingerprintHandler = origGetFpHandler
    ;(ToolsObserve as any).getUITreeHandler = origGetTreeHandler
    ;(ToolsObserve as any).readLogStreamHandler = origReadLogStreamHandler
    ;(ToolsObserve as any).getLogsHandler = origGetLogsHandler
    ;(ToolsNetwork as any).getNetworkActivity = origGetNetworkActivity

    // --- Test 4: action_id should correlate network and trace diagnostics ---
    ;(ToolsObserve as any).captureScreenshotHandler = async function() { return { device: { platform: 'android', id: 'mock' }, screenshot: null } }
    ;(ToolsObserve as any).getCurrentScreenHandler = async function() { return { device: { platform: 'android', id: 'mock' }, package: 'com.example', activity: 'MainActivity', shortActivity: 'Main' } }
    ;(ToolsObserve as any).getScreenFingerprintHandler = async function() { return { fingerprint: 'fp-action', activity: 'Main' } }
    ;(ToolsObserve as any).getUITreeHandler = async function() { return { device: { platform: 'android', id: 'mock' }, screen: 'Main', resolution: { width: 0, height: 0 }, elements: [] } }
    ;(ToolsObserve as any).readLogStreamHandler = async function() { return { entries: [] } }
    ;(ToolsObserve as any).getLogsHandler = async function() { return { device: { platform: 'android', id: 'mock' }, logs: [], logCount: 0 } }
    ;(ToolsNetwork as any).getNetworkActivity = async function() {
      return {
        requests: [
          { endpoint: '/api/login', method: 'POST', statusCode: 200, status: 'success', durationMs: 42, timestampMs: Date.now() }
        ],
        count: 1
      }
    }

    const res4: any = await ToolsObserve.captureDebugSnapshotHandler({ platform: 'android', action_id: 'tap_1', includeLogs: false, include_uncorrelated: false })
    console.log('res4:', JSON.stringify(res4, null, 2))
    const pass4 = Array.isArray(res4?.semantic?.diagnostics?.signals) && res4.semantic.diagnostics.signals.some((signal: any) => signal.provider === 'network_activity' && signal.action_id === 'tap_1') && res4.semantic.diagnostics.signals.some((signal: any) => signal.provider === 'action_trace' && signal.action_id === 'tap_1')
    assert.ok(pass4, 'captureDebugSnapshot should include correlated network and action trace diagnostics')
    console.log('Test 4:', pass4 ? 'PASS' : 'FAIL')

  } finally {
    ;(ToolsObserve as any).captureScreenshotHandler = origCaptureHandler
    ;(ToolsObserve as any).getCurrentScreenHandler = origGetCurrentHandler
    ;(ToolsObserve as any).getScreenFingerprintHandler = origGetFpHandler
    ;(ToolsObserve as any).getUITreeHandler = origGetTreeHandler
    ;(ToolsObserve as any).readLogStreamHandler = origReadLogStreamHandler
    ;(ToolsObserve as any).getLogsHandler = origGetLogsHandler
    ;(ToolsNetwork as any).getNetworkActivity = origGetNetworkActivity
  }
}

run().catch((error) => { console.error(error); process.exit(1) })
