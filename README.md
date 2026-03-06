# Mobile Debug MCP

**Mobile Debug MCP** is a minimal MCP server for AI-assisted mobile development. It allows you to **launch Android or iOS apps** and **read their logs** from an MCP-compatible AI client.

---

## Features

- Launch Android apps via package name.
- Launch iOS apps via bundle ID on a booted simulator.
- Fetch recent logs from Android or iOS apps.
- Cross-platform support (Android + iOS).
- Minimal, focused design for fast debugging loops.

---

## Requirements

- Node.js >= 18
- Android SDK (`adb` in PATH) for Android support
- Xcode command-line tools (`xcrun simctl`) for iOS support
- Booted iOS simulator for iOS testing

---

## Installation

Clone the repo and build:

```bash
git clone https://github.com/YOUR_USERNAME/mobile-debug-mcp.git
cd mobile-debug-mcp
npm install
npm run build
```

Alternatively, you can publish to npm and install globally:

```bash
npm install -g mobile-debug-mcp
```

---

## MCP Server Configuration

Example WebUI MCP config:

```json
{
  "mcpServers": {
    "mobile-debug": {
      "command": "node",
      "args": ["/full/path/to/mobile-debug-mcp/dist/server.js"]
    }
  }
}
```

> Make sure to replace `/full/path/to/` with your actual project path.

---

## Tools

### start_app
Launch a mobile app.

**Input:**

```json
{
  "platform": "android" | "ios",
  "id": "com.example.app" // Android package or iOS bundle ID
}
```

**Example:**

```json
{
  "platform": "android",
  "id": "com.modul8.app"
}
```

### get_logs
Fetch recent logs from the app.

**Input:**

```json
{
  "platform": "android" | "ios",
  "lines": 200 // optional, Android only
}
```

**Example:**

```json
{
  "platform": "android",
  "lines": 200
}
```

---

## Recommended Workflow

1. Ensure Android device or iOS simulator is running.
2. Use `start_app` to launch the app.
3. Use `get_logs` to read the latest logs.
4. Repeat for debugging loops.

---

## Notes

- Ensure `adb` and `xcrun` are in your PATH.
- For iOS, the simulator must be booted before using `start_app` or `get_logs`.
- You may want to clear Android logs before launching for cleaner output: `adb logcat -c`

---

## License

MIT License
