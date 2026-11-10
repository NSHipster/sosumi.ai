// Checks every case in evals/swift-api/cases with the grader's rules:
// the reference passes, and the stale, empty, and stub answers fail.
//
// Usage: evals/swift-api/scripts/verify-cases [--case <id>]... [--jobs <n>]

import { access, readdir, readFile } from "node:fs/promises"
import { availableParallelism } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { type CaseMeta, describeGrade as describe, gradeAnswer as grade } from "../src/grader.ts"

const casesDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "cases")
const caseFiles = [
  "task.md",
  "check.swift",
  "reference.swift",
  "stale.swift",
  "stub.swift",
  "meta.json",
]
const sources = ["failure", "sdk-diff", "control"]

function firstErrors(output: string, count = 3): string {
  return output
    .split("\n")
    .filter((line) => /^\S+\.swift:\d+:\d+: error: /.test(line))
    .slice(0, count)
    .map((line) => `      ${line}`)
    .join("\n")
}

function validateMeta(id: string, meta: CaseMeta, task: string): string[] {
  const problems: string[] = []
  if (meta.id !== id) problems.push(`meta.id is ${meta.id}`)
  if (!sources.includes(meta.source)) problems.push(`unknown source ${meta.source}`)
  if (meta.tags?.[0] !== meta.framework) problems.push("first tag is not the framework")
  if (!/^arm64-apple-(macos|ios|tvos)\d+\.\d+$/.test(meta.target ?? "")) problems.push("bad target")
  if (!(meta.required_symbols?.length > 0)) problems.push("no required_symbols")
  if (!(meta.docs?.length > 0)) problems.push("no docs")
  if (meta.docs?.some((url) => !url.startsWith("https://sosumi.ai/"))) {
    problems.push("docs must be Sosumi URLs")
  }
  if (!meta.notes) problems.push("no notes")
  if (!task.includes(meta.target)) problems.push("task.md does not state the target")
  return problems
}

interface CaseReport {
  id: string
  meta: CaseMeta
  problems: string[]
  lines: string[]
  seconds: number[]
}

async function verifyCase(id: string): Promise<CaseReport> {
  const dir = join(casesDir, id)
  const report: CaseReport = { id, meta: {} as CaseMeta, problems: [], lines: [], seconds: [] }
  for (const file of caseFiles) {
    try {
      await access(join(dir, file))
    } catch {
      report.problems.push(`missing ${file}`)
    }
  }
  if (report.problems.length > 0) return report

  const read = (file: string) => readFile(join(dir, file), "utf8")
  const meta = JSON.parse(await read("meta.json")) as CaseMeta
  report.meta = meta
  report.problems.push(...validateMeta(id, meta, await read("task.md")))
  const check = await read("check.swift")

  const [reference, stale, empty, stub] = await Promise.all([
    read("reference.swift").then((answer) => grade(meta, check, answer)),
    read("stale.swift").then((answer) => grade(meta, check, answer)),
    grade(meta, check, ""),
    read("stub.swift").then((answer) => grade(meta, check, answer)),
  ])
  report.seconds.push(...[reference, stale, empty, stub].map((result) => result.typeCheck.seconds))

  if (!reference.passes) {
    report.problems.push(`reference fails: ${describe(reference)}`)
    report.lines.push(firstErrors(reference.typeCheck.output))
  } else if (reference.typeCheck.warnings.length > 0) {
    report.problems.push(
      `reference has warnings:\n      ${reference.typeCheck.warnings.join("\n      ")}`,
    )
  }
  if (stale.typechecks) {
    report.problems.push(`stale type-checks (${describe(stale) || "and passes"})`)
  } else {
    report.lines.push(`    stale: ${describe(stale)}`, firstErrors(stale.typeCheck.output, 1))
  }
  if (empty.passes) report.problems.push("empty answer passes")
  if (stub.passes) {
    report.problems.push("stub passes")
  } else if (!stub.violations.includes("fatalError")) {
    report.problems.push("stub does not use fatalError()")
  } else {
    report.lines.push(`    stub: ${describe(stub)}`)
  }
  return report
}

async function mapLimit<T, R>(items: T[], limit: number, body: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await body(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

function tally(reports: CaseReport[], key: (meta: CaseMeta) => string): string {
  const counts = new Map<string, number>()
  for (const { meta } of reports) counts.set(key(meta), (counts.get(key(meta)) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => `${name} ${count}`)
    .join(", ")
}

async function main() {
  const args = process.argv.slice(2)
  const selected: string[] = []
  let jobs = Math.max(1, Math.floor(availableParallelism() / 4))
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--case") selected.push(args[++i])
    else if (args[i] === "--jobs") jobs = Number(args[++i])
    else {
      console.error(`Unknown argument: ${args[i]}`)
      process.exit(2)
    }
  }

  const entries = await readdir(casesDir, { withFileTypes: true })
  const ids = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((id) => selected.length === 0 || selected.includes(id))
    .sort()
  if (ids.length === 0) {
    console.error("No cases found.")
    process.exit(2)
  }

  const started = performance.now()
  const reports = await mapLimit(ids, jobs, verifyCase)
  const failed = reports.filter((report) => report.problems.length > 0)

  for (const report of reports) {
    const ok = report.problems.length === 0
    console.log(`${ok ? "ok  " : "FAIL"} ${report.id}`)
    for (const problem of report.problems) console.log(`    ${problem}`)
    if (!ok || process.env.VERBOSE) {
      for (const line of report.lines.filter(Boolean)) console.log(line)
    }
  }

  const seconds = reports.flatMap((report) => report.seconds).sort((a, b) => a - b)
  const median = seconds[Math.floor(seconds.length / 2)] ?? 0
  console.log("")
  console.log(
    `${reports.length} cases, ${reports.length - failed.length} ok, ${failed.length} failed`,
  )
  console.log(`By framework: ${tally(reports, (meta) => meta.framework)}`)
  console.log(`By source: ${tally(reports, (meta) => meta.source)}`)
  console.log(
    `Type-checks: ${seconds.length}, median ${median.toFixed(2)} s, ` +
      `max ${(seconds.at(-1) ?? 0).toFixed(2)} s, ` +
      `wall time ${((performance.now() - started) / 1000).toFixed(1)} s with ${jobs} jobs`,
  )
  process.exit(failed.length === 0 ? 0 : 1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main()
}
