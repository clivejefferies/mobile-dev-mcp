import { resolveTargetDevice, listDevices } from '../resolve-device.js'
import { AndroidObserve } from '../android/observe.js'
import { iOSObserve } from '../ios/observe.js'
import { AndroidInteract } from '../android/interact.js'
import { iOSInteract } from '../ios/interact.js'

export class ToolsObserve {
  static async getLogsHandler({ platform, appId, deviceId, lines }: { platform: 'android' | 'ios', appId?: string, deviceId?: string, lines?: number }) {
    if (platform === 'android') {
      const resolved = await resolveTargetDevice({ platform: 'android', appId, deviceId })
      const response = await new AndroidObserve().getLogs(appId, lines ?? 200, resolved.id)
      const logs = Array.isArray(response.logs) ? response.logs : []
      const crashLines = logs.filter(line => line.includes('FATAL EXCEPTION'))
      return { device: response.device, logs, crashLines }
    } else {
      const resolved = await resolveTargetDevice({ platform: 'ios', appId, deviceId })
      const resp = await new iOSObserve().getLogs(appId, resolved.id)
      const logs = Array.isArray(resp.logs) ? resp.logs : []
      const crashLines = logs.filter(l => l.includes('FATAL EXCEPTION'))
      return { device: resp.device, logs, crashLines }
    }
  }

  static async startLogStreamHandler({ platform, packageName, level, sessionId, deviceId }: { platform?: 'android' | 'ios', packageName: string, level?: 'error' | 'warn' | 'info' | 'debug', sessionId?: string, deviceId?: string }) {
    const effectivePlatform = platform || 'android'
    const sid = sessionId || 'default'
    if (effectivePlatform === 'android') {
      const resolved = await resolveTargetDevice({ platform: 'android', appId: packageName, deviceId })
      // AndroidObserve uses utils for log stream control; delegate to android/utils functions where appropriate
      const { startAndroidLogStream } = await import('../android/utils.js')
      return await startAndroidLogStream(packageName, level || 'error', resolved.id, sid)
    } else {
      const resolved = await resolveTargetDevice({ platform: 'ios', appId: packageName, deviceId })
      // iOSObserve implements startIOSLogStream via ios/utils; use its helper
      const { startIOSLogStream } = await import('../ios/utils.js')
      return await startIOSLogStream(packageName, resolved.id, sid)
    }
  }

  static async readLogStreamHandler({ platform, sessionId, limit, since }: { platform?: 'android' | 'ios', sessionId?: string, limit?: number, since?: string }) {
    const effectivePlatform = platform || 'android'
    const sid = sessionId || 'default'
    if (effectivePlatform === 'android') {
      const { readLogStreamLines } = await import('../android/utils.js')
      return await readLogStreamLines(sid, limit ?? 100, since)
    } else {
      const { readIOSLogStreamLines } = await import('../ios/utils.js')
      return await readIOSLogStreamLines(sid, limit ?? 100, since)
    }
  }

  static async stopLogStreamHandler({ platform, sessionId }: { platform?: 'android' | 'ios', sessionId?: string }) {
    const effectivePlatform = platform || 'android'
    const sid = sessionId || 'default'
    if (effectivePlatform === 'android') {
      const { stopAndroidLogStream } = await import('../android/utils.js')
      return await stopAndroidLogStream(sid)
    } else {
      const { stopIOSLogStream } = await import('../ios/utils.js')
      return await stopIOSLogStream(sid)
    }
  }

  static async getUITreeHandler({ platform, deviceId }: { platform: 'android' | 'ios', deviceId?: string }) {
    if (platform === 'android') {
      const resolved = await resolveTargetDevice({ platform: 'android', deviceId })
      return await new AndroidObserve().getUITree(resolved.id)
    } else {
      const resolved = await resolveTargetDevice({ platform: 'ios', deviceId })
      return await new iOSObserve().getUITree(resolved.id)
    }
  }

  static async getCurrentScreenHandler({ deviceId }: { deviceId?: string }) {
    const resolved = await resolveTargetDevice({ platform: 'android', deviceId })
    return await new AndroidObserve().getCurrentScreen(resolved.id)
  }

  static async waitForElementHandler({ platform, text, timeout, deviceId }: { platform: 'android' | 'ios', text: string, timeout?: number, deviceId?: string }) {
    const effectiveTimeout = timeout ?? 10000
    if (platform === 'android') {
      const resolved = await resolveTargetDevice({ platform: 'android', deviceId })
      return await new AndroidInteract().waitForElement(text, effectiveTimeout, resolved.id)
    } else {
      const resolved = await resolveTargetDevice({ platform: 'ios', deviceId })
      return await new iOSInteract().waitForElement(text, effectiveTimeout, resolved.id)
    }
  }

  static async tapHandler({ platform, x, y, deviceId }: { platform?: 'android' | 'ios', x: number, y: number, deviceId?: string }) {
    const effectivePlatform = platform || 'android'
    if (effectivePlatform === 'android') {
      const resolved = await resolveTargetDevice({ platform: 'android', deviceId })
      return await new AndroidInteract().tap(x, y, resolved.id)
    } else {
      const resolved = await resolveTargetDevice({ platform: 'ios', deviceId })
      return await new iOSInteract().tap(x, y, resolved.id)
    }
  }

  static async swipeHandler({ x1, y1, x2, y2, duration, deviceId }: { x1: number, y1: number, x2: number, y2: number, duration: number, deviceId?: string }) {
    const resolved = await resolveTargetDevice({ platform: 'android', deviceId })
    return await new AndroidInteract().swipe(x1, y1, x2, y2, duration, resolved.id)
  }

  static async typeTextHandler({ text, deviceId }: { text: string, deviceId?: string }) {
    const resolved = await resolveTargetDevice({ platform: 'android', deviceId })
    return await new AndroidInteract().typeText(text, resolved.id)
  }

  static async pressBackHandler({ deviceId }: { deviceId?: string }) {
    const resolved = await resolveTargetDevice({ platform: 'android', deviceId })
    return await new AndroidInteract().pressBack(resolved.id)
  }

  static async listDevicesHandler({ platform, appId }: { platform?: 'android' | 'ios', appId?: string }) {
    const devices = await listDevices(platform as any, appId)
    return { devices }
  }

  static async captureScreenshotHandler({ platform, deviceId }: { platform?: 'android' | 'ios', deviceId?: string }) {
    const effectivePlatform = platform || 'android'
    if (effectivePlatform === 'android') {
      const resolved = await resolveTargetDevice({ platform: 'android', deviceId })
      return await new AndroidObserve().captureScreen(resolved.id)
    } else {
      const resolved = await resolveTargetDevice({ platform: 'ios', deviceId })
      return await new iOSObserve().captureScreenshot(resolved.id)
    }
  }
}

