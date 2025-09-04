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

### MCP Integration

Connect your MCP client to `https://sosumi.ai/mcp`:

```json
{
  "mcpServers": {
    "sosumi": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://sosumi.ai/mcp"
      ]
    }
  }
}
```

#### Available Resources

- `doc://{path}` - Apple Developer documentation in Markdown format
  - Example: `doc://swift/array` returns Swift Array documentation

#### Available Tools

- `search` - Searches Apple Developer documentation
  - Parameters: `query` (string)
  - Returns structured results with titles, URLs, descriptions, breadcrumbs, and tags

- `fetch` - Fetches Apple Developer documentation by path
  - Parameters: `path` (string) - Full or relative documentation path (e.g., '/documentation/swift', 'swiftui/view')
  - Returns documentation content as Markdown

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
npm install
npm run dev
```

### Deployment

```bash
npm run deploy
```

### Testing

```bash
npm run test          # Run tests
npm run test:ui       # Run tests with UI
npm run test:run      # Run tests once
```

## Code Quality

This project uses [Biome](https://biomejs.dev/) for 
code formatting, linting, and import organization.

### Available Commands

- `npm run format` - Format all code files
- `npm run lint` - Lint and fix code issues
- `npm run check` - Format, lint, and organize imports (recommended)
- `npm run check:ci` - Check code without making changes (for CI)

### Editor Integration

For the best development experience, install the Biome extension for your editor:
- [VSCode](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)
- [Vim/Neovim](https://github.com/biomejs/biome/tree/main/editors/vim)
- [Emacs](https://github.com/biomejs/biome/tree/main/editors/emacs)

## Cloudflare Workers

Whenever you update your `wrangler.toml` or change your Worker bindings, be sure to re-run:

```bash
npm run cf-typegen
```

## License

This project is available under the MIT license.
See the LICENSE file for more info.

## Legal

This is an unofficial, independent project and is not affiliated with or endorsed by Apple Inc. "Apple", "Xcode", and related marks are trademarks of Apple Inc.

This service is an accessibility-first, on-demand renderer. It converts a single Apple Developer page to Markdown only when requested by a user. It does not crawl, spider, or bulk download; it does not attempt to bypass authentication or security; and it implements rate limiting to avoid imposing unreasonable load.

Content is fetched transiently and may be cached briefly to improve performance. No permanent archives are maintained. All copyrights and other rights in the underlying content remain with Apple Inc. Each page links back to the original source.

Your use of this service must comply with Apple's Terms of Use and applicable law. You are solely responsible for how you access and use Apple's content through this tool. Do not use this service to circumvent technical measures or for redistribution.
