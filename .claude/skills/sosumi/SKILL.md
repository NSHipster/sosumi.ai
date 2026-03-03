---
name: sosumi
description: Retrieve Apple Developer documentation, Human Interface Guidelines, WWDC transcripts, and external Swift-DocC content using the published Sosumi CLI in non-Sosumi projects. Use when a task needs fresh docs lookup, API reference lookup, HIG guidance, WWDC transcript extraction, or Apple docs search.
---

# Sosumi Cli Docs

## Overview

Use the published Sosumi CLI to fetch AI-readable Markdown for Apple docs workflows.
Use this skill outside the Sosumi repository, not for Sosumi CLI development itself.

## Command Selection

Use this decision order:

1. If you already have an exact docs URL or path, run `fetch`.
2. If you only have a topic or keyword, run `search` first, then `fetch` the best result URL.
3. If a task needs machine-readable output, add `--json`.

## Commands

Use package CLI:

```bash
npx @nshipster/sosumi fetch <url-or-path>
npx @nshipster/sosumi search "<query>"
```

If already installed globally, use:

```bash
sosumi fetch <url-or-path>
sosumi search "<query>"
```

Accepted fetch inputs:

- Apple docs URL: `https://developer.apple.com/documentation/swift/array`
- Apple docs/HIG/video path: `/documentation/swift/array`, `/design/human-interface-guidelines/color`, `/videos/play/wwdc2021/10133`
- External Swift-DocC URL: `https://apple.github.io/swift-argument-parser/documentation/argumentparser`

## Workflow

1. Normalize user intent into a URL/path/query.
2. Run `search` when path is unknown.
3. Run `fetch` on the chosen URL/path.
4. Quote key passages from output and include the original docs URL in your response.
5. Use `--json` when downstream parsing or structured extraction is requested.

## Examples

```bash
# Known URL
npx @nshipster/sosumi fetch https://developer.apple.com/documentation/swift/array

# Search then fetch
npx @nshipster/sosumi search "SwiftData migration"
npx @nshipster/sosumi fetch /documentation/swiftdata

# HIG
npx @nshipster/sosumi fetch /design/human-interface-guidelines/color

# WWDC transcript
npx @nshipster/sosumi fetch /videos/play/wwdc2021/10133

# Structured output
npx @nshipster/sosumi fetch /documentation/swift/array --json
npx @nshipster/sosumi search "SwiftData" --json
```

## Fallbacks

If CLI execution is unavailable, use direct HTTPS Sosumi links as a fallback:

- `https://sosumi.ai/documentation/...`
- `https://sosumi.ai/design/human-interface-guidelines/...`
- `https://sosumi.ai/videos/play/...`
- `https://sosumi.ai/external/<absolute-https-url>`

Stay within CLI and direct Sosumi HTTPS endpoints for retrieval.
