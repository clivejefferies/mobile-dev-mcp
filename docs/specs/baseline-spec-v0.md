# Baseline Spec v0

## 1. System Overview

The MCP surface is defined in `src/server/tool-definitions.ts` and dispatched in `src/server/tool-handlers.ts`. Tools are grouped in code by module, not by an explicit runtime taxonomy: **manage**, **observe**, **interact**, **network/classification**, and **system**.

Agents interact with tools by name through `handleToolCall(name, args)`. Most handlers return a **single text content block containing JSON** via `wrapResponse(...)`. Exceptions are observable in code:

| Tool | MCP content shape |
| --- | --- |
| most tools | one text block with JSON |
| `get_logs` | two text blocks: metadata JSON, then logs JSON |
| `capture_screenshot` | one text block with JSON metadata, then one or more image blocks |
| `build_and_install` | one NDJSON text block, then one JSON text block |
| uncaught handler error | one plain text error string, not wrapped JSON |

Observable execution flow for state-mutating action tools at the MCP boundary:

1. resolve device/platform
2. call `ToolsNetwork.notifyActionStart()`
3. capture UI fingerprint before the action
4. execute the platform action
5. capture UI fingerprint after the action
6. wrap the result into an action envelope

That flow is applied to `start_app`, `restart_app`, `tap`, `swipe`, `scroll_to_element`, `type_text`, and `press_back`. `tap_element` builds a similar envelope inside `src/interact/index.ts` rather than through the shared wrapper.

## 2. Tool Inventory

### Manage / lifecycle

| Tool | Purpose | Inputs | Outputs | Side effects |
| --- | --- | --- | --- | --- |
| `start_app` | Launch app on Android or iOS. | `{ platform: 'android'\|'ios', appId: string, deviceId?: string }` | `ActionExecutionResult` JSON with `device` and `details` (`launch_time_ms`, `device_id`, `output?`, `observed_app?`, `error?`). | Launches app, captures fingerprints, resets network window. |
| `terminate_app` | Stop app process. | `{ platform: 'android'\|'ios', appId: string, deviceId?: string }` | `{ terminated: boolean, device: DeviceInfo }` | Terminates app. |
| `restart_app` | Terminate then relaunch app. | `{ platform: 'android'\|'ios', appId: string, deviceId?: string }` | `ActionExecutionResult` JSON with `device` and restart `details` (`terminated_before_restart`, `terminate_error?`, `output?`, `observed_app?`, `error?`). | Stops and launches app, captures fingerprints, resets network window. |
| `reset_app_data` | Clear app storage / simulator container data. | `{ platform: 'android'\|'ios', appId: string, deviceId?: string }` | `{ reset: boolean, device: DeviceInfo }` | Clears app state. |
| `install_app` | Install built artifact or project output. | `{ platform: 'android'\|'ios', projectType: 'native'\|'kmp'\|'react-native'\|'flutter', appPath: string, deviceId?: string }` | `{ device: DeviceInfo, installed: boolean, output?: string, error?: string }` | Installs app; Android may push APK/AAB and run `pm install`; iOS may use `simctl` or `idb`. |
| `build_app` | Build project and return artifact path. | `{ platform: 'android'\|'ios', projectType: ..., projectPath: string, variant?: string }` | Build result JSON from platform builder, including artifact path on success or `error`. | Runs Gradle or Xcode build. |
| `build_and_install` | Build then install, streaming progress. | `{ platform: 'android'\|'ios', projectType: ..., projectPath: string, deviceId?: string, variant?: string }` | MCP response has NDJSON event block plus result JSON `{ success: boolean, artifactPath?: string, device?: DeviceInfo, output?: string, error?: string }`. | Builds, installs, emits progress events. |
| `list_devices` | Enumerate available devices. | `{ platform?: 'android'\|'ios', appId?: string }` | `{ devices: DeviceInfo[] }` (runtime objects may also include `appInstalled`/`booted`). | Reads device lists. |

### Observe / inspect

