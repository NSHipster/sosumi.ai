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
