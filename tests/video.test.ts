import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  extractTranscriptLinesFromHtml,
  fetchVideoTranscriptMarkdown,
  TranscriptNotFoundError,
} from "../src/lib/video"

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
})