| Tool | Purpose | Inputs | Outputs | Side effects |
| --- | --- | --- | --- | --- |
| `get_logs` | Fetch recent device logs. | `{ platform: 'android'\|'ios', appId?: string, deviceId?: string, pid?: number, tag?: string, level?: string, contains?: string, since_seconds?: number, limit?: number, lines?: number }` | Two text blocks: metadata `{ device, result: { count, filtered, crashLines, source, meta } }`, then `{ logs: [...] }`. | Reads platform logs. |
| `capture_screenshot` | Capture current screenshot. | `{ platform: 'android'\|'ios', deviceId?: string }` | Text metadata block plus image block(s). | Captures screenshot; uses temp files. |
| `capture_debug_snapshot` | Bundle screenshot, UI tree, screen, fingerprint, and logs. | `{ reason?: string, includeLogs?: boolean, logLines?: number, platform?: 'android'\|'ios', appId?: string, deviceId?: string, sessionId?: string }` | Wrapped JSON snapshot object with device metadata, screenshot metadata, UI tree, fingerprint, current screen, and logs/errors. | Captures multiple observations. |
| `start_log_stream` | Start background structured log stream. | `{ platform?: 'android'\|'ios', packageName: string, level?: 'error'\|'warn'\|'info'\|'debug', deviceId?: string, sessionId?: string }` | `{ success: boolean, stream_started?: boolean, device_id?: string, pid?: number, error?: string }` | Starts long-lived log process, writes NDJSON file. |
| `read_log_stream` | Read accumulated streamed logs. | `{ sessionId?: string }` | `{ entries: any[], crash_summary?: { crash_detected: boolean, exception?: string, sample?: string } }` | Reads stream file; no new device action. |
| `stop_log_stream` | Stop background log stream. | `{ sessionId?: string }` | `{ success: boolean }` | Stops stream process and clears session entry. |
| `get_ui_tree` | Return current UI hierarchy. | `{ platform: 'android'\|'ios', deviceId?: string }` | `GetUITreeResponse` with `device`, `elements`, `resolution`, optional `error`. | Dumps UI hierarchy; Android writes/pulls XML; iOS queries via `idb`. |
| `get_current_screen` | Return visible Android activity. | `{ deviceId?: string }` | `GetCurrentScreenResponse` with `device`, `activity`, `package`, `shortActivity?`, `error?`. | Reads `dumpsys`; Android only. |
| `get_screen_fingerprint` | Compute stable screen fingerprint from UI tree and current screen. | `{ platform?: 'android'\|'ios', deviceId?: string }` | `{ fingerprint: string\|null, activity?: string, error?: string }` | Reads UI tree and, on Android, current screen. |

### Interact / wait / verify

| Tool | Purpose | Inputs | Outputs | Side effects |
| --- | --- | --- | --- | --- |
| `wait_for_screen_change` | Wait until fingerprint differs from provided previous fingerprint. | `{ platform?: 'android'\|'ios', previousFingerprint: string, timeoutMs?: number, pollIntervalMs?: number, deviceId?: string }` | `{ success: boolean, previousFingerprint, newFingerprint?\|lastFingerprint?, elapsedMs, observed_screen: { fingerprint, activity }, reason?: 'timeout' }` | Polls fingerprints. |
| `expect_screen` | Exact check against expected fingerprint or screen name. | `{ platform?: 'android'\|'ios', fingerprint?: string, screen?: string, deviceId?: string }` | `{ success, observed_screen, expected_screen, confidence, comparison: { basis, matched, reason } }` | Reads fingerprint/current screen. |
| `expect_element_visible` | Binary visible check for selector. | `{ selector: { text?: string, resource_id?: string, accessibility_id?: string, contains?: boolean }, element_id?: string, timeout_ms?: number, poll_interval_ms?: number, platform?: 'android'\|'ios', deviceId?: string }` | `{ success, selector, element_id, expected_condition: 'visible', element?, observed, reason, failure_code?, retryable? }` | Polls UI tree through `wait_for_ui`. |
| `wait_for_ui` | Deterministic UI wait and element resolution. | `{ selector?: { text?: string, resource_id?: string, accessibility_id?: string, contains?: boolean }, condition?: 'exists'\|'not_exists'\|'visible'\|'clickable', timeout_ms?: number, poll_interval_ms?: number, match?: { index?: number }, retry?: { max_attempts?: number, backoff_ms?: number }, platform?: 'android'\|'ios', deviceId?: string }` | Success: `{ status:'success', matched, element, metrics, requested, observed }`; failure: `{ status:'timeout', error:{code,message}, metrics, requested, observed }`. | Polls UI tree; resolves actionable ancestor for `clickable`. |
| `find_element` | Heuristic semantic element search. | `{ query: string, exact?: boolean, timeoutMs?: number, platform?: 'android'\|'ios', deviceId?: string }` | `{ found: true, element, score, confidence }` or `{ found: false, error }` | Polls UI tree; no mutation. |

