import { describe, expect, it } from "vitest"
import indexHtml from "../public/index.html?raw"
import llmsTxt from "../public/llms.txt?raw"

const REDIRECT_PREFIX = "https://vscode.dev/redirect?url="

function vscodeInstallLinks(text: string): string[] {
  return [...text.matchAll(/https:\/\/vscode\.dev\/redirect\?url=[^"')\s]+/g)].map(
    (match) => match[0],
  )
}

describe("VS Code install links", () => {
  for (const [name, text] of [
    ["index.html", indexHtml],
    ["llms.txt", llmsTxt],
  ] as const) {
    it(`install the sosumi server from ${name}`, () => {
      const links = vscodeInstallLinks(text)
      const targets = links.map((link) => decodeURIComponent(link.slice(REDIRECT_PREFIX.length)))

      expect(targets.map((target) => target.split(":")[0])).toEqual(["vscode", "vscode-insiders"])
      for (const target of targets) {
        const [route, query] = target.split("?")
        expect(route).toMatch(/^vscode(-insiders)?:mcp\/install$/)
        expect(JSON.parse(decodeURIComponent(query))).toEqual({
          name: "sosumi",
          type: "http",
          url: "https://sosumi.ai/mcp",
        })
      }
    })
  }
})
