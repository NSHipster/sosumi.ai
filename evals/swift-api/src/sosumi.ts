// Starts a local Sosumi server from this worktree and talks to it over MCP,
// so that the agent sees the tool names, descriptions, and results that
// Sosumi's MCP server really returns.
//
// SosumiService also keeps that server running: when a call fails because the
// server exited or stopped answering, it restarts the server, reconnects, and
// tries the call again, so that a server crash does not count against a model.

import { type ChildProcess, spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
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

/** The Sosumi server failed, not the tool call: the attempt is the harness's failure. */
export class SosumiServerError extends Error {
  override name = "SosumiServerError"
}

/** The local server did not start. `portInUse` is true when a port it needed was taken. */
export class ServerStartError extends Error {
  override name = "ServerStartError"
  readonly portInUse: boolean
  constructor(message: string, portInUse: boolean) {
    super(message)
    this.portInUse = portInUse
  }
}

/** Returns a TCP port on 127.0.0.1 that no process is listening on now. */
export function freePort(): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const probe = createServer()
    probe.once("error", rejectPromise)
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address()
      probe.close(() => {
        if (address && typeof address === "object") resolvePromise(address.port)
        else rejectPromise(new Error("Could not read the probe port"))
      })
    })
  })
}

/** Throws when another process already listens on `port`. */
export function assertPortFree(port: number): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const probe = createServer()
    probe.once("error", (error: NodeJS.ErrnoException) => {
      rejectPromise(
        error.code === "EADDRINUSE"
          ? new Error(
              `Port ${port} is already in use, so a local Sosumi server cannot start there. ` +
                "Choose another --sosumi-port, or omit it to use a free port.",
            )
          : error,
      )
    })
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolvePromise()))
  })
}

export interface LocalServer {
  url: string
  port: number
  /** True once the server process has exited. */
  readonly exited: boolean
  stop(): Promise<void>
  /** Kills the server at once, as a crash would. For tests. */
  kill(): Promise<void>
}

/**
 * Runs `sosumi serve` (wrangler dev) from the repository root on `port`.
 * It returns only when this process reports that it is ready on that port
 * and the port answers, so that a server started by another run cannot stand in for it.
 * The server's output goes to `logPath`.
 */
export async function startLocalServer(port: number, logPath: string): Promise<LocalServer> {
  await assertPortFree(port)
  // Wrangler also opens an inspector port, which it picks from 9229 upward. Two servers that
  // start together can pick the same one, so each server gets its own free inspector port.
  const inspectorPort = await freePort()
  // By default every server from this worktree keeps its local state in .wrangler/state, and
  // two servers that start together lock the same SQLite database. Each gets its own directory.
  const stateDir = await mkdtemp(join(tmpdir(), "sosumi-wrangler-state-"))
  const log = createWriteStream(logPath, { flags: "a" })
  log.write(`\n--- Starting sosumi serve on port ${port} at ${new Date().toISOString()} ---\n`)
  const child: ChildProcess = spawn(
    process.execPath,
    [
      join(repoRoot, "bin", "sosumi.mjs"),
      "serve",
      "--port",
      String(port),
      "--ip",
      "127.0.0.1",
      "--inspector-port",
      String(inspectorPort),
      "--persist-to",
      stateDir,
    ],
    { cwd: repoRoot, detached: true, stdio: ["ignore", "pipe", "pipe"] },
  )
  const url = `http://127.0.0.1:${port}`
  let output = ""
  let ready = false
  const readyLine = new RegExp(`Ready on https?://127\\.0\\.0\\.1:${port}\\b`)
  const onData = (chunk: Buffer) => {
    log.write(chunk)
    output += chunk.toString()
    if (!ready && readyLine.test(output)) ready = true
    if (output.length > 100_000) output = output.slice(-50_000)
  }
  child.stdout?.on("data", onData)
  child.stderr?.on("data", onData)
  let exited = false
  const exit = new Promise<void>((done) =>
    child.once("exit", (code, signal) => {
      exited = true
      log.write(`\n--- sosumi serve exited (code ${code}, signal ${signal}) ---\n`)
      rm(stateDir, { recursive: true, force: true }).finally(() => done())
    }),
  )

  const signalGroup = (signal: NodeJS.Signals) => {
    if (!exited && child.pid !== undefined) {
      try {
        process.kill(-child.pid, signal)
      } catch {
        // The process group is already gone.
      }
    }
  }
  const server: LocalServer = {
    url,
    port,
    get exited() {
      return exited
    },
    async stop() {
      signalGroup("SIGTERM")
      await Promise.race([exit, new Promise((done) => setTimeout(done, 5_000))])
      signalGroup("SIGKILL")
      log.end()
    },
    async kill() {
      signalGroup("SIGKILL")
      await Promise.race([exit, new Promise((done) => setTimeout(done, 5_000))])
    },
  }

  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (exited) {
      const inUse = /address already in use/i.test(output)
      throw new ServerStartError(
        `The local Sosumi server on port ${port} exited before it was ready` +
          `${inUse ? " because a port it needs is already in use" : ""}; see ${logPath}`,
        inUse,
      )
    }
    if (ready && (await answers(url))) {
      // The port answers and this process said it is the one listening there.
      return server
    }
    await new Promise((done) => setTimeout(done, 250))
  }
  await server.stop()
  throw new Error(`The local Sosumi server did not start within 120 s; see ${logPath}`)
}