### Action / mutation

| Tool | Purpose | Inputs | Outputs | Side effects |
| --- | --- | --- | --- | --- |
| `tap` | Tap coordinates. | `{ x: number, y: number, platform?: 'android'\|'ios', deviceId?: string }` | `ActionExecutionResult` | Taps screen; captures fingerprints; resets network window. |
| `tap_element` | Tap resolved UI element by `elementId`. | `{ elementId: string }` | Action-style JSON with `action_type: 'tap_element'`, target selector/resolved element, `success`, fingerprints, `failure_code?`, `retryable?`. | Reads cached element/UI context, validates element, taps it, resets network window. |
| `swipe` | Swipe coordinates. | `{ platform?: 'android'\|'ios', x1, y1, x2, y2, duration, deviceId?: string }` | `ActionExecutionResult` | Swipes screen; captures fingerprints; resets network window. |
| `scroll_to_element` | Repeatedly scroll until matching visible element is found. | `{ platform: 'android'\|'ios', selector: { text?: string, resourceId?: string, contentDesc?: string, className?: string }, direction?: 'down'\|'up', maxScrolls?: number, scrollAmount?: number, deviceId?: string }` | `ActionExecutionResult` | Repeated swipes plus UI tree checks; resets network window. |
| `type_text` | Type text into focused field. | `{ platform?: 'android', text: string, deviceId?: string }` | `ActionExecutionResult` | Android text input; captures fingerprints; resets network window. |
| `press_back` | Send Android Back key. | `{ platform?: 'android', deviceId?: string }` | `ActionExecutionResult` | Android back action; captures fingerprints; resets network window. |

### Classification / network / system

| Tool | Purpose | Inputs | Outputs | Side effects |
| --- | --- | --- | --- | --- |
| `classify_action_outcome` | Deterministic rule-based classifier over supplied signals. | `{ uiChanged: boolean, expectedElementVisible?: boolean, networkRequests?: { url?: string, status: 'success'\|'failure'\|'retryable' }[], hasLogErrors?: boolean }` | `{ outcome: 'success'\|'no_op'\|'backend_failure'\|'ui_failure'\|'unknown', reasoning: string, nextAction?: 'call_get_network_activity' }` | Pure computation. |
| `get_network_activity` | Return normalized request events since last action window. | `{}` | `{ requests: NetworkRequestSummary[], count: number }` | Reads logs, advances internal `lastConsumedTimestamp`. |
| `get_system_status` | Aggregate Android/iOS/Gradle readiness. | `{}` | Additive response: legacy flat fields remain available, with nested `host`, `android`, and `ios` objects added alongside them. | Reads toolchain/device state. |

## 3. Action Tools (Mutation Tools)

