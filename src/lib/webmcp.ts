import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

import { TOOL_DEFINITIONS } from "./mcp"

export interface WebMcpToolManifest {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  readOnly: boolean
  http: {
    path?: string
    pathFrom?: string
    pathPrefix?: string
    query?: Record<string, string>
  }
}

export function buildWebMcpManifest(): WebMcpToolManifest[] {
  return Object.values(TOOL_DEFINITIONS).map((def) => {
    const jsonSchema = zodToJsonSchema(z.object(def.inputSchema), {
      $refStrategy: "none",
    })
    const { $schema: _, ...inputSchema } = jsonSchema as Record<string, unknown> & {
      $schema?: unknown
    }

    return {
      name: def.name,
      title: def.title,
      description: def.description,
      inputSchema,
      readOnly: def.annotations.readOnlyHint,
      http: def.http,
    }
  })
}

export function renderWebMcpScript(manifest: WebMcpToolManifest[]): string {
  const manifestJson = JSON.stringify(manifest)

  return `(() => {
  const ctx = (typeof navigator !== "undefined" && navigator.modelContext) || document.modelContext;
  if (!ctx) return;
  if (typeof ctx.registerTool !== "function" && typeof ctx.provideContext !== "function") return;

  const tools = ${manifestJson};

  async function runHttpTool(http, input) {
    let pathname = http.path;
    if (http.pathFrom) {
      const value = String(input[http.pathFrom] ?? "");
      if (http.pathPrefix) {
        pathname = http.pathPrefix + value.replace(/^\\//, "");
      } else {
        pathname = value.startsWith("/") ? value : "/" + value;
      }
    }
    const url = new URL(pathname, location.origin);
    if (http.query) {
      for (const [param, key] of Object.entries(http.query)) {
        url.searchParams.set(param, String(input[key] ?? ""));
      }
    }
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const body = await response.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      data = body;
    }
    const text =
      data && typeof data === "object" && data !== null && "content" in data
        ? String(data.content)
        : typeof data === "string"
          ? data
          : JSON.stringify(data, null, 2);
    return { content: [{ type: "text", text }] };
  }

  for (const tool of tools) {
    const registration = {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: tool.readOnly },
      execute: (input) => runHttpTool(tool.http, input),
    };
    try {
      if (typeof ctx.registerTool === "function") {
        ctx.registerTool(registration);
      } else if (typeof ctx.provideContext === "function") {
        ctx.provideContext({ tools: [registration] });
      }
    } catch {
      // Ignore duplicate or unsupported registrations.
    }
  }
})();
`
}
