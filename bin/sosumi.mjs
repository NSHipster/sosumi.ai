#!/usr/bin/env node

import { spawn } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

async function runServe(args) {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const packageRoot = resolve(scriptDir, "..")
  const configPath = resolve(packageRoot, "wrangler.jsonc")
  const wranglerArgs = ["-y", "wrangler@^4", "dev", "--config", configPath, ...args]

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("npx", wranglerArgs, {
      cwd: packageRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    })

    child.on("error", rejectPromise)
    child.on("exit", (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`wrangler dev terminated by signal: ${signal}`))
        return
      }
      if (code && code !== 0) {
        rejectPromise(new Error(`wrangler dev exited with code ${code}`))
        return
      }
      resolvePromise(undefined)
    })
  })
}

async function runCliFromSource(args) {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const packageRoot = resolve(scriptDir, "..")
  const cliPath = resolve(packageRoot, "src/cli.ts")

  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, ["--import", "tsx/esm", cliPath, ...args], {
      cwd: packageRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    })

    child.on("error", rejectPromise)
    child.on("exit", (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`CLI terminated by signal: ${signal}`))
        return
      }
      resolvePromise(code ?? 0)
    })
  })
}

async function run() {
  try {
    const args = process.argv.slice(2)
    if (args[0] === "serve") {
      await runServe(args.slice(1))
      process.exit(0)
    }
    const exitCode = await runCliFromSource(args)
    if (typeof exitCode === "number" && exitCode !== 0) {
      process.exit(exitCode)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`sosumi: ${message}`)
    process.exit(1)
  }
}

await run()
