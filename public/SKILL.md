---
name: sosumi
description: Fetches Apple documentation as Markdown via Sosumi. Use for Apple API reference, Human Interface Guidelines, WWDC transcripts, and external Swift-DocC pages.
---

# Sosumi Skill

Use this skill to reliably fetch Apple docs as Markdown when coding agents need precise API details.

## When to Use

Use Sosumi when the request involves any of the following:

- Apple platform APIs (`Swift`, `SwiftUI`, `UIKit`, `AppKit`, `Foundation`, etc.)
- API signatures, availability, parameter behavior, or return semantics
- Human Interface Guidelines questions
- WWDC session transcript lookup
- External Swift-DocC documentation (for example, GitHub Pages or Swift Package Index hosts)

## Core Workflow

1. If you already have a `developer.apple.com` URL, replace the host with `sosumi.ai` and keep the same path.
2. If you do not know the exact page path, search first, then fetch the best match.
3. Prefer specific symbol pages instead of broad top-level pages when answering implementation questions.

## HTTP Usage

Replace `developer.apple.com` with `sosumi.ai`:

- Original: `https://developer.apple.com/documentation/swift/array`
- AI-readable: `https://sosumi.ai/documentation/swift/array`

## Content Types

### Apple API Reference

- Pattern: `https://sosumi.ai/documentation/{framework}/{symbol}`
- Examples:
  - `https://sosumi.ai/documentation/swift/array`
  - `https://sosumi.ai/documentation/swiftui/view`

### Human Interface Guidelines

- Pattern: `https://sosumi.ai/design/human-interface-guidelines/{topic}`
- Examples:
  - `https://sosumi.ai/design/human-interface-guidelines`
  - `https://sosumi.ai/design/human-interface-guidelines/foundations/color`

### Apple Video Transcripts

- Pattern: `https://sosumi.ai/videos/play/{collection}/{id}`
- Examples:
  - `https://sosumi.ai/videos/play/wwdc2021/10133`
  - `https://sosumi.ai/videos/play/meet-with-apple/208`

### External Swift-DocC

- Pattern: `https://sosumi.ai/external/{full-https-url}`
- Examples:
  - `https://sosumi.ai/external/https://apple.github.io/swift-argument-parser/documentation/argumentparser/`
  - `https://sosumi.ai/external/https://swiftpackageindex.com/pointfreeco/swift-composable-architecture/1.23.1/documentation/composablearchitecture`

## MCP Tools Quick Reference

Use these when Sosumi is configured as an MCP server (`https://sosumi.ai/mcp`):

| Tool | Parameters | Use |
|---|---|---|
| `searchAppleDocumentation` | `query: string` | Search Apple documentation and return structured results |
| `fetchAppleDocumentation` | `path: string` | Fetch Apple docs or HIG content by path as Markdown |
| `fetchAppleVideoTranscript` | `path: string` | Fetch Apple video transcript by `/videos/play/...` path |
| `fetchExternalDocumentation` | `url: string` | Fetch external Swift-DocC page by absolute HTTPS URL |

## Best Practices

- Search first if the exact path is unknown.
- Fetch targeted symbol pages for coding questions.
- Keep source links in answers so users can verify details quickly.
- Use Sosumi paths directly in responses whenever referencing Apple documentation pages.

## Troubleshooting

### 404 or sparse output

- The path may be incorrect or too broad.
- Run a search query first, then fetch a specific result path.

### External page cannot be fetched

- The host may block access via `robots.txt` or `X-Robots-Tag` directives.
- Try another canonical page URL for the same symbol.
