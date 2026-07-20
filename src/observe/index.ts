import { createHash } from 'node:crypto'
import { resolveTargetDevice } from '../utils/resolve-device.js'
import { AndroidObserve } from './android.js'
import { iOSObserve } from './ios.js'
import { ToolsNetwork } from '../network/index.js'
import type {
  CaptureDebugSnapshotRawResponse,
  DiagnosticCategory,
  DiagnosticErrorPayload,
  DiagnosticProvider,
  DiagnosticSeverity,
  DiagnosticSourceKind,
  JSONValue,
  NormalizedDiagnosticSignal,
  NormalizedDiagnostics,
  SnapshotSemanticResponse
} from '../types.js'
import { deriveSnapshotMetadata } from './snapshot-metadata.js'

export { AndroidObserve } from './android.js'
export { iOSObserve } from './ios.js'

interface SnapshotTreeElementLike {
  text?: string | null
  contentDescription?: string | null
  contentDesc?: string | null
  accessibilityLabel?: string | null
  resourceId?: string | null
  id?: string | null
  type?: string | null
  class?: string | null
  clickable?: boolean
  enabled?: boolean
  visible?: boolean
  state?: unknown
  stable_id?: string | null
  role?: string | null
  test_tag?: string | null
  selector?: unknown
  semantic?: unknown
}

interface SnapshotTreeLike {
  screen?: string | null
  elements?: SnapshotTreeElementLike[]
}

function normalizeHint(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase()
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function shortActivityName(activity: string | null | undefined): string | null {
  if (!activity) return null
  const trimmed = String(activity).trim()
  if (!trimmed) return null
  const lastSegment = trimmed.split('.').pop() || trimmed
  const withoutSuffix = lastSegment.replace(/Activity$/, '')
  return withoutSuffix ? titleCase(withoutSuffix) : titleCase(lastSegment)
}

function collectSnapshotTexts(tree: SnapshotTreeLike | null | undefined) {
  const elements = Array.isArray(tree?.elements) ? tree!.elements! : []
  const texts: string[] = []
  const actionables: string[] = []

  for (const element of elements) {
    const rawText = element?.text ?? element?.contentDescription ?? element?.contentDesc ?? element?.accessibilityLabel ?? element?.resourceId ?? element?.id ?? ''
    const text = normalizeHint(rawText)
    if (text) texts.push(text)
    if (element?.clickable && element?.enabled !== false && text) {
      actionables.push(text)
    }
  }

  return {
    texts: Array.from(new Set(texts)),
    actionables: Array.from(new Set(actionables))
  }
}

function inferSnapshotScreen(raw: CaptureDebugSnapshotRawResponse): string | null {
  const tree = raw.ui_tree as SnapshotTreeLike | null | undefined
  const treeScreen = normalizeHint(tree?.screen)
  if (treeScreen) return titleCase(treeScreen)

  const activity = shortActivityName(raw.activity)
  if (activity) return activity

  const { texts } = collectSnapshotTexts(tree)
  if (texts.length > 0) return titleCase(texts[0])

  return null
}

function deriveSnapshotSemantic(raw: CaptureDebugSnapshotRawResponse): SnapshotSemanticResponse | null {
  const tree = raw.ui_tree as SnapshotTreeLike | null | undefined
  const { texts, actionables } = collectSnapshotTexts(tree)
  const screenFromTree = normalizeHint(tree?.screen)
  const activityHint = normalizeHint(raw.activity)
  const screen = inferSnapshotScreen(raw)

  if (!screen && !activityHint && texts.length === 0 && !raw.logs.length) return null

  const hasErrorLogs = raw.logs.some((entry) => /error|fatal exception|exception|failed/i.test(entry.message))
  const hasLoadingSignals = texts.some((text) => /loading|please wait|spinner|progress/i.test(text))
  const hasPrimaryText = texts.some((text) => /sign in|log in|login|home|checkout|settings|menu|profile|search/i.test(text))
  const hasScreenshot = typeof raw.screenshot === 'string' && raw.screenshot.length > 0
  const hasUiTree = !!tree && Array.isArray(tree.elements)

  const signals: Record<string, string | number | boolean> = {
    has_activity: !!activityHint,
    has_ui_tree: hasUiTree,
    has_screenshot: hasScreenshot,
    has_visible_text: texts.length > 0,
    has_clickable_elements: actionables.length > 0,
    has_error_logs: hasErrorLogs,
    has_loading_signals: hasLoadingSignals,
    has_primary_text: hasPrimaryText
  }

  const warnings: string[] = []
  if (screenFromTree && activityHint && screenFromTree !== activityHint) {
    warnings.push('ui_tree.screen and activity hints differ')
  }
  if (!hasUiTree) warnings.push('ui tree unavailable')
  if (!activityHint) warnings.push('activity unavailable')
  if (hasErrorLogs) warnings.push('error signals present in logs')

  const evidenceScore =
    (hasUiTree ? 0.35 : 0) +
    (screen ? 0.2 : 0) +
    (activityHint ? 0.15 : 0) +
    (actionables.length > 0 ? 0.15 : 0) +
    (texts.length > 0 ? 0.1 : 0) +
    (hasScreenshot ? 0.05 : 0) +
    (hasErrorLogs ? -0.15 : 0) +
    (hasLoadingSignals ? -0.05 : 0)

  const confidence = Math.max(0, Math.min(1, Number(evidenceScore.toFixed(2))))

  if (!screen && confidence < 0.3) return null

  return {
    screen,
    signals,
    actions_available: actionables.length > 0 ? actionables.slice(0, 10) : null,
    confidence,
    warnings
  }
}

function parseTimestampMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value)
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return null
}

