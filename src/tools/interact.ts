import { promises as fs } from 'fs'
import path from 'path'
import { resolveTargetDevice } from '../resolve-device.js'
import { AndroidInteract } from '../android/interact.js'
import { iOSInteract } from '../ios/interact.js'

export class ToolsInteract {
  static async installAppHandler({ platform, appPath, deviceId }: { platform?: 'android' | 'ios', appPath: string, deviceId?: string }) {
    let chosenPlatform: 'android' | 'ios' | undefined = platform

    try {
      const stat = await fs.stat(appPath).catch(() => null)
      if (stat && stat.isDirectory()) {
        const files = (await fs.readdir(appPath).catch(() => [])) as string[]
        if (files.some(f => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'))) {
          chosenPlatform = 'ios'
        } else if (files.includes('gradlew') || files.includes('build.gradle') || files.includes('settings.gradle') || (files.includes('app') && (await fs.stat(path.join(appPath, 'app')).catch(() => null)))) {
          chosenPlatform = 'android'
        } else {
          chosenPlatform = 'android'
        }
      } else if (typeof appPath === 'string') {
        const ext = path.extname(appPath).toLowerCase()
        if (ext === '.apk') chosenPlatform = 'android'
        else if (ext === '.ipa' || ext === '.app') chosenPlatform = 'ios'
        else chosenPlatform = 'android'
      }
    } catch {
      chosenPlatform = 'android'
    }

    if (chosenPlatform === 'android') {
      const resolved = await resolveTargetDevice({ platform: 'android', deviceId })
      const androidInteract = new AndroidInteract()
      const result = await androidInteract.installApp(appPath, resolved.id)
      return result
    } else {
      const resolved = await resolveTargetDevice({ platform: 'ios', deviceId })
      const iosInteract = new iOSInteract()
      const result = await iosInteract.installApp(appPath, resolved.id)
      return result
    }
  }

  static async startAppHandler({ platform, appId, deviceId }: { platform: 'android' | 'ios', appId: string, deviceId?: string }) {
    if (platform === 'android') {
      const resolved = await resolveTargetDevice({ platform: 'android', appId, deviceId })
      return await new AndroidInteract().startApp(appId, resolved.id)
    } else {
      const resolved = await resolveTargetDevice({ platform: 'ios', appId, deviceId })
      return await new iOSInteract().startApp(appId, resolved.id)
    }
  }

  static async terminateAppHandler({ platform, appId, deviceId }: { platform: 'android' | 'ios', appId: string, deviceId?: string }) {
    if (platform === 'android') {
      const resolved = await resolveTargetDevice({ platform: 'android', appId, deviceId })
      return await new AndroidInteract().terminateApp(appId, resolved.id)
    } else {
      const resolved = await resolveTargetDevice({ platform: 'ios', appId, deviceId })
      return await new iOSInteract().terminateApp(appId, resolved.id)
    }
  }

  static async restartAppHandler({ platform, appId, deviceId }: { platform: 'android' | 'ios', appId: string, deviceId?: string }) {
    if (platform === 'android') {
      const resolved = await resolveTargetDevice({ platform: 'android', appId, deviceId })
      return await new AndroidInteract().restartApp(appId, resolved.id)
    } else {
      const resolved = await resolveTargetDevice({ platform: 'ios', appId, deviceId })
      return await new iOSInteract().restartApp(appId, resolved.id)
    }
  }

  static async resetAppDataHandler({ platform, appId, deviceId }: { platform: 'android' | 'ios', appId: string, deviceId?: string }) {
    if (platform === 'android') {
      const resolved = await resolveTargetDevice({ platform: 'android', appId, deviceId })
      return await new AndroidInteract().resetAppData(appId, resolved.id)
    } else {
      const resolved = await resolveTargetDevice({ platform: 'ios', appId, deviceId })
      return await new iOSInteract().resetAppData(appId, resolved.id)
    }
  }
}
