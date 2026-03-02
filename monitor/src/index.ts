import { EmailMessage } from "cloudflare:email";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createMimeMessage } from "mimetext";

interface Env {
  EMAIL_ALERT: SendEmail;
}

const MONITOR_NAME = "sosumi.ai Monitor";
const ALERT_FROM = "no-reply@sosumi.ai";
const ALERT_TO = "alerts@sosumi.ai";
const TARGET_URL = "https://sosumi.ai/mcp";
const PROBE_TOOL_NAME = "fetchAppleDocumentation";
const PROBE_TOOL_ARGS = { path: "/documentation/swift/array" };

async function runMcpHealthCheck(): Promise<void> {
  const client = new Client({
    name: "sosumi-monitor",
    version: "1.0.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(TARGET_URL));

  try {
    await client.connect(transport);

    const toolsResult = await client.listTools();
    const hasProbeTool = toolsResult.tools.some((tool) => tool.name === PROBE_TOOL_NAME);
    if (!hasProbeTool) {
      throw new Error(`Missing required MCP tool: ${PROBE_TOOL_NAME}`);
    }

    const callResult = await client.callTool({
      name: PROBE_TOOL_NAME,
      arguments: PROBE_TOOL_ARGS,
    });

    if (callResult.isError) {
      throw new Error(`MCP tool call returned an error: ${PROBE_TOOL_NAME}`);
    }
  } finally {
    await transport.close();
  }
}

async function sendAlert(
  env: Env,
  subject: string,
  body: string,
): Promise<void> {
  const msg = createMimeMessage();
  msg.setSender({ name: MONITOR_NAME, addr: ALERT_FROM });
  msg.setRecipient(ALERT_TO);
  msg.setSubject(subject);
  msg.addMessage({
    contentType: "text/plain",
    data: body,
  });

  const message = new EmailMessage(ALERT_FROM, ALERT_TO, msg.asRaw());
  await env.EMAIL_ALERT.send(message);
}

export default {
  async scheduled(_controller, env): Promise<void> {
    try {
      await runMcpHealthCheck();
    } catch (error) {
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
    }
  },
} satisfies ExportedHandler<Env>;
