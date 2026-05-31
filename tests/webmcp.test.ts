import { SELF } from "cloudflare:test"
import { describe, expect, it } from "vitest"

describe("WebMCP script", () => {
  it("serves a generated WebMCP registration script", async () => {
    const response = await SELF.fetch("https://sosumi.ai/webmcp.js")

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("text/javascript")

    const script = await response.text()
    expect(script).toContain("registerTool")
    expect(script).toContain("modelContext")
    expect(script).toContain("searchAppleDocumentation")
    expect(script).toContain("fetchAppleDocumentation")
    expect(script).toContain("fetchExternalDocumentation")
    expect(script).toContain("fetchAppleVideoTranscript")
    expect(script).toContain('"type":"object"')
    expect(script).toContain('"query"')
    expect(script).toContain('"path"')
    expect(script).toContain('"url"')
  })

  it("includes the WebMCP script on the homepage", async () => {
    const response = await SELF.fetch("https://sosumi.ai/")

    expect(response.status).toBe(200)

    const html = await response.text()
    expect(html).toContain('<script src="/webmcp.js" defer></script>')
  })
})
