import { describe, expect, it } from "vitest"
import marketplace from "../.claude-plugin/marketplace.json"
import license from "../LICENSE.md?raw"
import packageJson from "../package.json"
import claudePlugin from "../plugin/.claude-plugin/plugin.json"
import cursorPlugin from "../plugin/.cursor-plugin/plugin.json"
import pluginLicense from "../plugin/LICENSE?raw"
import agentMcp from "../plugin/mcp.json"
import agentPlugin from "../plugin/plugin.json"
import pluginSkill from "../plugin/skills/sosumi/SKILL.md?raw"
import publicSkill from "../public/SKILL.md?raw"

// public/SKILL.md is the source. The site serves it at /SKILL.md and
// /.well-known/agent-skills/sosumi/SKILL.md. The plugin needs a real copy,
// because plugin installs copy folders and ZIP uploads can drop symlinks.
describe("plugin", () => {
  it("bundles an exact copy of public/SKILL.md", () => {
    expect(
      pluginSkill,
      "plugin/skills/sosumi/SKILL.md differs from public/SKILL.md. Run: cp public/SKILL.md plugin/skills/sosumi/SKILL.md",
    ).toBe(publicSkill)
  })

  it("bundles an exact copy of LICENSE.md", () => {
    expect(
      pluginLicense,
      "plugin/LICENSE differs from LICENSE.md. Run: cp LICENSE.md plugin/LICENSE",
    ).toBe(license)
  })

  it("uses the package version in every manifest", () => {
    expect(claudePlugin.version).toBe(packageJson.version)
    expect(cursorPlugin.version).toBe(packageJson.version)
    expect(agentPlugin.version).toBe(packageJson.version)
  })

  it("uses the same name in every manifest", () => {
    expect(claudePlugin.name).toBe("sosumi")
    expect(cursorPlugin.name).toBe("sosumi")
    expect(agentPlugin.name).toBe("sosumi")
  })

  it("connects every client to the remote MCP server", () => {
    expect(claudePlugin.mcpServers.sosumi).toEqual({ type: "http", url: "https://sosumi.ai/mcp" })
    expect(cursorPlugin.mcpServers.sosumi).toEqual({ url: "https://sosumi.ai/mcp" })
    expect(agentMcp.mcpServers.sosumi).toEqual({
      type: "streamable-http",
      url: "https://sosumi.ai/mcp",
    })
  })

  it("is listed in the Claude Code marketplace", () => {
    expect(marketplace.plugins).toContainEqual(
      expect.objectContaining({ name: claudePlugin.name, source: "./plugin" }),
    )
  })
})
