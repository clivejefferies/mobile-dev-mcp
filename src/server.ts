import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js"

import { startAndroidApp, getAndroidLogs } from "./android.js"
import { startIOSApp, getIOSLogs } from "./ios.js"

const server = new Server(
  {
    name: "mobile-debug-mcp",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
)

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
      name: "get_logs",
      description: "Get recent logs from Android or iOS simulator",
      inputSchema: {
        type: "object",
        properties: {
          platform: {
            type: "string",
            enum: ["android", "ios"]
          },
          lines: {
            type: "number",
            description: "Number of log lines (android only)"
          }
        },
        required: ["platform"]
      }
    }
  ]
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === "start_app") {
    const { platform, id } = args as {
      platform: "android" | "ios"
      id: string
    }

    const result =
      platform === "android"
        ? await startAndroidApp(id)
        : await startIOSApp(id)

    return {
      content: [{ type: "text", text: result }]
    }
  }

  if (name === "get_logs") {
    const { platform, lines } = args as {
      platform: "android" | "ios"
      lines?: number
    }

    const logs =
      platform === "android"
        ? await getAndroidLogs(lines ?? 200)
        : await getIOSLogs()

    return {
      content: [{ type: "text", text: logs }]
    }
  }

  throw new Error(`Unknown tool: ${name}`)
})

const transport = new StdioServerTransport()
await server.connect(transport)