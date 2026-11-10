// Loads the eval cases from evals/swift-api/cases.

import { readdir, readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { CaseMeta } from "./grader.ts"

export const evalDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
export const casesDir = join(evalDir, "cases")
export const repoRoot = resolve(evalDir, "..", "..")

export type Split = "train" | "test"

export interface EvalCase {
  meta: CaseMeta
  dir: string
  task: string
  check: string
  split: Split
}

/** Reads split.json: each case ID and the half it belongs to. */
export async function loadSplit(): Promise<Map<string, Split>> {
  const data = JSON.parse(await readFile(join(evalDir, "split.json"), "utf8")) as Record<
    Split,
    string[]
  >
  const split = new Map<string, Split>()
  for (const half of ["train", "test"] as const) {
    for (const id of data[half]) {
      if (split.has(id)) throw new Error(`split.json lists ${id} in both halves`)
      split.set(id, half)
    }
  }
  return split
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
  const split = await loadSplit()
  const unsplit = ids.filter((id) => !split.has(id))
  if (unsplit.length > 0) throw new Error(`split.json does not list ${unsplit.join(", ")}`)
  return Promise.all(
    chosen.map(async (id) => {
      const dir = join(casesDir, id)
      const read = (file: string) => readFile(join(dir, file), "utf8")
      return {
        meta: JSON.parse(await read("meta.json")) as CaseMeta,
        dir,
        task: await read("task.md"),
        check: await read("check.swift"),
        split: split.get(id) as Split,
      }
    }),
  )
}
