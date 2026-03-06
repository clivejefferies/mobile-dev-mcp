import { exec } from "child_process"

export function startAndroidApp(pkg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      `adb shell monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`,
      (err, stdout, stderr) => {
        if (err) reject(stderr)
        else resolve(stdout)
      }
    )
  })
}

export function getAndroidLogs(lines = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(`adb logcat -d -t ${lines}`, (err, stdout, stderr) => {
      if (err) reject(stderr)
      else resolve(stdout)
    })
  })
}