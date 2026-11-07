import { env } from "cloudflare:test"
import { describe, expect, it } from "vitest"
import indexHtml from "../public/index.html?raw"
import sitemap from "../public/sitemap.xml?raw"

const PAGES = [
  { path: "/privacy", title: "Privacy Policy" },
  { path: "/terms", title: "Terms of Use" },
  { path: "/support", title: "Support" },
]

describe("policy pages", () => {
  for (const { path, title } of PAGES) {
    // These pages are static assets, served without running the Worker.
    it(`serves ${path} as a static asset`, async () => {
      const response = await env.ASSETS.fetch(`https://sosumi.ai${path}`, { redirect: "manual" })

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toContain("text/html")
      expect(await response.text()).toContain(`<h1>${title}</h1>`)
    })

    it(`links ${path} from the home page footer`, () => {
      const footer = indexHtml.slice(indexHtml.indexOf("<footer>"))
      expect(footer).toContain(`href="${path}"`)
    })

    it(`lists ${path} in the sitemap`, () => {
      expect(sitemap).toContain(`<loc>https://sosumi.ai${path}</loc>`)
    })
  }
})
