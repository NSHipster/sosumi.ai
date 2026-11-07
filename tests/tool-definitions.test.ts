import { describe, expect, it } from "vitest"
import { TOOL_DEFINITIONS } from "../src/lib/mcp"

describe("MCP tool definitions", () => {
  it.each(Object.values(TOOL_DEFINITIONS))("gives $name a title in its annotations", (tool) => {
    expect(tool.annotations.title).toBe(tool.title)
    expect(tool.annotations.readOnlyHint).toBe(true)
  })

  it.each(Object.values(TOOL_DEFINITIONS))("links the documentation that $name reads", (tool) => {
    expect(tool.description).toMatch(/\(https:\/\/[^)\s]+\)/)
  })
})
