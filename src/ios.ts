import { exec } from "child_process"

export function startIOSApp(bundleId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      `xcrun simctl launch booted ${bundleId}`,
      (err, stdout, stderr) => {
        if (err) reject(stderr)
        else resolve(stdout)
      }
    )
  })
}

export function getIOSLogs(): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      `xcrun simctl spawn booted log show --style syslog --last 1m`,
      (err, stdout, stderr) => {
        if (err) reject(stderr)
        else resolve(stdout)
      }
    )
  })
}