| Tool | Actual output shape | Success reporting | Failure structure | Retry logic |
| --- | --- | --- | --- | --- |
| `start_app` | `ActionExecutionResult` + `device` + `details` | `success` mirrors underlying launch success | `failure_code` inferred generically; raw launch `error` only appears in `details` | none |
| `terminate_app` | `{ terminated: boolean, device }` | `terminated === true` | no standardized failure code; boolean only at MCP layer | none |
| `restart_app` | `ActionExecutionResult` + `device` + restart `details` | `success` mirrors underlying restart success | `failure_code` inferred generically; terminate/start details kept in `details` | no retry; always does terminate then start |
| `reset_app_data` | `{ reset: boolean, device }` | `reset === true` | no standardized failure code | none |
| `install_app` | `{ device, installed, output?, error? }` | `installed === true` | unstructured `error` string; no action envelope | Android has internal fallback paths; iOS may fall back from `simctl` to `idb` |
| `build_and_install` | NDJSON event stream + `{ success, artifactPath?, device?, output?, error? }` | final `success === true` | unstructured `error`; build/install phases encoded in NDJSON | build and install internals may retry depending on platform helpers |
| `tap` | `ActionExecutionResult` | `success` means command executed | `failure_code`/`retryable` inferred from generic error text; raw error omitted | none |
| `tap_element` | action-style JSON built in `src/interact/index.ts` | `success` means element was resolved and tap dispatched | structured `failure_code` from `ActionFailureCode`; includes `retryable` | none |
| `swipe` | `ActionExecutionResult` | command executed | generic inferred `failure_code` | none |
| `scroll_to_element` | `ActionExecutionResult` | **different semantics**: success means target element became visible during scroll loop | `failure_code` inferred by scroll-specific string matching | internal loop up to `maxScrolls` |
| `type_text` | `ActionExecutionResult` | command executed | generic inferred `failure_code` | none |
| `press_back` | `ActionExecutionResult` | command executed | generic inferred `failure_code` | none |

**Observed inconsistency:** `start_app`/`restart_app` expose `device` and rich `details`; `tap`/`swipe`/`type_text`/`press_back` do not. `scroll_to_element` reports an outcome-oriented success, while the others mostly report execution success.

## 4. Observation and Wait Tools

### `wait_for_ui`

- **Role:** both waits and resolves.
- **Signals used:** only the current UI tree from `get_ui_tree`.
- **Behavior:** filters elements by selector, supports `match.index`, evaluates `exists` / `not_exists` / `visible` / `clickable`, and resolves an actionable ancestor for `clickable`.
- **Output:** descriptive, not binary. Returns `requested`, `observed`, `metrics`, and optionally `element`.
- **Success model:** `status: 'success'`; otherwise `status: 'timeout'` with structured `error`.

### `wait_for_screen_change`

- **Role:** wait only.
- **Signals used:** screen fingerprints from `get_screen_fingerprint`.
- **Behavior:** polls until fingerprint differs from `previousFingerprint`, then performs a confirmation read for stability.
- **Output:** binary `success` plus descriptive `observed_screen`, elapsed time, and either `newFingerprint` or `lastFingerprint`.

### `find_element`

- **Role:** resolve only.
- **Signals used:** UI tree.
- **Behavior:** heuristic scoring over text/content/resource/class; if best element is not interactable it tries to resolve a clickable ancestor.
- **Output:** descriptive, scored result (`score`, `confidence`) or `{ found:false, error }`.

### `get_ui_tree`

- **Role:** inspect only.
- **Signals used:** platform accessibility/UI dump.
- **Output:** raw tree data with `elements`, `resolution`, and `device`.
- **Notes:** Android and iOS each retry internally up to three attempts.

### `get_current_screen`

- **Role:** inspect only.
- **Signals used:** Android activity manager / window dumps.
- **Output:** current package/activity object.
- **Notes:** Android-only.

### `get_screen_fingerprint`

- **Role:** inspect only.
- **Signals used:** UI tree plus current screen on Android.
- **Behavior:** normalizes a subset of visible, structurally significant elements and hashes them.
- **Output:** `{ fingerprint, activity?, error? }`.
- **Notes:** iOS fingerprint omits activity in the hash payload.

### Log/snapshot observation

- `get_logs` returns structured metadata plus raw/structured log entries.
- `start_log_stream` / `read_log_stream` / `stop_log_stream` manage background NDJSON log capture.
- `capture_screenshot` and `capture_debug_snapshot` provide point-in-time observation artifacts.

## 5. Existing Verification Mechanisms

