# sosumi.ai

Making Apple docs AI-readable.

[sosumi.ai](https://sosumi.ai) 
provides Apple Developer documentation in an AI-readable format 
by converting JavaScript-rendered pages into Markdown.

## Usage

### HTTP API

Replace `developer.apple.com` with `sosumi.ai` 
in any Apple Developer documentation URL:

**Original:**
```
https://developer.apple.com/documentation/swift/array
```

**AI-readable:**
```
https://sosumi.ai/documentation/swift/array
```

This works for all API reference docs, 
as well as Apple's [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) (HIG).

WWDC session transcripts are also supported by replacing the same host for video URLs:

**Original:**
```
https://developer.apple.com/videos/play/wwdc2021/10133/
```

**AI-readable:**
```
https://sosumi.ai/videos/play/wwdc2021/10133
```

Sosumi can also proxy public non-Apple Swift-DocC pages using:

**Original:**
```
https://apple.github.io/swift-argument-parser/documentation/argumentparser
```

**AI-readable:**
```
https://sosumi.ai/external/https://apple.github.io/swift-argument-parser/documentation/argumentparser
```

> [!NOTE]
> Sosumi resolves the URL to the site's underlying DocC JSON endpoint
> and renders Markdown, preserving any base path from the original URL.
> External hosts can opt out via `robots.txt`
> by disallowing user-agent `sosumi-ai`
> (full UA: `sosumi-ai/1.0 (+https://sosumi.ai/#bot)`).
> See `/bot` for the crawler policy and contact details.

### MCP Integration

Sosumi's MCP server supports Streamable HTTP and Server-Sent Events (SSE) transport. 
If your client supports either of these, 
configure it to connect directly to `https://sosumi.ai/mcp`.

Otherwise,
you can run this command to proxy over stdio:

```json
{
  "mcpServers": {
    "sosumi": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://sosumi.ai/mcp"]
    }
  }
}
```

See [the website](https://sosumi.ai/#clients) for client-specific instructions.

#### Available Tools

- `searchAppleDocumentation` - Searches Apple Developer documentation
  - Parameters: `query` (string)
  - Returns structured results with titles, URLs, descriptions, breadcrumbs, and tags

- `fetchAppleDocumentation` - Fetches Apple Developer documentation and Human Interface Guidelines by path
  - Parameters: `path` (string) - Documentation path (e.g., '/documentation/swift', 'swiftui/view', 'design/human-interface-guidelines/foundations/color')
  - Returns content as Markdown

- `fetchAppleVideoTranscript` - Fetches video transcripts, including WWDC sessions
  - Parameters: `path` (string) - video path (e.g., `/videos/play/wwdc2021/10133`)
  - Returns transcript content as Markdown

- `fetchExternalDocumentation` - Fetches external Swift-DocC documentation by absolute HTTPS URL
  - Parameters: `url` (string) - External URL (e.g., `https://apple.github.io/swift-argument-parser/documentation/argumentparser`)
  - Returns content as Markdown

### CLI

Sosumi also provides a CLI that complements MCP:

```bash
npx @nshipster/sosumi fetch https://developer.apple.com/documentation/swift/array
```

If you use it regularly, install once:

```bash
npm i -g @nshipster/sosumi
```

Then use `sosumi` directly:

```bash
sosumi fetch https://developer.apple.com/documentation/swift/array
```

You can fetch all content types covered by MCP tools:

```bash
# Apple documentation / HIG / videos
sosumi fetch /documentation/swift/array
sosumi fetch /design/human-interface-guidelines/color
sosumi fetch /videos/play/wwdc2021/10133

# External Swift-DocC pages
sosumi fetch https://apple.github.io/swift-argument-parser/documentation/argumentparser

# Apple documentation search
sosumi search "SwiftData"
```

Run a local server from the published package:

```bash
sosumi serve
sosumi serve --port 8787
```

By default, output is plain text / Markdown.
Use JSON output for scripts:

```bash
sosumi fetch https://developer.apple.com/documentation/swift/array --json
sosumi search "SwiftData" --json
```

### AI Agent Skill

Want your AI coding assistant to use Sosumi consistently?
Use the hosted skill file:
[`https://sosumi.ai/SKILL.md`](https://sosumi.ai/SKILL.md)

### Chrome Extension

You can also use Sosumi from a community-contributed 
[Chrome extension](https://chromewebstore.google.com/detail/donffakeimppgoehccpfhlchmbfdmfpj?utm_source=item-share-cb),
which adds a "Copy sosumi Link" button 
to Apple Developer documentation pages.
[Source code](https://github.com/FromAtom/Link-Generator-for-sosumi.ai) is available on GitHub.

## Self-Hosting

This project is designed to be easily run on your own machine
or deployed to a hosting provider.

Sosumi.ai is currently hosted by 
[Cloudflare Workers](https://workers.cloudflare.com).

> [!NOTE]  
> The application is built with Hono, 
> making it compatible with various runtimes.
>
> See the [Hono docs](https://hono.dev/docs/getting-started/basic)
> for more information about deploying to different platforms.

### Prerequisites

- Node.js 20+
- npm

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nshipster/sosumi.ai.git
   cd sosumi.ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

Once the application is up and running, press the <kbd>b</kbd>
to open the URL in your browser.

To configure MCP clients to use your development server, 
replace `sosumi.ai` with the local server address
(`http://localhost:8787` by default).

### External Host Restrictions

You can restrict which external Swift-DocC hosts are reachable
with two environment variables (both newline-delimited):

- `EXTERNAL_DOC_HOST_ALLOWLIST` — only listed hosts are permitted
- `EXTERNAL_DOC_HOST_BLOCKLIST` — listed hosts are always denied

> [!IMPORTANT]
> Hostname-based private-network checks cannot fully prevent DNS rebinding.
> Set an explicit `EXTERNAL_DOC_HOST_ALLOWLIST` in production.

## Development

### Testing

This project uses [vitest](https://vitest.dev)
for unit and integration testing.

```bash
npm run test          # Run tests
npm run test:ui       # Run tests with UI
npm run test:run      # Run tests once
```

> [!TIP]
> When running the CLI through npm scripts during local development, 
> use `-s` (`--silent`)
> to suppress npm's script preamble so output pipes cleanly:
>
> ```bash
> npm run -s cli -- fetch https://developer.apple.com/documentation/swift/array | bat -l md
> ```

### Code Quality

This project uses [Biome](https://biomejs.dev/) 
for code formatting, linting, and import organization.

- `npm run format` - Format all code files
- `npm run lint` - Lint and fix code issues
- `npm run check` - Format, lint, and organize imports (recommended)
- `npm run check:ci` - Check code without making changes (for CI)

### Editor Integration

For the best development experience, install the Biome extension for your editor:

- [VSCode](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)
- [Vim/Neovim](https://github.com/biomejs/biome/tree/main/editors/vim)
- [Emacs](https://github.com/biomejs/biome/tree/main/editors/emacs)

### Cloudflare Workers

Whenever you update your `wrangler.toml` or change your Worker bindings, 
be sure to re-run:

```bash
npm run cf-typegen
```

### Publishing

Publishing is handled by `.github/workflows/release.yml`.

- Trigger: pushed tags matching `v*` or manual dispatch with `tag`
- Release step: `gh release create "$TAG_NAME" --generate-notes`
- Publish auth: npm trusted publishing via OIDC (`id-token: write`)
- Publish command: `npm publish --provenance --access public`

## License

This project is available under the MIT license.
See the LICENSE file for more info.

## Legal

This is an unofficial,
independent project and is not affiliated with or endorsed by Apple Inc.
"Apple", "Xcode", and related marks are trademarks of Apple Inc.

This service is an accessibility-first,
on‑demand renderer.
It converts a single Apple Developer page to Markdown only when requested by a user.
It does not crawl, spider, or bulk download;
it does not attempt to bypass authentication or security;
and it implements rate limiting to avoid imposing unreasonable load.

For external Swift-DocC hosts, access can be denied by `robots.txt`
and opt-out response directives such as `X-Robots-Tag: noai`.

Content is fetched transiently and may be cached briefly to improve performance.
No permanent archives are maintained.
All copyrights and other rights in the underlying content remain with Apple Inc.
Each page links back to the original source.

Your use of this service must comply with Apple's Terms of Use and applicable law.
You are solely responsible for how you access and use Apple's content through this tool.
Do not use this service to circumvent technical measures or for redistribution.

**Contact:** <info@sosumi.ai>
