#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js"

import {
  StartAppResponse,
  DeviceInfo,
  TerminateAppResponse,
  RestartAppResponse,
  ResetAppDataResponse
} from "./types.js"

import { startAndroidApp, getAndroidLogs, captureAndroidScreen, getAndroidDeviceMetadata, terminateAndroidApp, restartAndroidApp, resetAndroidAppData } from "./android.js"
import { startIOSApp, getIOSLogs, captureIOSScreenshot, getIOSDeviceMetadata, terminateIOSApp, restartIOSApp, resetIOSAppData } from "./ios.js"

const server = new Server(
  {
    name: "mobile-debug-mcp",
    version: "0.4.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
)

function wrapResponse<T>(data: T) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify(data, null, 2)
    }]
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "start_app",
      description: "Launch a mobile app on Android or iOS simulator",
      inputSchema: {
        type: "object",
        properties: {
          platform: {
            type: "string",
            enum: ["android", "ios"]
          },
          id: {
            type: "string",
            description: "Android package name or iOS bundle id"
          }
        },
        required: ["platform", "id"]
      }
    },
    {
      name: "terminate_app",
      description: "Terminate a mobile app on Android or iOS simulator",
      inputSchema: {
        type: "object",
        properties: {
          platform: {
            type: "string",
            enum: ["android", "ios"]
          },
          id: {
            type: "string",
            description: "Android package name or iOS bundle id"
          }
        },
        required: ["platform", "id"]
      }
    },
    {
      name: "restart_app",
      description: "Restart a mobile app on Android or iOS simulator",
      inputSchema: {
        type: "object",
        properties: {
          platform: {
            type: "string",
            enum: ["android", "ios"]
          },
          id: {
            type: "string",
            description: "Android package name or iOS bundle id"
          }
        },
        required: ["platform", "id"]
      }
    },
    {
      name: "reset_app_data",
      description: "Reset app data (clear storage) for a mobile app on Android or iOS simulator",
      inputSchema: {
        type: "object",
        properties: {
          platform: {
            type: "string",
            enum: ["android", "ios"]
          },
          id: {
            type: "string",
            description: "Android package name or iOS bundle id"
          }
        },
        required: ["platform", "id"]
      }
    },
    {
      name: "get_logs",
      description: "Get recent logs from Android or iOS simulator. Returns device metadata and the log output.",
      inputSchema: {
        type: "object",
        properties: {
          platform: {
            type: "string",
            enum: ["android", "ios"]
          },
          id: {
            type: "string",
            description: "Android package name or iOS bundle id"
          },
          lines: {
            type: "number",
            description: "Number of log lines (android only)"
          }
        },
        required: ["platform", "id"]
      }
    },
    {
      name: "capture_screenshot",
      description: "Capture a screenshot from an Android device or iOS simulator. Returns device metadata and the screenshot image.",
      inputSchema: {
        type: "object",
        properties: {
          platform: {
            type: "string",
            enum: ["android", "ios"]
          },
          id: {
            type: "string",
            description: "Android device/package id or iOS simulator/bundle id"
          }
        },
        required: ["platform", "id"]
      }
    }
  ]
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    if (name === "start_app") {
      const { platform, id } = args as {
        platform: "android" | "ios"
        id: string
      }

      let appStarted: boolean
      let launchTimeMs: number
      let deviceInfo: DeviceInfo

      if (platform === "android") {
        const result = await startAndroidApp(id)
        appStarted = result.appStarted
        launchTimeMs = result.launchTimeMs
        deviceInfo = await getAndroidDeviceMetadata(id)
      } else {
        const result = await startIOSApp(id)
        appStarted = result.appStarted
        launchTimeMs = result.launchTimeMs
        deviceInfo = await getIOSDeviceMetadata()
      }

      const response: StartAppResponse = {
        device: deviceInfo,
        appStarted,
        launchTimeMs
      }

      return wrapResponse(response)
    }

    if (name === "terminate_app") {
      const { platform, id } = args as {
        platform: "android" | "ios"
        id: string
      }

      let appTerminated: boolean
      let deviceInfo: DeviceInfo

      if (platform === "android") {
        const result = await terminateAndroidApp(id)
        appTerminated = result.appTerminated
        deviceInfo = await getAndroidDeviceMetadata(id)
      } else {
        const result = await terminateIOSApp(id)
        appTerminated = result.appTerminated
        deviceInfo = await getIOSDeviceMetadata()
      }

      const response: TerminateAppResponse = {
        device: deviceInfo,
        appTerminated
      }

      return wrapResponse(response)
    }

    if (name === "restart_app") {
      const { platform, id } = args as {
        platform: "android" | "ios"
        id: string
      }

      let appRestarted: boolean
      let launchTimeMs: number
      let deviceInfo: DeviceInfo

      if (platform === "android") {
        const result = await restartAndroidApp(id)
        appRestarted = result.appRestarted
        launchTimeMs = result.launchTimeMs
        deviceInfo = await getAndroidDeviceMetadata(id)
      } else {
        const result = await restartIOSApp(id)
        appRestarted = result.appRestarted
        launchTimeMs = result.launchTimeMs
        deviceInfo = await getIOSDeviceMetadata()
      }

      const response: RestartAppResponse = {
        device: deviceInfo,
        appRestarted,
        launchTimeMs
      }

      return wrapResponse(response)
    }

    if (name === "reset_app_data") {
      const { platform, id } = args as {
        platform: "android" | "ios"
        id: string
      }

      let dataCleared: boolean
      let deviceInfo: DeviceInfo

      if (platform === "android") {
        const result = await resetAndroidAppData(id)
        dataCleared = result.dataCleared
        deviceInfo = await getAndroidDeviceMetadata(id)
      } else {
        const result = await resetIOSAppData(id)
        dataCleared = result.dataCleared
        deviceInfo = await getIOSDeviceMetadata()
      }

      const response: ResetAppDataResponse = {
        device: deviceInfo,
        dataCleared
      }

      return wrapResponse(response)
    }

    if (name === "get_logs") {
      const { platform, id, lines } = args as {
        platform: "android" | "ios"
        id: string
        lines?: number
      }

      let logs: string[]
      let deviceInfo: DeviceInfo

      if (platform === "android") {
        deviceInfo = await getAndroidDeviceMetadata(id)
        const response = await getAndroidLogs(id, lines ?? 200)
        logs = Array.isArray(response.logs) ? response.logs : []
      } else {
        deviceInfo = await getIOSDeviceMetadata()
        const response = await getIOSLogs()
        logs = Array.isArray(response.logs) ? response.logs : []
      }

      // Filter crash lines (e.g. lines containing 'FATAL EXCEPTION') for internal or AI use
      const crashLines = logs.filter(line => line.includes('FATAL EXCEPTION'))

      // Return device metadata plus logs
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              device: deviceInfo,
              result: {
                lines: logs.length
              }
            }, null, 2)
          },
          {
            type: "text",
            text: logs.join("\n")
          }
        ]
      }
    }

    if (name === "capture_screenshot") {
      const { platform, id } = args as { platform: "android" | "ios"; id: string }

      let screenshot: string
      let resolution: { width: number; height: number }
      let deviceInfo: DeviceInfo

      if (platform === "android") {
        deviceInfo = await getAndroidDeviceMetadata(id)
        const result = await captureAndroidScreen(id)
        screenshot = result.screenshot
        resolution = result.resolution
      } else {
        deviceInfo = await getIOSDeviceMetadata()
        const result = await captureIOSScreenshot()
        screenshot = result.screenshot
        resolution = result.resolution
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              device: deviceInfo,
              result: {
                resolution
              }
            }, null, 2)
          },
          {
            type: "image",
            data: screenshot,
            mimeType: "image/png"
          }
        ]
      }
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}` }]
    }
  }

  throw new Error(`Unknown tool: ${name}`)
})

const transport = new StdioServerTransport()

async function main() {
  await server.connect(transport)
}

main().catch((error) => {
  console.error("Server failed to start:", error)
})