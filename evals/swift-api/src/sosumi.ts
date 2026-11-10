// Starts a local Sosumi server from this worktree and talks to it over MCP,
// so that the agent sees the tool names, descriptions, and results that
// Sosumi's MCP server really returns.

import { type ChildProcess, spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { join } from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { repoRoot } from "./cases.ts"

export interface ToolSpec {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ToolOutput {
  text: string
  isError: boolean
}

export interface LocalServer {
  url: string
  stop(): Promise<void>
}

/**
 * Runs `sosumi serve` (wrangler dev) from the repository root on `port`
 * and waits until it answers. Its output goes to `logPath`.
 */
export async function startLocalServer(port: number, logPath: string): Promise<LocalServer> {
  const log = createWriteStream(logPath, { flags: "a" })
  const child: ChildProcess = spawn(
    process.execPath,
    [join(repoRoot, "bin", "sosumi.mjs"), "serve", "--port", String(port), "--ip", "127.0.0.1"],
    { cwd: repoRoot, detached: true, stdio: ["ignore", "pipe", "pipe"] },
  )
  child.stdout?.pipe(log)
  child.stderr?.pipe(log)
  const url = `http://127.0.0.1:${port}`

  const stop = async () => {
    if (child.exitCode === null && child.pid !== undefined) {
      try {
        process.kill(-child.pid, "SIGTERM")
      } catch {
        // The process group is already gone.
      }
      await new Promise((done) => {
        const timer = setTimeout(done, 5_000)
        child.once("exit", () => {
          clearTimeout(timer)
          done(undefined)
        })
      })
    }
    log.end()
  }

  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `The local Sosumi server exited with status ${child.exitCode}; see ${logPath}`,
      )
    }
    try {
      const response = await fetch(`${url}/`, { signal: AbortSignal.timeout(2_000) })
      if (response.ok) return { url, stop }
    } catch {
      // Not ready yet.
    }
    await new Promise((done) => setTimeout(done, 500))
  }
  await stop()
  throw new Error(`The local Sosumi server did not start within 120 s; see ${logPath}`)
}

/** An MCP client for a Sosumi server. */
export class SosumiClient {
  readonly tools: ToolSpec[]
  private readonly client: Client

  private constructor(client: Client, tools: ToolSpec[]) {
    this.client = client
    this.tools = tools
  }

  static async connect(baseURL: string): Promise<SosumiClient> {
    const client = new Client({ name: "sosumi-swift-api-eval", version: "1.0.0" })
    await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", baseURL)))
    const { tools } = await client.listTools()
    return new SosumiClient(
      client,
      tools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? "",
        inputSchema: tool.inputSchema as Record<string, unknown>,
      })),
    )
  }

  /** Calls a tool and returns its text content, as an MCP host shows it to a model. */
  async call(name: string, args: unknown, signal: AbortSignal): Promise<ToolOutput> {
    const result = await this.client.callTool(
      { name, arguments: (args ?? {}) as Record<string, unknown> },
      undefined,
      { signal, timeout: 120_000 },
    )
    const content = (result.content ?? []) as { type: string; text?: string }[]
    const text = content
      .map((item) => (item.type === "text" ? (item.text ?? "") : `[${item.type} content]`))
      .join("\n\n")
    return { text, isError: result.isError === true }
  }

  async close(): Promise<void> {
    await this.client.close()
  }
}
