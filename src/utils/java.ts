import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

export async function detectJavaHome(): Promise<string | undefined> {
  try {
    // If JAVA_HOME is set, validate it's Java 17
    if (process.env.JAVA_HOME) {
      try {
        const javaBin = path.join(process.env.JAVA_HOME, 'bin', 'java')
        const v = execSync(`"${javaBin}" -version`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
        if (/\b17\b/.test(v) || /17\./.test(v)) return process.env.JAVA_HOME
        console.debug('[java.detect] Existing JAVA_HOME does not appear to be Java 17, will search for JDK17')
      } catch {
        console.debug('[java.detect] Failed to validate existing JAVA_HOME, searching for JDK17')
      }
    }

    // macOS explicit path
    const explicit = '/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home'
    if (existsSync(explicit)) return explicit

    // Android Studio JBR candidates
    const jbrCandidates = [
      '/Applications/Android Studio.app/Contents/jbr',
      '/Applications/Android Studio Preview.app/Contents/jbr',
      '/Applications/Android Studio Preview 2022.3.app/Contents/jbr',
      '/Applications/Android Studio Preview 2023.1.app/Contents/jbr'
    ]
    for (const p of jbrCandidates) {
      const javaBin = path.join(p, 'bin', 'java')
      if (existsSync(javaBin)) {
        try {
          const v = execSync(`"${javaBin}" -version`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
          if (/\b17\b/.test(v) || /17\./.test(v)) return p
        } catch {}
      }
    }

    // macOS /usr/libexec/java_home
    try {
      const out = execSync('/usr/libexec/java_home -v 17', { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()
      if (out) return out
    } catch {}

    // macOS common JDK locations
    try {
      const homes = execSync('ls -1 /Library/Java/JavaVirtualMachines || true', { stdio: ['ignore', 'pipe', 'inherit'] }).toString().split(/\r?\n/).filter(Boolean)
      for (const h of homes) {
        if (h.toLowerCase().includes('17') || h.toLowerCase().includes('jdk-17')) {
          const candidate = `/Library/Java/JavaVirtualMachines/${h}/Contents/Home`
          return candidate
        }
      }
    } catch {}

    // Linux locations
    const linuxCandidates = [
      '/usr/lib/jvm/java-17-openjdk-amd64',
      '/usr/lib/jvm/java-17-openjdk',
      '/usr/lib/jvm/zulu17',
      '/usr/lib/jvm/temurin-17-jdk'
    ]
    for (const p of linuxCandidates) {
      try { if (existsSync(p)) return p } catch {}
    }
  } catch {}
  return undefined
}
