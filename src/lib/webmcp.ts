import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

import { TOOL_DEFINITIONS } from "./mcp"

export interface WebMcpToolManifest {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  readOnly: boolean
  http: {
    path?: string
    pathFrom?: string
    pathPrefix?: string
    query?: Record<string, string>
  }
}

/**
 * The failure that `public/webmcp.js` resolves with, in the shape of an MCP `CallToolResult`.
 * WebMCP turns a rejected `execute` promise into a generic `OperationError`
 * and does not pass the reason to the agent,
 * so a tool reports a failure in its result instead.
 */
const toolErrorSchema = {
  isError: z.literal(true).describe("Marks the result as a failure"),
  content: z
    .array(
      z.object({
        type: z.literal("text"),
        text: z.string().describe("What failed"),
      }),
    )
    .describe("A description of the failure"),
}

function toJsonSchema(shape: z.ZodRawShape): Record<string, unknown> {
  const { $schema: _, ...schema } = zodToJsonSchema(z.object(shape), {
    $refStrategy: "none",
  }) as Record<string, unknown> & { $schema?: unknown }
  return schema
}

export function buildWebMcpManifest(): WebMcpToolManifest[] {
  return Object.values(TOOL_DEFINITIONS).map((def) => ({
    name: def.name,
    title: def.title,
    description: def.description,
    inputSchema: toJsonSchema(def.inputSchema),
    ...("outputSchema" in def && {
      outputSchema: {
        type: "object",
        anyOf: [toJsonSchema(def.outputSchema), toJsonSchema(toolErrorSchema)],
      },
    }),
    readOnly: def.annotations.readOnlyHint,
    http: def.http,
  }))
}
