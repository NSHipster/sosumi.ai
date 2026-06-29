import { DurableObject } from "cloudflare:workers";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

interface Env {
  EMAIL: SendEmail;
  MONITOR_STATE: DurableObjectNamespace<MonitorState>;
}

const MONITOR_NAME = "sosumi.ai Monitor";
const ALERT_FROM = "no-reply@sosumi.ai";
const ALERT_TO = "alerts@sosumi.ai";
const TARGET_URL = "https://sosumi.ai/mcp";
const PROBE_TOOL_NAME = "fetchAppleDocumentation";
const PROBE_TOOL_ARGS = { path: "/documentation/swift/array" };
const REQUEST_TIMEOUT_MS = 10_000;

async function runMcpHealthCheck(): Promise<void> {
  const client = new Client({
    name: "sosumi-monitor",
    version: "1.0.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(TARGET_URL));

  try {
    await client.connect(transport, { timeout: REQUEST_TIMEOUT_MS });

    const toolsResult = await client.listTools(undefined, {
      timeout: REQUEST_TIMEOUT_MS,
    });
    const hasProbeTool = toolsResult.tools.some((tool) => tool.name === PROBE_TOOL_NAME);
    if (!hasProbeTool) {
      throw new Error(`Missing required MCP tool: ${PROBE_TOOL_NAME}`);
    }

    const callResult = await client.callTool(
      { name: PROBE_TOOL_NAME, arguments: PROBE_TOOL_ARGS },
      undefined,
      { timeout: REQUEST_TIMEOUT_MS },
    );

    if (callResult.isError) {
      throw new Error(`MCP tool call returned an error: ${PROBE_TOOL_NAME}`);
    }
  } finally {
    // Best-effort cleanup: closing the transport must not change the health
    // result or mask an error from the operations above.
    await transport.close().catch(() => {});
  }
}

type HealthTransition = "failed" | "recovered" | "none";

// Persists the last known health state so alerts fire only on transitions,
// rather than on every cron run during a sustained outage.
export class MonitorState extends DurableObject {
  async reportResult(healthy: boolean): Promise<HealthTransition> {
    const previous = (await this.ctx.storage.get<boolean>("healthy")) ?? true;
    if (healthy === previous) {
      return "none";
    }
    await this.ctx.storage.put("healthy", healthy);
    return healthy ? "recovered" : "failed";
  }
}

async function sendAlert(
  env: Env,
  subject: string,
  body: string,
): Promise<void> {
  await env.EMAIL.send({
    from: { name: MONITOR_NAME, email: ALERT_FROM },
    to: ALERT_TO,
    subject,
    text: body,
  });
}

export default {
  async scheduled(_controller, env): Promise<void> {
    let error: unknown;
    try {
      await runMcpHealthCheck();
    } catch (e) {
      error = e;
    }

    const stub = env.MONITOR_STATE.get(env.MONITOR_STATE.idFromName("singleton"));
    const transition = await stub.reportResult(error === undefined);

    if (transition === "failed") {
      await sendAlert(
        env,
        "Sosumi MCP Alert: Health check failed",
        [
          "The MCP client health check failed.",
          `URL: ${TARGET_URL}`,
          `Time: ${new Date().toISOString()}`,
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        ].join("\n"),
      );
    } else if (transition === "recovered") {
      await sendAlert(
        env,
        "Sosumi MCP Recovered: Health check passing",
        [
          "The MCP client health check is passing again.",
          `URL: ${TARGET_URL}`,
          `Time: ${new Date().toISOString()}`,
        ].join("\n"),
      );
    }
  },
} satisfies ExportedHandler<Env>;