async function answers(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/`, { signal: AbortSignal.timeout(5_000) })
    return response.ok
  } catch {
    return false
  }
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
    await this.client.close().catch(() => {})
  }
}

export interface SosumiServiceOptions {
  /** A server that another process runs; it is reconnected to but never restarted. */
  url?: string
  /** A fixed port for the local server; by default each start uses a free port. */
  port?: number
  logPath: string
  log: (message: string) => void
}

/** Sosumi's tools from a server that stays up for the whole run. */
export class SosumiService {
  tools: ToolSpec[] = []
  restarts = 0
  private client: SosumiClient | null = null
  private server: LocalServer | null = null
  private recovering: Promise<void> | null = null
  private readonly options: SosumiServiceOptions

  private constructor(options: SosumiServiceOptions) {
    this.options = options
  }

  static async start(options: SosumiServiceOptions): Promise<SosumiService> {
    const service = new SosumiService(options)
    await service.connect()
    service.tools = service.client?.tools ?? []
    return service
  }

  get url(): string {
    return this.server?.url ?? this.options.url ?? ""
  }

  private async connect(): Promise<void> {
    if (this.options.url) {
      this.client = await SosumiClient.connect(this.options.url)
      return
    }
    // Another process can take a free port between the check and the bind,
    // and a server can fail at startup for a reason that passes, so a failed start is tried again.
    let server: LocalServer
    for (let attempt = 1; ; attempt++) {
      const port = this.options.port ?? (await freePort())
      this.options.log(
        `Starting a local Sosumi server on port ${port} (log: ${this.options.logPath})`,
      )
      try {
        server = await startLocalServer(port, this.options.logPath)
        break
      } catch (error) {
        if (!(error instanceof ServerStartError) || attempt >= 3) throw error
        this.options.log(`${error.message}; trying again (${attempt} of 2)`)
      }
    }
    this.server = server
    this.client = await SosumiClient.connect(server.url)
  }

  private async serverIsUp(): Promise<boolean> {
    if (this.server?.exited) return false
    return answers(this.url)
  }

  /** Restarts the local server (or waits for a remote one) and reconnects, once for all callers. */
  private recover(): Promise<void> {
    this.recovering ??= (async () => {
      const before = this.tools.map((tool) => tool.name).join(",")
      await this.client?.close()
      this.client = null
      if (this.options.url) {
        const deadline = Date.now() + 60_000
        while (!(await answers(this.options.url))) {
          if (Date.now() > deadline) {
            throw new SosumiServerError(
              `The Sosumi server at ${this.options.url} stopped answering`,
            )
          }
          await new Promise((done) => setTimeout(done, 1_000))
        }
        this.options.log(`The Sosumi server at ${this.options.url} answers again; reconnecting`)
      } else {
        const old = this.server
        this.options.log(
          `The local Sosumi server ${old?.exited ? "exited" : "stopped answering"}; restarting it`,
        )
        await old?.stop()
        this.server = null
      }
      try {
        await this.connect()
      } catch (error) {
        throw new SosumiServerError(`Could not restart the Sosumi server: ${String(error)}`)
      }
      const after = (this.client as SosumiClient | null)?.tools.map((tool) => tool.name).join(",")
      if (after !== before) {
        throw new SosumiServerError(`The restarted Sosumi server lists other tools: ${after}`)
      }
      this.restarts++
    })().finally(() => {
      this.recovering = null
    })
    return this.recovering
  }

  /**
   * Calls a Sosumi tool. When the call fails and the server is down, the service
   * restarts the server and tries the call again; when it cannot, it throws SosumiServerError.
   * A failure while the server is up is the tool's own and is rethrown as is.
   */
  async call(name: string, args: unknown, signal: AbortSignal): Promise<ToolOutput> {
    for (let attempt = 0; ; attempt++) {
      if (this.recovering) await this.recovering
      const client = this.client
      try {
        if (!client) throw new SosumiServerError("No connection to the Sosumi server")
        return await client.call(name, args, signal)
      } catch (error) {
        if (signal.aborted) throw error
        if (!(error instanceof SosumiServerError) && (await this.serverIsUp())) throw error
        if (attempt >= 2) {
          throw new SosumiServerError(`Sosumi tool ${name} failed after restarts: ${String(error)}`)
        }
        await this.recover()
      }
    }
  }

  /** Kills the local server at once, as a crash would. For tests. */
  async killServerForTest(): Promise<void> {
    await this.server?.kill()
  }

  async close(): Promise<void> {
    await this.client?.close()
    await this.server?.stop()
  }
}
