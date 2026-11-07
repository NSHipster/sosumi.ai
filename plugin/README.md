# Sosumi plugin

[Sosumi](https://sosumi.ai) makes Apple Developer documentation readable by AI agents.
This plugin connects your agent to Sosumi's remote MCP server
and adds a skill that tells the agent when and how to use it.

## What's included

- **MCP server** `sosumi` at `https://sosumi.ai/mcp` (Streamable HTTP).
  It needs no account, API key, or sign-in.
  It provides four read-only tools:
  - `searchAppleDocumentation` searches Apple Developer documentation.
  - `fetchAppleDocumentation` reads API reference
    and Human Interface Guidelines pages as Markdown.
  - `fetchAppleVideoTranscript` reads WWDC and other Apple video transcripts.
  - `fetchExternalDocumentation` reads public Swift-DocC pages on other hosts.
- **Skill** `sosumi`, which tells the agent to look up Apple APIs with Sosumi
  instead of relying on memory.

## Install

### Claude Code

```text
/plugin marketplace add NSHipster/sosumi.ai
/plugin install sosumi@sosumi-ai
```

### Other clients

This folder has a manifest for each supported client:

| Client | Manifest | MCP configuration |
| --- | --- | --- |
| Claude Code | `.claude-plugin/plugin.json` | `mcpServers` in that manifest |
| Cursor | `.cursor-plugin/plugin.json` | `mcpServers` in that manifest |
| ChatGPT, Codex, and other [Agent Plugins](https://agent-plugins.org) clients | `plugin.json` | `mcp.json` |

All of them load the skill from `skills/sosumi/SKILL.md`.

To connect only the MCP server, see the client instructions at
<https://sosumi.ai/#mcp>.

## Usage

Ask about any Apple API, and the agent fetches the current documentation.
For example:

- "How do I use `NavigationStack` in SwiftUI? Check Apple's documentation."
- "What do the Human Interface Guidelines say about color?"
- "Summarize the WWDC21 session about protecting mutable state with Swift actors."

## Configuration

The plugin has no settings.

## Support

- Report problems: <https://github.com/NSHipster/sosumi.ai/issues>
- Support: <https://sosumi.ai/support>
- Privacy policy: <https://sosumi.ai/privacy>
- Terms of use: <https://sosumi.ai/terms>

Sosumi is an unofficial, independent project
and is not affiliated with or endorsed by Apple Inc.

## License

MIT. See [LICENSE](LICENSE).
