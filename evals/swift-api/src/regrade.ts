// Grades the saved answers in one or more variant directories again
// and reports every verdict that differs from the recorded one.
//
//   npm run regrade -- runs/<model>/<condition>/baseline [...]
//   npm run regrade -- --write regrade.jsonl runs/<model>/<condition>/baseline [...]
//
// With --write, each directory gets a file with the new verdicts beside its
// results.jsonl, which stays unchanged.

import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { parseArgs } from "node:util"
import { loadCases } from "./cases.ts"
import { gradeAnswer } from "./grader.ts"
import { type ResultRow, readJSONL } from "./results.ts"

export interface Verdict {
  key: string
  typechecks: number
  passes: number
  deprecations: number
  missingSymbols: string[]
  violations: string[]
}

export interface RegradeReport {
  verdicts: Verdict[]
  jobs: { dir: string; row: ResultRow }[]
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
          missingSymbols: grade.missingSymbols,
          violations: grade.violations,
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
  return { verdicts, mismatches, jobs }
}

async function main() {
  const { values, positionals: dirs } = parseArgs({
    options: { write: { type: "string" } },
    allowPositionals: true,
  })
  if (dirs.length === 0) {
    console.error("Usage: npm run regrade -- [--write <file name>] <variant directory>...")
    process.exit(2)
  }
  const report = await regrade(dirs)
  for (const mismatch of report.mismatches) {
    console.log(
      `CHANGED ${mismatch.key}: recorded ${JSON.stringify(mismatch.recorded)}, now ` +
        JSON.stringify({
          typechecks: mismatch.regraded.typechecks,
          passes: mismatch.regraded.passes,
          deprecations: mismatch.regraded.deprecations,
        }),
    )
  }
  if (values.write) {
    const name = values.write
    if (name === "results.jsonl" || name.includes("/"))
      throw new Error("--write takes a new file name")
    const time = new Date().toISOString()
    for (const dir of dirs) {
      const lines = report.jobs
        .map((job, index) => ({ job, verdict: report.verdicts[index] }))
        .filter(({ job }) => job.dir === dir)
        .map(({ job, verdict }) =>
          JSON.stringify({
            prompt_id: job.row.prompt_id,
            rep: job.row.rep,
            recorded_grade: job.row.grade,
            grade: {
              typechecks: verdict.typechecks,
              passes: verdict.passes,
              deprecations: verdict.deprecations,
            },
            changed:
              job.row.grade.typechecks !== verdict.typechecks ||
              job.row.grade.passes !== verdict.passes ||
              job.row.grade.deprecations !== verdict.deprecations,
            missing_symbols: verdict.missingSymbols,
            violations: verdict.violations,
            regraded_at: time,
          }),
        )
      await writeFile(join(dir, name), lines.length > 0 ? `${lines.join("\n")}\n` : "")
      console.log(`Wrote ${lines.length} verdicts to ${join(dir, name)}`)
    }
  }
  console.log(
    `${report.verdicts.length} answers graded again, ${report.mismatches.length} verdicts differ`,
  )
  process.exit(report.mismatches.length === 0 || values.write ? 0 : 1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main()
}
