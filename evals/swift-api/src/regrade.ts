// Grades the saved answers in one or more variant directories again
// and reports every verdict that differs from the recorded one.
//
//   npm run regrade -- runs/<model>/<condition>/baseline [...]

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { loadCases } from "./cases.ts"
import { gradeAnswer } from "./grader.ts"
import { type ResultRow, readJSONL } from "./results.ts"

export interface Verdict {
  key: string
  typechecks: number
  passes: number
  deprecations: number
}

export interface RegradeReport {
  verdicts: Verdict[]
  mismatches: { key: string; recorded: ResultRow["grade"]; regraded: Verdict }[]
}

export async function regrade(variantDirs: string[], concurrency = 4): Promise<RegradeReport> {
  const cases = new Map((await loadCases()).map((evalCase) => [evalCase.meta.id, evalCase]))
  const jobs: { dir: string; row: ResultRow }[] = []
  for (const dir of variantDirs) {
    for (const row of await readJSONL<ResultRow>(join(dir, "results.jsonl"))) {
      if (row.status === "ok") jobs.push({ dir, row })
    }
  }
  const verdicts: Verdict[] = new Array(jobs.length)
  let next = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < jobs.length) {
        const index = next++
        const { dir, row } = jobs[index]
        const evalCase = cases.get(row.prompt_id)
        if (!evalCase) throw new Error(`Unknown case ${row.prompt_id} in ${dir}`)
        const answer = row.meta.answer ? await readFile(join(dir, row.meta.answer), "utf8") : ""
        const grade = await gradeAnswer(evalCase.meta, evalCase.check, answer)
        verdicts[index] = {
          key: `${dir}#${row.prompt_id}#${row.rep}`,
          typechecks: grade.typechecks ? 1 : 0,
          passes: grade.passes ? 1 : 0,
          deprecations: grade.deprecations,
        }
      }
    }),
  )
  const mismatches = jobs
    .map(({ row }, index) => ({
      key: verdicts[index].key,
      recorded: row.grade,
      regraded: verdicts[index],
    }))
    .filter(
      ({ recorded, regraded }) =>
        recorded.typechecks !== regraded.typechecks ||
        recorded.passes !== regraded.passes ||
        recorded.deprecations !== regraded.deprecations,
    )
  return { verdicts, mismatches }
}

async function main() {
  const dirs = process.argv.slice(2)
  if (dirs.length === 0) {
    console.error("Usage: npm run regrade -- <variant directory>...")
    process.exit(2)
  }
  const report = await regrade(dirs)
  for (const mismatch of report.mismatches) {
    console.log(
      `MISMATCH ${mismatch.key}: recorded ${JSON.stringify(mismatch.recorded)}, now ${JSON.stringify(mismatch.regraded)}`,
    )
  }
  console.log(
    `${report.verdicts.length} answers graded again, ${report.mismatches.length} verdicts differ`,
  )
  process.exit(report.mismatches.length === 0 ? 0 : 1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main()
}