function toJsonValue(value: unknown): JSONValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map((item) => toJsonValue(item))
  if (typeof value === 'object') {
    const out: Record<string, JSONValue> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = toJsonValue(entry)
    }
    return out
  }
  return String(value)
}

function stableStringify(value: JSONValue): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value.replace(/\r\n?/g, '\n'))
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`
}

function hashSignalId(parts: Array<string | number | boolean | null>): string {
  const hash = createHash('sha256')
  hash.update(parts.map((part) => String(part)).join('|'))
  return hash.digest('hex')
}

function mapSeverity(level: string | null | undefined): DiagnosticSeverity {
  const normalized = String(level || '').toUpperCase()
  if (normalized === 'FATAL') return 'FATAL'
  if (normalized === 'ERROR') return 'ERROR'
  if (normalized === 'WARN' || normalized === 'WARNING') return 'WARN'
  if (normalized === 'DEBUG') return 'DEBUG'
  if (normalized === 'VERBOSE' || normalized === 'TRACE') return 'VERBOSE'
  return 'INFO'
}

function mapSourceKindFromLog(message: string, severity: DiagnosticSeverity): DiagnosticSourceKind {
  if (/ANR|application not responding/i.test(message)) return 'anr'
  if ((/crash|terminat(e|ed)|abort/i.test(message) && severity === 'FATAL') || /fatal exception/i.test(message)) return 'crash'
  if (/unhandled exception|exception/i.test(message) || severity === 'ERROR' || severity === 'FATAL') return 'exception'
  if (/http|https|network|request|response|timeout|dns|tls|ssl/i.test(message)) return 'network'
  if (/activity|screen|navigation|route|page/i.test(message)) return 'navigation'
  return 'log'
}

function mapCategoryFromSourceKind(sourceKind: DiagnosticSourceKind): DiagnosticCategory {
  if (sourceKind === 'exception') return 'Exception'
  if (sourceKind === 'crash') return 'Crash'
  if (sourceKind === 'anr') return 'Performance'
  if (sourceKind === 'network') return 'Network'
  if (sourceKind === 'navigation') return 'Navigation'
  if (sourceKind === 'lifecycle') return 'Lifecycle'
  if (sourceKind === 'performance') return 'Performance'
  if (sourceKind === 'ui') return 'UI'
  if (sourceKind === 'custom') return 'Custom'
  return 'Custom'
}

function severityWeight(severity: DiagnosticSeverity): number {
  switch (severity) {
    case 'FATAL': return 200
    case 'ERROR': return 150
    case 'WARN': return 80
    case 'INFO': return 30
    case 'DEBUG': return 10
    case 'VERBOSE': return 0
  }
}

function providerWeight(provider: DiagnosticProvider): number {
  switch (provider) {
    case 'action_trace': return 40
    case 'network_activity': return 30
    case 'unified_logging': return 0
    case 'logcat': return 0
    case 'log_stream': return 0
    case 'current_screen': return 10
    case 'screen_fingerprint': return 5
    case 'ui_tree': return 5
    case 'snapshot': return 5
    default: return 0
  }
}

function categoryWeight(category: DiagnosticCategory): number {
  switch (category) {
    case 'Crash': return 500
    case 'Exception': return 450
    case 'Navigation': return 380
    case 'Network': return 320
    case 'Lifecycle': return 260
    case 'Performance': return 200
    case 'Database': return 160
    case 'UI': return 120
    case 'Accessibility': return 80
    case 'Custom': return 40
  }
}

function normalizeSignalPayload(payload: Record<string, JSONValue>, extra: Record<string, JSONValue> = {}): Record<string, JSONValue> {
  return { ...payload, ...extra }
}

function buildSignalId(signal: Omit<NormalizedDiagnosticSignal, 'signal_id'>): string {
  return hashSignalId([
    signal.platform,
    signal.provider,
    signal.source_kind,
    signal.timestamp_epoch_ms,
    signal.action_id,
    signal.trace_id,
    signal.provider_sequence,
    stableStringify(signal.normalized_payload)
  ])
}

function buildLogSignal(
  entry: any,
  platform: 'android' | 'ios',
  provider: DiagnosticProvider,
  providerSequence: number,
  actionId: string | null,
  timestampWindowEnd: number
): NormalizedDiagnosticSignal | null {
  if (!entry || typeof entry !== 'object') return null
  const message = typeof entry.message === 'string' ? entry.message : typeof entry.msg === 'string' ? entry.msg : String(entry.message ?? entry.msg ?? '')
  const severity = mapSeverity(entry.level || entry.levelName || entry._level)
  const timestampMs = parseTimestampMs(entry.timestamp || entry._iso) ?? timestampWindowEnd
  const sourceKind = mapSourceKindFromLog(message, severity)
  const category = mapCategoryFromSourceKind(sourceKind)
  const normalized_payload = normalizeSignalPayload({
    message,
    tag: typeof entry.tag === 'string' ? entry.tag : null,
    pid: typeof entry.pid === 'number' ? entry.pid : null,
    level: severity,
    source_kind: sourceKind,
    correlation_window_source: actionId ? 'collection_window_fallback' : 'collection_window_fallback'
  })
  const raw_payload = toJsonValue(entry)
  const correlated = actionId !== null
  const candidate: Omit<NormalizedDiagnosticSignal, 'signal_id'> = {
    action_id: correlated ? actionId : null,
    trace_id: correlated ? actionId : null,
    timestamp_epoch_ms: timestampMs,
    platform,
    provider,
    provider_sequence: providerSequence,
    source_kind: sourceKind,
    category,
    severity,
    relevance_score: categoryWeight(category) + severityWeight(severity) + (correlated ? 200 : 0) + providerWeight(provider),
    raw_payload,
    normalized_payload,
    correlated
  }
  return { ...candidate, signal_id: buildSignalId(candidate) }
}

function buildSnapshotSignals(
  raw: CaptureDebugSnapshotRawResponse,
  platform: 'android' | 'ios',
  actionId: string | null,
  nextProviderSequence: () => number
): NormalizedDiagnosticSignal[] {
  const signals: NormalizedDiagnosticSignal[] = []
  const timestampMs = raw.captured_at_ms || raw.timestamp || Date.now()
  if (raw.fingerprint) {
    const sourceKind: DiagnosticSourceKind = 'navigation'
    const category: DiagnosticCategory = 'Navigation'
    const severity: DiagnosticSeverity = 'INFO'
    const candidate: Omit<NormalizedDiagnosticSignal, 'signal_id'> = {
      action_id: actionId,
      trace_id: actionId,
      timestamp_epoch_ms: timestampMs,
      platform,
      provider: 'screen_fingerprint',
      provider_sequence: nextProviderSequence(),
      source_kind: sourceKind,
      category,
      severity,
      relevance_score: categoryWeight(category) + severityWeight(severity) + (actionId ? 200 : 0) + providerWeight('screen_fingerprint'),
      raw_payload: toJsonValue({ fingerprint: raw.fingerprint, activity: raw.activity }),
      normalized_payload: {
        fingerprint: raw.fingerprint,
        activity: raw.activity,
        correlation_window_source: actionId ? 'collection_window_fallback' : 'collection_window_fallback'
      },
      correlated: actionId !== null
    }
    signals.push({ ...candidate, signal_id: buildSignalId(candidate) })
  }
  if (raw.activity) {
    const sourceKind: DiagnosticSourceKind = 'lifecycle'
    const category: DiagnosticCategory = 'Lifecycle'
    const severity: DiagnosticSeverity = 'INFO'
    const candidate: Omit<NormalizedDiagnosticSignal, 'signal_id'> = {
      action_id: actionId,
      trace_id: actionId,
      timestamp_epoch_ms: timestampMs,
      platform,
      provider: 'current_screen',
      provider_sequence: nextProviderSequence(),
      source_kind: sourceKind,
      category,
      severity,
      relevance_score: categoryWeight(category) + severityWeight(severity) + (actionId ? 200 : 0) + providerWeight('current_screen'),
      raw_payload: toJsonValue({ activity: raw.activity }),
      normalized_payload: {
        activity: raw.activity,
        correlation_window_source: actionId ? 'collection_window_fallback' : 'collection_window_fallback'
      },
      correlated: actionId !== null
    }
    signals.push({ ...candidate, signal_id: buildSignalId(candidate) })
  }
  return signals
}

function buildActionTraceSignal(
  actionId: string,
  platform: 'android' | 'ios',
  providerSequence: number,
  timestampEpochMs: number
): NormalizedDiagnosticSignal {
  const candidate: Omit<NormalizedDiagnosticSignal, 'signal_id'> = {
    action_id: actionId,
    trace_id: actionId,
    timestamp_epoch_ms: timestampEpochMs,
    platform,
    provider: 'action_trace',
    provider_sequence: providerSequence,
    source_kind: 'trace',
    category: 'Lifecycle',
    severity: 'INFO',
    relevance_score: categoryWeight('Lifecycle') + severityWeight('INFO') + 200 + providerWeight('action_trace'),
    raw_payload: { action_id: actionId },
    normalized_payload: {
      action_id: actionId,
      correlation_window_source: 'collection_window_fallback'
    },
    correlated: true
  }
  return { ...candidate, signal_id: buildSignalId(candidate) }
}

function buildNetworkSignals(
  requests: Array<{ endpoint: string; method: string; statusCode: number | null; status: string; durationMs: number; timestampMs: number }>,
  platform: 'android' | 'ios',
  actionId: string | null,
  nextProviderSequence: () => number
): NormalizedDiagnosticSignal[] {
  const signals: NormalizedDiagnosticSignal[] = []
  for (const request of requests) {
    const severity: DiagnosticSeverity =
      request.status === 'failure' ? 'ERROR' :
      request.status === 'retryable' ? 'WARN' :
      request.statusCode !== null && request.statusCode >= 400 ? 'ERROR' :
      'INFO'
    const timestampEpochMs = request.timestampMs || Date.now()
    const normalized_payload = {
      endpoint: request.endpoint,
      method: request.method,
      status_code: request.statusCode,
      status: request.status,
      duration_ms: request.durationMs,
      correlation_window_source: actionId ? 'collection_window_fallback' : 'collection_window_fallback'
    }
    const candidate: Omit<NormalizedDiagnosticSignal, 'signal_id'> = {
      action_id: actionId,
      trace_id: actionId,
      timestamp_epoch_ms: timestampEpochMs,
      platform,
      provider: 'network_activity',
      provider_sequence: nextProviderSequence(),
      source_kind: 'network',
      category: 'Network',
      severity,
      relevance_score: categoryWeight('Network') + severityWeight(severity) + (actionId ? 200 : 0) + providerWeight('network_activity'),
      raw_payload: toJsonValue(request),
      normalized_payload,
      correlated: actionId !== null
    }
    signals.push({ ...candidate, signal_id: buildSignalId(candidate) })
  }
  return signals
}

function buildDiagnosticErrors(raw: CaptureDebugSnapshotRawResponse): DiagnosticErrorPayload[] {
  const entries: Array<[keyof CaptureDebugSnapshotRawResponse, string | undefined]> = [
    ['screenshot_error', raw.screenshot_error],
    ['activity_error', raw.activity_error],
    ['fingerprint_error', raw.fingerprint_error],
    ['ui_tree_error', raw.ui_tree_error],
    ['logs_error', raw.logs_error],
    ['network_activity_error', raw.network_activity_error]
  ]

  return entries.flatMap(([key, value]) => {
    if (!value) return []
    const message = String(value)
    const code =
      /unsupported/i.test(message) ? 'UNSUPPORTED_SIGNAL_SOURCE' :
      /parse/i.test(message) ? 'SIGNAL_PARSE_FAILED' :
      /timeout/i.test(message) ? 'SIGNAL_TIMEOUT' :
      'SIGNAL_SOURCE_UNAVAILABLE'
    return [{
      code,
      message,
      details: toJsonValue({ source: key, message }) as { [key: string]: JSONValue }
    }]
  })
}

function buildNormalizedDiagnostics(
  raw: CaptureDebugSnapshotRawResponse,
  platform: 'android' | 'ios',
  actionId: string | null,
  collectionWindowMs: number,
  includeUncorrelated: boolean,
  logProvider: DiagnosticProvider,
  networkRequests: Array<{ endpoint: string; method: string; statusCode: number | null; status: string; durationMs: number; timestampMs: number }>
): NormalizedDiagnostics {
  const ended_at_ms = raw.captured_at_ms || raw.timestamp || Date.now()
  const started_at_ms = ended_at_ms - collectionWindowMs
  const signals: NormalizedDiagnosticSignal[] = []
  let providerSequence = 0
  const nextProviderSequence = () => {
    providerSequence += 1
    return providerSequence
  }
  const logSignals = (Array.isArray(raw.logs) ? raw.logs : [])
    .map((entry) => buildLogSignal(entry, platform, logProvider, nextProviderSequence(), actionId, ended_at_ms))
    .filter((signal): signal is NormalizedDiagnosticSignal => signal !== null)
    .filter((signal) => signal.timestamp_epoch_ms >= started_at_ms && signal.timestamp_epoch_ms <= ended_at_ms)

  signals.push(...logSignals)
  signals.push(...buildSnapshotSignals(raw, platform, actionId, nextProviderSequence))
  signals.push(...buildNetworkSignals(networkRequests, platform, actionId, nextProviderSequence))
  if (actionId) {
    signals.push(buildActionTraceSignal(actionId, platform, nextProviderSequence(), ended_at_ms))
  }

  const deduped = new Map<string, NormalizedDiagnosticSignal>()
  for (const signal of signals) {
    if (!includeUncorrelated && !signal.correlated) continue
    if (signal.timestamp_epoch_ms < started_at_ms || signal.timestamp_epoch_ms > ended_at_ms) continue
    deduped.set(signal.signal_id, signal)
  }

  const orderedSignals = Array.from(deduped.values()).sort((a, b) => {
    if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score
    const categoryOrder: DiagnosticCategory[] = ['Crash', 'Exception', 'Navigation', 'Network', 'Lifecycle', 'Performance', 'Database', 'UI', 'Accessibility', 'Custom']
    const aCat = categoryOrder.indexOf(a.category)
    const bCat = categoryOrder.indexOf(b.category)
    if (aCat !== bCat) return aCat - bCat
    const severityOrder: DiagnosticSeverity[] = ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'VERBOSE']
    const aSeverity = severityOrder.indexOf(a.severity)
    const bSeverity = severityOrder.indexOf(b.severity)
    if (aSeverity !== bSeverity) return aSeverity - bSeverity
    if (b.timestamp_epoch_ms !== a.timestamp_epoch_ms) return b.timestamp_epoch_ms - a.timestamp_epoch_ms
    return a.signal_id.localeCompare(b.signal_id)
  })

  return {
    collection_window: {
      scope: 'request',
      duration_ms: collectionWindowMs,
      started_at_ms,
      ended_at_ms
    },
    signals: orderedSignals,
    errors: buildDiagnosticErrors(raw)
  }
}

export class ToolsObserve {
  // Resolve a target device and return the appropriate observe instance and resolved info.
  private static async resolveObserve(platform?: 'android' | 'ios', deviceId?: string, appId?: string) {
    if (platform === 'android') {
      const resolved = await resolveTargetDevice({ platform: 'android', deviceId, appId })
      return { observe: new AndroidObserve(), resolved }
    }
    if (platform === 'ios') {
      const resolved = await resolveTargetDevice({ platform: 'ios', deviceId, appId })
      return { observe: new iOSObserve(), resolved }
    }

    // No platform specified: try android then ios
    try {
      const resolved = await resolveTargetDevice({ platform: 'android', deviceId, appId })
      return { observe: new AndroidObserve(), resolved }
    } catch {
      const resolved = await resolveTargetDevice({ platform: 'ios', deviceId, appId })
      return { observe: new iOSObserve(), resolved }
    }
  }

  static async getUITreeHandler({ platform, deviceId }: { platform?: 'android' | 'ios', deviceId?: string }) {
    const { observe, resolved } = await ToolsObserve.resolveObserve(platform, deviceId)
    return await observe.getUITree(resolved.id)
  }

  static async getCurrentScreenHandler({ deviceId }: { deviceId?: string }) {
    const { observe, resolved } = await ToolsObserve.resolveObserve('android', deviceId)
    // getCurrentScreen is Android-specific
    return await (observe as AndroidObserve).getCurrentScreen(resolved.id)
  }

  static async getLogsHandler({ platform, appId, deviceId, pid, tag, level, contains, since_seconds, limit, lines }: { platform?: 'android' | 'ios', appId?: string, deviceId?: string, pid?: number, tag?: string, level?: string, contains?: string, since_seconds?: number, limit?: number, lines?: number }) {
    const { observe, resolved } = await ToolsObserve.resolveObserve(platform, deviceId, appId)
    const filters = { appId, deviceId: resolved.id, pid, tag, level, contains, since_seconds, limit: limit ?? lines }

    // Validate filters
    if (level && !['VERBOSE','DEBUG','INFO','WARN','ERROR'].includes(level.toString().toUpperCase())) {
      return { device: resolved, logs: [], crashLines: [], logCount: 0, error: { code: 'INVALID_FILTER', message: `Unsupported level filter: ${level}` } } as any
    }

    if (observe instanceof AndroidObserve) {
      const response = await observe.getLogs(filters)
      const logs = Array.isArray(response.logs) ? response.logs : []
      const crashLines = logs.filter(entry => /FATAL EXCEPTION/i.test(entry.message))
      const anyFilterApplied = !!(appId || pid || tag || level || contains || since_seconds)
      if (anyFilterApplied && logs.length === 0) return { device: response.device, logs: [], crashLines: [], logCount: 0, source: response.source, meta: response.meta, error: { code: 'LOGS_UNAVAILABLE', message: 'No logs match filters' } } as any
      return { device: response.device, logs, crashLines, logCount: response.logCount, source: response.source, meta: response.meta }
    } else {
      const resp = await (observe as iOSObserve).getLogs(filters)
      const logs = Array.isArray(resp.logs) ? resp.logs : []
      const crashLines = logs.filter(entry => /FATAL EXCEPTION/i.test(entry.message))
      const anyFilterApplied = !!(appId || pid || tag || level || contains || since_seconds)
      if (anyFilterApplied && logs.length === 0) return { device: resp.device, logs: [], crashLines: [], logCount: 0, source: resp.source, meta: resp.meta, error: { code: 'LOGS_UNAVAILABLE', message: 'No logs match filters' } } as any
      return { device: resp.device, logs, crashLines, logCount: resp.logCount, source: resp.source, meta: resp.meta }
    }
  }

  static async startLogStreamHandler({ platform, packageName, level, sessionId, deviceId }: { platform?: 'android' | 'ios', packageName: string, level?: 'error' | 'warn' | 'info' | 'debug', sessionId?: string, deviceId?: string }) {
    const sid = sessionId || 'default'
    const { observe, resolved } = await ToolsObserve.resolveObserve(platform, deviceId, packageName)
    if (observe instanceof AndroidObserve) {
      return await observe.startLogStream(packageName, level || 'error', resolved.id, sid)
    } else {
      return await (observe as iOSObserve).startLogStream(packageName, resolved.id, sid)
    }
  }

  static async readLogStreamHandler({ platform, sessionId, limit, since }: { platform?: 'android' | 'ios', sessionId?: string, limit?: number, since?: string }) {
    const sid = sessionId || 'default'
    const { observe } = await ToolsObserve.resolveObserve(platform)
    return await (observe as any).readLogStream(sid, limit ?? 100, since)
  }

  static async stopLogStreamHandler({ platform, sessionId }: { platform?: 'android' | 'ios', sessionId?: string }) {
    const sid = sessionId || 'default'
    const { observe } = await ToolsObserve.resolveObserve(platform)
    return await (observe as any).stopLogStream(sid)
  }

  static async captureScreenshotHandler({ platform, deviceId }: { platform?: 'android' | 'ios', deviceId?: string }) {
    const { observe, resolved } = await ToolsObserve.resolveObserve(platform, deviceId)
    if (observe instanceof AndroidObserve) {
      return await observe.captureScreen(resolved.id)
    } else {
      return await (observe as iOSObserve).captureScreenshot(resolved.id)
    }
  }

  static async getScreenFingerprintHandler({ platform, deviceId }: { platform?: 'android' | 'ios', deviceId?: string } = {}) {
    const { observe, resolved } = await ToolsObserve.resolveObserve(platform, deviceId)
    // Both observes implement getScreenFingerprint
    return await (observe as any).getScreenFingerprint(resolved.id)
  }

  static async captureDebugSnapshotHandler({ reason, includeLogs = true, logLines = 200, collection_window_ms = 10000, include_uncorrelated = false, action_id, platform, appId, deviceId, sessionId }: { reason?: string; includeLogs?: boolean; logLines?: number; collection_window_ms?: number; include_uncorrelated?: boolean; action_id?: string; platform?: 'android' | 'ios'; appId?: string; deviceId?: string; sessionId?: string } = {}) {
    const timestamp = Date.now()
    let logProvider: DiagnosticProvider = platform === 'android' ? 'logcat' : 'unified_logging'
    let networkRequests: Array<{ endpoint: string; method: string; statusCode: number | null; status: string; durationMs: number; timestampMs: number }> = []
    const raw: CaptureDebugSnapshotRawResponse = {
      timestamp,
      snapshot_revision: 0,
      captured_at_ms: timestamp,
      reason: reason || '',
      activity: null,
      fingerprint: null,
      screenshot: null,
      ui_tree: null,
      logs: []
    }

    // Parallel fetches for performance: screenshot, current screen, fingerprint, ui tree, and log stream/get logs
    const sid = sessionId || 'default'
    const tasks: Record<string, Promise<any>> = {
      screenshot: ToolsObserve.captureScreenshotHandler({ platform, deviceId }),
      currentScreen: (!platform || platform === 'android') ? ToolsObserve.getCurrentScreenHandler({ deviceId }) : Promise.resolve(null),
      fingerprint: ToolsObserve.getScreenFingerprintHandler({ platform, deviceId }),
      uiTree: ToolsObserve.getUITreeHandler({ platform, deviceId }),
      readLogStream: includeLogs ? ToolsObserve.readLogStreamHandler({ platform, sessionId: sid, limit: logLines }) : Promise.resolve({ entries: [] }),
      networkActivity: platform ? ToolsNetwork.getNetworkActivity({ platform, deviceId }) : Promise.resolve({ requests: [], count: 0 })
    }

    const results = await Promise.allSettled(Object.values(tasks))
    const keys = Object.keys(tasks)

    // Map results back to keys
    for (let i = 0; i < results.length; i++) {
      const key = keys[i]
      const res = results[i] as PromiseSettledResult<any>
      if (res.status === 'fulfilled') {
        const val = res.value
        if (key === 'screenshot') {
          raw.screenshot = val && val.screenshot ? val.screenshot : null
        } else if (key === 'currentScreen') {
          raw.activity = val && ((val.activity || val.shortActivity)) ? (val.activity || val.shortActivity) : raw.activity || ''
        } else if (key === 'fingerprint') {
          if (val && val.fingerprint) raw.fingerprint = val.fingerprint
          if (val && val.activity) raw.activity = raw.activity || val.activity
          if (val && val.error) raw.fingerprint_error = val.error
        } else if (key === 'uiTree') {
          raw.ui_tree = val
          if (val && val.error) raw.ui_tree_error = val.error
        } else if (key === 'readLogStream') {
          // handle below after evaluating fallback
          // temporarily attach to out._streamEntries
          raw.logs = Array.isArray(val?.entries) ? val.entries : []
          if (raw.logs.length > 0) logProvider = 'log_stream'
        } else if (key === 'networkActivity') {
          if (val && Array.isArray(val.requests)) networkRequests = val.requests
          raw.network_activity_error = val && val.error ? String(val.error) : raw.network_activity_error
        }
      } else {
        const errMsg = res.reason instanceof Error ? res.reason.message : String(res.reason)
        if (key === 'screenshot') raw.screenshot_error = errMsg
        if (key === 'currentScreen') raw.activity_error = errMsg
        if (key === 'fingerprint') { raw.fingerprint = null; raw.fingerprint_error = errMsg }
        if (key === 'uiTree') { raw.ui_tree = null; raw.ui_tree_error = errMsg }
        if (key === 'readLogStream') { raw.logs = []; raw.logs_error = errMsg }
        if (key === 'networkActivity') { raw.network_activity_error = errMsg }
      }
    }

    // Logs: prefer stream entries, fallback to snapshot logs when empty
    if (includeLogs) {
      try {
        let entries: any[] = Array.isArray(raw.logs) ? raw.logs : []
        if (!entries || entries.length === 0) {
          const gl = await ToolsObserve.getLogsHandler({ platform, appId, deviceId, lines: logLines })
          const snapshotLogs: any[] = (gl && (gl as any).logs) ? (gl as any).logs : []
          logProvider = platform === 'android' ? 'logcat' : 'unified_logging'
          // raw may be structured entries or strings
          entries = snapshotLogs.slice(-Math.max(0, logLines)).map(item => {
            if (!item) return { timestamp: null, level: 'INFO', message: '' }
            if (typeof item === 'string') {
              const level = /\b(FATAL EXCEPTION|ERROR| E )\b/i.test(item) ? 'ERROR' : /\b(WARN| W )\b/i.test(item) ? 'WARN' : 'INFO'
              return { timestamp: null, level, message: item }
            }
            const msg = item.message || item.msg || JSON.stringify(item)
            const levelRaw = item.level || item.levelName || item._level || ''
            const level = (levelRaw && String(levelRaw)).toUpperCase() || (/\bERROR\b/i.test(msg) ? 'ERROR' : /\bWARN\b/i.test(msg) ? 'WARN' : 'INFO')
            const ts = item.timestamp || item._iso || null
            const tsNum = (ts && typeof ts === 'string') ? (isNaN(new Date(ts).getTime()) ? null : new Date(ts).getTime()) : (typeof ts === 'number' ? ts : null)
            return { timestamp: tsNum, level, message: msg }
          })
        } else {
          entries = entries.map(ent => {
            const msg = (ent && (ent.message || ent.msg)) ? (ent.message || ent.msg) : (typeof ent === 'string' ? ent : JSON.stringify(ent))
            const levelRaw = (ent && (ent.level || ent.levelName || ent._level)) ? (ent.level || ent.levelName || ent._level) : ''
            const level = (levelRaw && String(levelRaw)).toString().toUpperCase() || (/\bERROR\b/i.test(msg) ? 'ERROR' : /\bWARN\b/i.test(msg) ? 'WARN' : 'INFO')
            let tsNum: number | null = null
            const maybeIso = ent && ((ent._iso || ent.timestamp) as any)
            if (maybeIso && typeof maybeIso === 'string') {
              const d = new Date(maybeIso)
              if (!isNaN(d.getTime())) tsNum = d.getTime()
            }
            return { timestamp: tsNum, level, message: msg }
          })
        }

        raw.logs = entries
      } catch (e) {
        raw.logs = []
        raw.logs_error = e instanceof Error ? e.message : String(e)
      }
    }

    const snapshotDeviceKey = raw.ui_tree?.device
      ? `${raw.ui_tree.device.platform}:${raw.ui_tree.device.id}`
      : `${platform || 'unknown'}:${deviceId || 'default'}`
    const snapshotMetadata = deriveSnapshotMetadata(
      snapshotDeviceKey,
      raw.ui_tree,
      'snapshot',
      raw.ui_tree?.snapshot_revision ? null : (raw.fingerprint || raw.activity || null)
    )

    raw.snapshot_revision = raw.ui_tree?.snapshot_revision ?? snapshotMetadata.snapshot_revision
    raw.captured_at_ms = raw.ui_tree?.captured_at_ms ?? snapshotMetadata.captured_at_ms
    raw.snapshot_delta = raw.ui_tree?.snapshot_delta ?? snapshotMetadata.snapshot_delta ?? null
    raw.loading_state = raw.ui_tree?.loading_state ?? snapshotMetadata.loading_state

    const semanticBase = deriveSnapshotSemantic(raw) ?? {
      screen: null,
      signals: null,
      actions_available: null,
      confidence: 0,
      warnings: []
    }
    const diagnostics = buildNormalizedDiagnostics(
      raw,
      (raw.device?.platform as 'android' | 'ios') || platform || 'android',
      action_id ?? null,
      Math.max(1000, Math.min(60000, Math.floor(collection_window_ms))),
      include_uncorrelated,
      logProvider,
      networkRequests
    )
    const semantic = {
      ...semanticBase,
      diagnostics
    }
    return { raw, semantic }
  }
}
