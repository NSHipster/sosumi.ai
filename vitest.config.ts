import { cloudflareTest } from "@cloudflare/vitest-pool-workers"
import { defineConfig } from "vitest/config"

const appProject = {
  // Vitest 4 replaces `test.poolOptions.workers` with the `cloudflareTest` plugin.
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          // The published RFC 9421 Appendix B.1.4 `test-key-ed25519` vector,
          // used for Web Bot Auth signing tests.
          // It is a well-known test key (its public half is the example in
          // Cloudflare's own Web Bot Auth docs), so it does not trip secret
          // scanners.
          WEB_BOT_AUTH_KEY:
            '{"kty":"OKP","crv":"Ed25519","x":"JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs","d":"n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU"}',
        },
      },
    }),
  ],
  test: {
    name: "app",
    include: ["tests/**/*.test.ts"],
    // Handle CommonJS modules properly
    deps: {
      optimizer: {
        ssr: {
          exclude: ["ajv", "@modelcontextprotocol/sdk"],
        },
      },
    },
  },
}

export default defineConfig({
  test: {
    projects: [
      appProject,
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./monitor/wrangler.jsonc" },
          }),
        ],
        test: {
          name: "monitor",
          include: ["monitor/tests/**/*.test.ts"],
        },
      },
    ],
  },
})
