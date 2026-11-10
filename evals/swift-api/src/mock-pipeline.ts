// Tests the whole pipeline without paid calls, using the mock provider.
//
//   npm run test:mock [-- --keep] [-- --sosumi-url <url>]
//
// Runs every case in both conditions with the reference, stale, stub, and
// empty answers, through a local Sosumi server, then checks the scores,
// induced failures, resume, the spend cap, and that grading twice agrees.

import { execFile } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { evalDir } from "./cases.ts"
import { regrade } from "./regrade.ts"
import { type ErrorRow, type ResultRow, readJSONL, summarize } from "./results.ts"
import { type LocalServer, startLocalServer } from "./sosumi.ts"

const { values } = parseArgs({
  options: {
    keep: { type: "boolean", default: false },
    "sosumi-url": { type: "string" },
    "sosumi-port": { type: "string", default: "8791" },
  },
})

const failures: string[] = []
function check(condition: boolean, message: string) {
  console.log(`${condition ? "ok  " : "FAIL"} ${message}`)
  if (!condition) failures.push(message)
}

function runEval(args: string[]): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(
      process.execPath,
      [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        join(evalDir, "src", "run.ts"),
        ...args,
      ],
      { cwd: evalDir, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) rejectPromise(new Error(`run.ts ${args.join(" ")} failed:\n${stdout}${stderr}`))
        else resolvePromise(stdout)
      },
    )
  })
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`

const runsDir = await mkdtemp(join(tmpdir(), "swift-api-mock-"))
let server: LocalServer | null = null
try {
  let url = values["sosumi-url"]
  if (!url) {
    server = await startLocalServer(
      Number(values["sosumi-port"]),
      join(runsDir, "sosumi-server.log"),
    )
    url = server.url
  }
  const common = [
    "--provider",
    "mock",
    "--runs-dir",
    runsDir,
    "--sosumi-url",
    url,
    "--concurrency",
    "3",
  ]
  const flow = (answer: string, condition: string, failure = "none") =>
    join(
      runsDir,
      failure === "none" ? `mock-${answer}` : `mock-${answer}-${failure}`,
      condition,
      "baseline",
    )

  // 1. Every case, both conditions, four answers.
  console.log(`Runs directory: ${runsDir}`)
  const started = performance.now()
  for (const answer of ["reference", "stale", "stub", "empty"]) {
    await runEval([...common, "--mock-answer", answer, "--condition", "both"])
  }
  console.log(`Full mock pass: ${((performance.now() - started) / 1_000).toFixed(1)} s\n`)

  console.log("| Answer | Condition | Cases | passes | typechecks | Errors |")
  console.log("| --- | --- | --- | --- | --- | --- |")
  const summaries = new Map<string, Awaited<ReturnType<typeof summarize>>>()
  for (const answer of ["reference", "stale", "stub", "empty"]) {
    for (const condition of ["sosumi", "none"]) {
      const summary = await summarize(flow(answer, condition))
      summaries.set(`${answer}/${condition}`, summary)
      console.log(
        `| ${answer} | ${condition} | ${summary.cases} | ${percent(summary.passes.mean)} | ${percent(summary.typechecks.mean)} | ${summary.errors} |`,
      )
    }
  }
  console.log("")
  for (const condition of ["sosumi", "none"]) {
    const reference = summaries.get(`reference/${condition}`)
    check(
      reference?.passes.mean === 1 && reference.errors === 0,
      `reference passes every case (${condition})`,
    )
    check(
      summaries.get(`stale/${condition}`)?.typechecks.mean === 0,
      `stale type-checks in no case (${condition})`,
    )
    check(
      summaries.get(`stub/${condition}`)?.passes.mean === 0,
      `stub passes no case (${condition})`,
    )
    check(
      summaries.get(`empty/${condition}`)?.typechecks.mean === 0,
      `empty answer type-checks in no case (${condition})`,
    )
  }
  const sosumiRows = await readJSONL<ResultRow>(join(flow("reference", "sosumi"), "results.jsonl"))
  const noneRows = await readJSONL<ResultRow>(join(flow("reference", "none"), "results.jsonl"))
  check(
    sosumiRows.every((row) => row.sosumi_calls === 1 && row.tool_calls === 2),
    "sosumi rows record one Sosumi call",
  )
  check(
    noneRows.every((row) => row.sosumi_calls === 0 && row.tool_calls === 1),
    "none rows record no Sosumi call",
  )

  // 2. Induced failures land in errors.jsonl with a failure class, not in results.jsonl.
  const one = ["--case", "control-sha256-hex", "--condition", "none"]
  await runEval([...common, ...one, "--mock-failure", "error"])
  await runEval([...common, ...one, "--mock-failure", "timeout", "--timeout-s", "2"])
  await runEval([...common, ...one, "--mock-failure", "mismatch"])
  await runEval([...common, ...one, "--mock-failure", "rate-limit-once"])
  for (const [failure, expected] of [
    ["error", "api_error"],
    ["timeout", "timeout"],
    ["mismatch", "model_mismatch"],
  ]) {
    const errors = await readJSONL<ErrorRow>(
      join(flow("reference", "none", failure), "errors.jsonl"),
    )
    const results = await readJSONL<ResultRow>(
      join(flow("reference", "none", failure), "results.jsonl"),
    )
    check(
      errors.length === 1 && errors[0].failure_class === expected && results.length === 0,
      `induced ${failure} is recorded in errors.jsonl as ${expected}`,
    )
  }
  const timeoutRow = (
    await readJSONL<ErrorRow>(join(flow("reference", "none", "timeout"), "errors.jsonl"))
  )[0]
  check(
    timeoutRow !== undefined && timeoutRow.latency_s < 10,
    `the timeout fired at ${timeoutRow?.latency_s.toFixed(1)} s`,
  )
  const retried = await readJSONL<ResultRow>(
    join(flow("reference", "none", "rate-limit-once"), "results.jsonl"),
  )
  check(
    retried.length === 1 && retried[0].retries === 1,
    "a rate limit is retried once and the retry is recorded",
  )

  // 3. Resume: a second run of the same flow adds no rows; a failed attempt runs again.
  const before = noneRows.length
  await runEval([...common, "--mock-answer", "reference", "--condition", "none"])
  const after = (await readJSONL<ResultRow>(join(flow("reference", "none"), "results.jsonl")))
    .length
  check(after === before, `resume adds no duplicate rows (${before} before, ${after} after)`)
  await runEval([...common, ...one, "--mock-failure", "error"])
  const errorsAgain = await readJSONL<ErrorRow>(
    join(flow("reference", "none", "error"), "errors.jsonl"),
  )
  check(errorsAgain.length === 2, "a failed attempt is attempted again on resume")

  // 4. The spend cap stops new attempts before the next one could pass it.
  const capped = await runEval([
    ...common,
    "--mock-answer",
    "stub",
    "--condition",
    "none",
    "--runs-dir",
    join(runsDir, "capped"),
    "--mock-usd-per-attempt",
    "1",
    "--max-usd-mock",
    "2.5",
  ])
  const cappedRows = await readJSONL<ResultRow>(
    join(runsDir, "capped", "mock-stub", "none", "baseline", "results.jsonl"),
  )
  check(
    cappedRows.length === 2 && capped.includes("Stopped before the spend cap"),
    `a cap of 2.5 USD at 1 USD per attempt stops after ${cappedRows.length} attempts`,
  )
  check(
    capped.includes("Cumulative spend under") && capped.includes("mock 2.0000 USD (2 attempts)"),
    "the summary prints the cumulative spend by provider",
  )

  // The cap counts spend already on disk: a second run of the same flow starts nothing,
  // and neither does a run of another flow under the same runs directory.
  const cappedArgs = (answer: string) => [
    ...common,
    "--mock-answer",
    answer,
    "--condition",
    "none",
    "--runs-dir",
    join(runsDir, "capped"),
    "--mock-usd-per-attempt",
    "1",
    "--max-usd-mock",
    "2.5",
  ]
  const again = await runEval(cappedArgs("stub"))
  const otherFlow = await runEval(cappedArgs("reference"))
  const cappedAfter = await readJSONL<ResultRow>(
    join(runsDir, "capped", "mock-stub", "none", "baseline", "results.jsonl"),
  )
  const otherRows = await readJSONL<ResultRow>(
    join(runsDir, "capped", "mock-reference", "none", "baseline", "results.jsonl"),
  )
  check(
    cappedAfter.length === 2 && again.includes("Stopped before the spend cap"),
    "a second run of the capped flow starts no attempt",
  )
  check(
    otherRows.length === 0 && otherFlow.includes("Stopped before the spend cap"),
    "a run of another flow counts the spend of the first and starts no attempt",
  )

  // 5. Grading the same answers again gives the same verdicts, twice.
  const dirs = ["reference", "stale", "stub", "empty"].flatMap((answer) =>
    ["sosumi", "none"].map((condition) => flow(answer, condition)),
  )
  const first = await regrade(dirs)
  const second = await regrade(dirs)
  check(
    first.mismatches.length === 0,
    `regrade 1 matches all ${first.verdicts.length} recorded verdicts`,
  )
  check(
    second.mismatches.length === 0,
    `regrade 2 matches all ${second.verdicts.length} recorded verdicts`,
  )
  check(
    JSON.stringify(first.verdicts) === JSON.stringify(second.verdicts),
    "the two regrades agree with each other",
  )
} finally {
  await server?.stop()
  if (!values.keep) await rm(runsDir, { recursive: true, force: true })
}

console.log("")
console.log(
  failures.length === 0 ? "All mock pipeline checks pass." : `${failures.length} checks failed.`,
)
process.exit(failures.length === 0 ? 0 : 1)