| Mechanism | Success rule | Determinism | Ambiguity |
| --- | --- | --- | --- |
| `expect_screen` | exact fingerprint equality, else exact screen-name equality | binary and deterministic | if only `screen` is provided, Android may use either fingerprint-derived `activity` or `get_current_screen` label |
| `expect_element_visible` | delegated `wait_for_ui(condition:'visible')` reaches success | binary wrapper over deterministic wait | failure collapses to `TIMEOUT` or `UNKNOWN` |
| `wait_for_ui` used as verification | requested condition becomes true | deterministic per poll inputs | descriptive output, not a dedicated verification result |
| `wait_for_screen_change` | fingerprint changes and stays stable for one confirmation pass | deterministic | verifies change, not correctness of destination |
| `classify_action_outcome` | ordered rule evaluation over provided UI/network/log inputs | deterministic pure function | if `networkRequests` omitted, it returns `unknown` with `nextAction: 'call_get_network_activity'`; `hasLogErrors` does not change the enum outcome |

## 6. Action Result Semantics

Across action tools, **success is not uniform**:

1. **Execution success:** `tap`, `swipe`, `type_text`, `press_back`, `start_app`, `restart_app`, and `tap_element` mainly report that the command ran or the tap was dispatched.
2. **Outcome success:** `scroll_to_element` reports success only if the target element was actually found during scrolling.
3. **Boolean operation success:** `install_app`, `terminate_app`, and `reset_app_data` use tool-specific booleans (`installed`, `terminated`, `reset`) instead of the action envelope.

Failure handling is **partly standardized**:

- action-envelope tools use `failure_code` and `retryable`
- manage tools often use plain booleans plus `error` strings
- some handlers drop underlying diagnostics before the MCP response is built

## 7. Failure Handling

### Structured failure signals

| Source | Structured signals |
| --- | --- |
| action envelope | `ELEMENT_NOT_FOUND`, `ELEMENT_NOT_INTERACTABLE`, `TIMEOUT`, `NAVIGATION_NO_CHANGE`, `AMBIGUOUS_TARGET`, `STALE_REFERENCE`, `UNKNOWN` |
| `wait_for_ui` | `INVALID_SELECTOR`, `INVALID_CONDITION`, `PLATFORM_NOT_SUPPORTED`, `ELEMENT_NOT_FOUND`, `INTERNAL_ERROR` |
| `expect_element_visible` | `failure_code: 'TIMEOUT'\|'UNKNOWN'`, `retryable` |
| `classify_action_outcome` | `outcome: success\|no_op\|backend_failure\|ui_failure\|unknown` |
| `get_network_activity` | per-request `status: success\|failure\|retryable` |

### Unstructured failure signals

- plain `error` strings from `install_app`, `build_app`, `build_and_install`, `find_element`, `start_log_stream`, many platform helpers
- boolean-only failures from `terminate_app` and `reset_app_data`
- top-level handler fallback: `Error executing tool <name>: ...` as plain text, not JSON

### Retry / recovery logic present in implementation

| Area | Observed logic |
| --- | --- |
| `wait_for_ui` | `retry.max_attempts` and `retry.backoff_ms` |
| `scroll_to_element` | repeated swipes up to `maxScrolls` |
| Android `install_app` | retries `pm install` with `-t` on test-only failure; has push + shell fallback |
| iOS `install_app` | tries `simctl install`, may fall back to `idb` |
| `get_ui_tree` | platform handlers retry up to three times |
| `wait_for_screen_change` | one stability confirmation pass after a detected change |

## 8. Execution Patterns (Observed)

1. **Generic action wrapper**  
   `notifyActionStart()` → fingerprint before → platform action → fingerprint after → action envelope.

2. **Resolved tap flow**  
   `wait_for_ui` returns `element.elementId` → `tap_element` uses cached element and current UI tree to validate it → tap → fingerprints before/after.

3. **Visibility verification flow**  
   `expect_element_visible` is implemented as `wait_for_ui(... condition:'visible' ...)` plus a narrower binary result.

4. **Screen verification flow**  
   `wait_for_screen_change` and `expect_screen` both depend on `get_screen_fingerprint`; `expect_screen` may additionally call `get_current_screen` on Android when matching by screen name.

