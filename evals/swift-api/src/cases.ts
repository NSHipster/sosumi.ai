// Loads the eval cases from evals/swift-api/cases.

import { readdir, readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { CaseMeta } from "./grader.ts"

export const evalDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
export const casesDir = join(evalDir, "cases")
export const repoRoot = resolve(evalDir, "..", "..")

export interface EvalCase {
  meta: CaseMeta
  dir: string
  task: string
  check: string
}

export async function loadCases(selected: string[] = []): Promise<EvalCase[]> {
  const entries = await readdir(casesDir, { withFileTypes: true })
  const ids = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const unknown = selected.filter((id) => !ids.includes(id))
  if (unknown.length > 0) throw new Error(`Unknown case: ${unknown.join(", ")}`)
  const chosen = selected.length > 0 ? ids.filter((id) => selected.includes(id)) : ids
  return Promise.all(
    chosen.map(async (id) => {
      const dir = join(casesDir, id)
      const read = (file: string) => readFile(join(dir, file), "utf8")
      return {
        meta: JSON.parse(await read("meta.json")) as CaseMeta,
        dir,
        task: await read("task.md"),
        check: await read("check.swift"),
      }
    }),
  )
}
