import { spawn } from "child_process"
import { DeviceInfo } from "../types.js"

export const ADB = process.env.ADB_PATH || "adb"

// Helper to construct ADB args with optional device ID
function getAdbArgs(args: string[], deviceId?: string): string[] {
  if (deviceId) {
    return ['-s', deviceId, ...args]
  }
  return args
}

export function execAdb(args: string[], deviceId?: string, options: any = {}): Promise<string> {
  const adbArgs = getAdbArgs(args, deviceId)
  return new Promise((resolve, reject) => {
    // Extract timeout from options if present, otherwise pass options to spawn
    const { timeout: customTimeout, ...spawnOptions } = options;
    
    // Use spawn instead of execFile for better stream control and to avoid potential buffering hangs
    const child = spawn(ADB, adbArgs, spawnOptions)
    
    let stdout = ''
    let stderr = ''

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })
    }

    let timeoutMs = customTimeout || 2000;
    if (!customTimeout) {
      if (args.includes('logcat')) {
          timeoutMs = 10000;
      } else if (args.includes('uiautomator') && args.includes('dump')) {
          timeoutMs = 20000; // UI dump can be slow
      }
    }

    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error(`ADB command timed out after ${timeoutMs}ms: ${args.join(' ')}`))
    }, timeoutMs)

    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        // If there's an actual error (non-zero exit code), reject
        reject(new Error(stderr.trim() || `Command failed with code ${code}`))
      } else {
        // If exit code is 0, resolve with stdout
        resolve(stdout.trim())
      }
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

export function getDeviceInfo(deviceId: string, metadata: Partial<DeviceInfo> = {}): DeviceInfo {
  return { 
    platform: 'android', 
    id: deviceId || 'default', 
    osVersion: metadata.osVersion || '', 
    model: metadata.model || '', 
    simulator: metadata.simulator || false 
  }
}

export async function getAndroidDeviceMetadata(appId: string, deviceId?: string): Promise<DeviceInfo> {
  try {
    // If no deviceId provided, try to auto-detect a single connected device
    let resolvedDeviceId = deviceId;
    if (!resolvedDeviceId) {
      try {
        const devicesOutput = await execAdb(['devices']);
        // Parse lines like: "<serial>\tdevice"
        const lines = devicesOutput.split('\n').map(l => l.trim()).filter(Boolean);
        const deviceLines = lines.slice(1) // skip header
          .map(l => l.split('\t'))
          .filter(parts => parts.length >= 2 && parts[1] === 'device')
          .map(parts => parts[0]);
        if (deviceLines.length === 1) {
          resolvedDeviceId = deviceLines[0];
        }
      } catch (e) {
        // ignore and continue without resolvedDeviceId
      }
    }

    // Run these in parallel to avoid sequential timeouts
    const [osVersion, model, simOutput] = await Promise.all([
      execAdb(['shell', 'getprop', 'ro.build.version.release'], resolvedDeviceId).catch(() => ''),
      execAdb(['shell', 'getprop', 'ro.product.model'], resolvedDeviceId).catch(() => ''),
      execAdb(['shell', 'getprop', 'ro.kernel.qemu'], resolvedDeviceId).catch(() => '0')
    ])
    
    const simulator = simOutput === '1'
    return { platform: 'android', id: resolvedDeviceId || 'default', osVersion, model, simulator }
  } catch (e) {
    return { platform: 'android', id: deviceId || 'default', osVersion: '', model: '', simulator: false }
  }
}

export async function listAndroidDevices(appId?: string): Promise<DeviceInfo[]> {
  try {
    const devicesOutput = await execAdb(['devices', '-l'])
    const lines = devicesOutput.split('\n').map(l => l.trim()).filter(Boolean)
    // Skip header if present (some adb versions include 'List of devices attached')
    const deviceLines = lines.filter(l => !l.startsWith('List of devices')).map(l => l)
    const serials = deviceLines.map(line => line.split(/\s+/)[0]).filter(Boolean)

    const infos = await Promise.all(serials.map(async (serial) => {
      try {
        const [osVersion, model, simOutput] = await Promise.all([
          execAdb(['shell', 'getprop', 'ro.build.version.release'], serial).catch(() => ''),
          execAdb(['shell', 'getprop', 'ro.product.model'], serial).catch(() => ''),
          execAdb(['shell', 'getprop', 'ro.kernel.qemu'], serial).catch(() => '0')
        ])
        const simulator = simOutput === '1'
        let appInstalled = false
        if (appId) {
          try {
            const pm = await execAdb(['shell', 'pm', 'path', appId], serial)
            appInstalled = !!(pm && pm.includes('package:'))
          } catch {
            appInstalled = false
          }
        }
        return { platform: 'android', id: serial, osVersion, model, simulator, appInstalled } as DeviceInfo & { appInstalled?: boolean }
      } catch {
        return { platform: 'android', id: serial, osVersion: '', model: '', simulator: false, appInstalled: false } as DeviceInfo & { appInstalled?: boolean }
      }
    }))

    return infos
  } catch (e) {
    return []
  }
}