5. **Network correlation flow**  
   action tools that call `notifyActionStart()` create the time window used by `get_network_activity`; `classify_action_outcome` can then classify using supplied request summaries.

6. **Snapshot/debug flow**  
   `capture_debug_snapshot` aggregates screenshot, current screen, fingerprint, UI tree, and logs in one call.

## 9. Inconsistencies and Gaps

1. **Response envelope mismatch:** most tools return wrapped JSON, but `get_logs`, `capture_screenshot`, and `build_and_install` use multi-block responses.
2. **Unexpected-error shape mismatch:** uncaught handler failures become plain text strings, not structured JSON.
3. **Action result mismatch:** some mutation tools use `ActionExecutionResult`; `install_app`, `terminate_app`, `reset_app_data`, and `build_and_install` do not.
4. **Success semantics mismatch:** `scroll_to_element` success is outcome-based; most other action tools are execution-based.
5. **Detail richness mismatch:** `start_app` and `restart_app` include `device` and rich `details`; other action-envelope tools usually omit raw error/details.
6. **Failure-code derivation mismatch:** generic action wrappers infer `failure_code` by matching substrings in error text; `tap_element` assigns codes directly.
7. **Dropped diagnostics:** handler-level MCP responses omit some underlying `diagnostics`/`error` detail, especially for `terminate_app`, `reset_app_data`, and `get_logs`.
8. **`expect_element_visible` type/implementation mismatch:** the type allows `ELEMENT_NOT_FOUND`, but the implementation only emits `TIMEOUT` or `UNKNOWN`.
9. **Platform mismatch:** `get_current_screen` is Android-only; `type_text` and `press_back` are Android-only; other tools are dual-platform.
10. **Observation helper gap:** `waitForUICore` supports `ui`/`log`/`screen`/`idle` modes internally, but only the newer selector-based `wait_for_ui` is exposed as a tool.
11. **Network-window coverage gap:** only tools that call `notifyActionStart()` reset the network activity window; `install_app`, `terminate_app`, and `reset_app_data` do not.
12. **`classify_action_outcome` log input is secondary in name only:** `hasLogErrors` affects reasoning text for `no_op` but never changes the enum outcome.
13. **`build_and_install` has dead autodetect code:** handler requires `platform` and `projectType`, but later still contains unreachable fallback autodetection branches.
14. **Runtime object shape drift:** `list_devices` may return extra runtime fields like `appInstalled` and `booted` beyond the base `DeviceInfo` shape.

## 10. Minimal Canonical Model (Derived, Not Invented)

### Common action shape already present

```ts
{
  action_id: string,
  timestamp: string,
  action_type: string,
  target: {
    selector: Record<string, unknown>,
    resolved: Record<string, unknown> | null
  },
  success: boolean,
  failure_code?: string,
  retryable?: boolean,
  ui_fingerprint_before: string | null,
  ui_fingerprint_after: string | null,
  device?: DeviceInfo,
  details?: Record<string, unknown>
}
```

This shape is already used directly or closely approximated by:

- `start_app`
- `restart_app`
- `tap`
- `tap_element`
- `swipe`
- `scroll_to_element`
- `type_text`
- `press_back`

### Common observation/verification pattern already present

```ts
{
  requested|expected: ...,
  observed: ...,
  success|status: boolean | 'success' | 'timeout',
  metrics?|confidence?|comparison?|reason?
}
```

Examples:

- `wait_for_ui` → `requested`, `observed`, `metrics`
- `expect_screen` → `expected_screen`, `observed_screen`, `comparison`
- `expect_element_visible` → `selector`, `observed`, `reason`
- `wait_for_screen_change` → previous vs observed/new fingerprint

### Common failure signals already present

- action failure codes from `ActionFailureCode`
- wait/expect codes (`INVALID_*`, `ELEMENT_NOT_FOUND`, `TIMEOUT`, `UNKNOWN`)
- network request statuses (`success`, `failure`, `retryable`)
- fallback unstructured `error` strings

### Common flow already present

- resolve device
- perform platform operation
- optionally capture fingerprints before/after
- return structured JSON, usually in one text block
- perform verification in separate tools rather than as part of most actions
