import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  extractCodeSamplesFromHtml,
  extractTranscriptLinesFromHtml,
  fetchVideoTranscriptMarkdown,
  TranscriptNotFoundError,
} from "../src/lib/video"
import keynoteHtml from "./fixtures/video/wwdc2026-101.html?raw"
import dragAndDropHtml from "./fixtures/video/wwdc2026-271.html?raw"

function mockVideoPage(html: string) {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
  )
}

describe("WWDC video transcript support", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("extracts transcript lines from transcript-content section", () => {
    const html = `
      <html>
        <body>
          <section id="transcript-content">
            <p>
              <span class="sentence"><span data-start="2.0">Hello &amp; welcome.</span></span>
              <span class="sentence"><span data-start="5.5">Swift actors protect mutable state.</span></span>
            </p>
          </section>
        </body>
      </html>
    `

    const lines = extractTranscriptLinesFromHtml(html)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toEqual({ startSeconds: 2, text: "Hello & welcome." })
    expect(lines[1]).toEqual({ startSeconds: 5.5, text: "Swift actors protect mutable state." })
  })

  it("fetches and renders transcript markdown from Apple video page", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        `
        <html>
          <head>
            <title>Protect mutable state with Swift actors - WWDC21 - Videos - Apple Developer</title>
          </head>
          <body>
            <section id="transcript-content">
              <p>
                <span class="sentence"><span data-start="2.0">Hello &amp; welcome.</span></span>
                <span class="sentence"><span data-start="5.0">Today we discuss actors.</span></span>
              </p>
            </section>
          </body>
        </html>
        `,
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      ),
    )

    const sourceUrl = "https://developer.apple.com/videos/play/wwdc2021/10133/"
    const markdown = await fetchVideoTranscriptMarkdown(sourceUrl, "wwdc2021", "10133")

    expect(global.fetch).toHaveBeenCalledWith(
      sourceUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "text/html,application/xhtml+xml",
          "Cache-Control": "no-cache",
        }),
      }),
    )

    expect(markdown).toContain("title: Protect mutable state with Swift actors - WWDC21")
    expect(markdown).toContain("source: https://developer.apple.com/videos/play/wwdc2021/10133/")
    expect(markdown).toContain("# Protect mutable state with Swift actors - WWDC21")
    expect(markdown).toContain("- [00:02] Hello & welcome.")
    expect(markdown).toContain("- [00:05] Today we discuss actors.")
    expect(markdown).toContain("*Extracted by [sosumi.ai](https://sosumi.ai)")
  })

  it("throws TranscriptNotFoundError when transcript section is missing", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("<html><head><title>Video</title></head><body>No transcript</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
    )

    await expect(
      fetchVideoTranscriptMarkdown(
        "https://developer.apple.com/videos/play/wwdc2021/10133/",
        "wwdc2021",
        "10133",
      ),
    ).rejects.toThrow(TranscriptNotFoundError)
  })

  it("renders transcript markdown for non-WWDC collections", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        `
        <html>
          <head>
            <title>Showcase: Learn how apps are integrating the new design and Liquid Glass - Meet with Apple - Videos - Apple Developer</title>
          </head>
          <body>
            <section id="transcript-content">
              <p>
                <span class="sentence"><span data-start="10.0">Good morning everyone.</span></span>
              </p>
            </section>
          </body>
        </html>
        `,
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      ),
    )

    const sourceUrl = "https://developer.apple.com/videos/play/meet-with-apple/208/"
    const markdown = await fetchVideoTranscriptMarkdown(sourceUrl, "meet-with-apple", "208")

    expect(markdown).toContain(
      "source: https://developer.apple.com/videos/play/meet-with-apple/208/",
    )
    expect(markdown).toContain("**Collection:** meet-with-apple")
    expect(markdown).toContain("**Video:** 208")
    expect(markdown).toContain("- [00:10] Good morning everyone.")
  })

  describe("code samples", () => {
    it("extracts code samples with titles and start times from a session page", () => {
      const samples = extractCodeSamplesFromHtml(dragAndDropHtml)

      expect(samples.map(({ title, startSeconds }) => ({ title, startSeconds }))).toEqual([
        { title: "Add reorderable to the preview", startSeconds: 220 },
        { title: "Add reorder container to the GameView", startSeconds: 280 },
        { title: "Add reorderable to PileView", startSeconds: 358 },
      ])

      const [preview] = samples
      expect(preview.code.startsWith("#Preview {\n    @Previewable @State var cards = [")).toBe(
        true,
      )
      expect(preview.code.endsWith("    .background(.green.gradient)\n}")).toBe(true)
      expect(preview.code).not.toContain("<span")
      expect(preview.code).toContain(".reorderContainer(for: CardValue.self) { difference in")
    })

    it("decodes HTML entities in code", () => {
      const samples = extractCodeSamplesFromHtml(`
        <li class="supplement sample-code" data-supplement-id="sample-code">
          <section>
            <ul>
              <li class="sample-code-main-container">
                <p>0:05 - <a class="jump-to-time-sample" data-start-time="5">Compare &amp; swap</a></p>
                <pre class="code-source"><code><span class="syntax-keyword">let</span> ok <span class="syntax-operator">=</span> a &lt; b &amp;&amp; b &gt; c</code></pre>
              </li>
            </ul>
          </section>
        </li>
      `)

      expect(samples).toEqual([
        { title: "Compare & swap", startSeconds: 5, code: "let ok = a < b && b > c" },
      ])
    })

    it("returns no code samples for a session page with an empty Code tab", () => {
      expect(extractCodeSamplesFromHtml(keynoteHtml)).toEqual([])
    })

    it("returns no code samples for a page without a Code tab", () => {
      expect(
        extractCodeSamplesFromHtml(
          '<section id="transcript-content"><span data-start="1.0">Hi</span></section>',
        ),
      ).toEqual([])
    })

    it("renders code samples after the transcript", async () => {
      mockVideoPage(dragAndDropHtml)

      const markdown = await fetchVideoTranscriptMarkdown(
        "https://developer.apple.com/videos/play/wwdc2026/271/",
        "wwdc2026",
        "271",
      )

      expect(markdown).toContain("# Code-along: Build powerful drag and drop in SwiftUI - WWDC26")
      expect(markdown).toContain(
        [
          "- [00:19] Since iOS 16, SwiftUI has provided drag and drop",
          "",
          "## Code",
          "",
          "### [03:40] Add reorderable to the preview",
          "",
          "```swift",
          "#Preview {",
        ].join("\n"),
      )
      expect(markdown).toContain(
        ["    .background(.green.gradient)", "}", "```", "", "### [04:40] Add reorder"].join("\n"),
      )
      expect(markdown).toContain("### [05:58] Add reorderable to PileView")
      expect(markdown.indexOf("## Code")).toBeLessThan(markdown.indexOf("*Extracted by"))
    })

    it("leaves the output unchanged for a session without code samples", async () => {
      mockVideoPage(keynoteHtml)

      const markdown = await fetchVideoTranscriptMarkdown(
        "https://developer.apple.com/videos/play/wwdc2026/101/",
        "wwdc2026",
        "101",
      )

      expect(markdown).not.toContain("## Code")
      expect(markdown).toMatch(
        /- \[00:31\] and welcome to WWDC\.\n\n---\n\n\*Extracted by \[sosumi\.ai\]/,
      )
    })

    it("uses a longer fence when the code contains backticks", async () => {
      mockVideoPage(`
        <title>Raw identifiers - WWDC26 - Videos - Apple Developer</title>
        <section id="transcript-content"><span data-start="1.0">Hello.</span></section>
        <li class="supplement sample-code">
          <section>
            <ul>
              <li class="sample-code-main-container">
                <p>Raw identifiers</p>
                <pre class="code-source"><code>/// \`\`\`swift
func \`test something\`() {}</code></pre>
              </li>
            </ul>
          </section>
        </li>
      `)

      const markdown = await fetchVideoTranscriptMarkdown(
        "https://developer.apple.com/videos/play/wwdc2026/999/",
        "wwdc2026",
        "999",
      )

      expect(markdown).toContain(
        "### Raw identifiers\n\n````swift\n/// ```swift\nfunc `test something`() {}\n````\n",
      )
    })
  })
})
