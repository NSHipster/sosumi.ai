// Reads and writes the files of one flow directory,
// prices usage, and computes the summary that the runner prints.
//
// Layout (one flow per model and condition):
//   runs/<model>/<condition>/_state.json
//   runs/<model>/<condition>/<variant>/results.jsonl
//   runs/<model>/<condition>/<variant>/errors.jsonl
//   runs/<model>/<condition>/<variant>/traces/<case>_rep<k>.json
//   runs/<model>/<condition>/<variant>/answers/<case>_rep<k>.swift

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { FailureClass, Usage } from "./agent.ts"
import { evalDir } from "./cases.ts"

export type Provider = "anthropic" | "openai" | "mock"

export interface ResultRow {
  prompt_id: string
  prompt: string
  tags: string[]
  rep: number
  status: "ok" | "truncated"
  stop_reason: string
  grade: { typechecks?: number; passes?: number; deprecations?: number }
  explanation?: { [metric: string]: string }
  model: string
  usage: Usage
  latency_s: number
  tool_calls: number
  sosumi_calls: number
  retries: number
  meta: {
    provider: Provider
    condition: string
    end_reason: string
    failure_class?: string
    cost_usd: number
    answer?: string
    violations?: string[]
    missing_symbols?: string[]
    target: string
    sdk: string
  }
}

export interface ErrorRow {
  prompt_id: string
  rep: number
  failure_class: FailureClass
  message: string
  retries: number
  model: string | null
  usage: Usage
  cost_usd: number
  latency_s: number
  provider: Provider
  condition: string
  time: string
}

export const flowState = {
  metrics: [
    { id: "typechecks", label: "Type-checks", kind: "binary" },
    { id: "passes", label: "Passes", kind: "binary" },
    { id: "deprecations", label: "Deprecations", kind: "float", scale: 5, better: "lower" },
  ],
  perf_fields: [
    { id: "cost_usd", label: "Cost", unit: "USD" },
    { id: "in_tokens", label: "Input tokens" },
    { id: "out_tokens", label: "Output tokens" },
    { id: "tool_calls", label: "Tool calls" },
    { id: "sosumi_calls", label: "Sosumi calls" },
    { id: "latency_s", label: "Latency", unit: "s" },
  ],
}

export async function readJSONL<T>(path: string): Promise<T[]> {
  let text: string
  try {
    text = await readFile(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T)
}

export async function appendJSONL(path: string, row: unknown): Promise<void> {
  await appendFile(path, `${JSON.stringify(row)}\n`)
}

/** Writes _state.json for a flow when the flow has none, so that a later edit by hand survives. */
export async function ensureFlowState(flowDir: string, model: string, price: Price | null) {
  await mkdir(flowDir, { recursive: true })
  const path = join(flowDir, "_state.json")
  try {
    await readFile(path)
    return
  } catch {
    // Write it below.
  }
  const state = {
    ...flowState,
    ...(price ? { prices: { [model]: { in: price.input, out: price.output } } } : {}),
  }
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`)
}

export interface Price {
  input: number
  output: number
  cache_read: number
}

interface PriceTable {
  cache_write_multiplier: number
  anthropic: Record<string, Price | null>
  openai: Record<string, Price | null>
}

export async function loadPrices(): Promise<PriceTable> {
  return JSON.parse(await readFile(join(evalDir, "prices.json"), "utf8")) as PriceTable
}

/** Prices one usage record in USD. `input_tokens` excludes cached tokens. */
export function costUSD(usage: Usage, price: Price, cacheWriteMultiplier: number): number {
  return (
    (usage.input_tokens * price.input +
      usage.output_tokens * price.output +
      usage.cache_read_input_tokens * price.cache_read +
      usage.cache_creation_input_tokens * price.input * cacheWriteMultiplier) /
    1_000_000
  )
}

export interface Interval {
  mean: number
  low: number
  high: number
  n: number
}

/** The Wilson score interval at 95% for a proportion over `n` cases. */
export function wilson(mean: number, n: number): Interval {
  if (n === 0) return { mean: Number.NaN, low: Number.NaN, high: Number.NaN, n }
  const z = 1.96
  const denominator = 1 + (z * z) / n
  const center = (mean + (z * z) / (2 * n)) / denominator
  const margin = (z * Math.sqrt((mean * (1 - mean)) / n + (z * z) / (4 * n * n))) / denominator
  return { mean, low: Math.max(0, center - margin), high: Math.min(1, center + margin), n }
}

export interface FlowSummary {
  variantDir: string
  cases: number
  rows: number
  truncated: number
  errors: number
  errorsByClass: Record<string, number>
  typechecks: Interval
  passes: Interval
  deprecations: number
  spendByProvider: Record<string, number>
}

/**
 * Summarizes a variant directory the way the report builder does:
 * the mean over status-ok reps of each case, then the mean over cases.
 * Errors and truncated rows are counted beside the means, never in them.
 */
export async function summarize(variantDir: string): Promise<FlowSummary> {
  const rows = await readJSONL<ResultRow>(join(variantDir, "results.jsonl"))
  const errors = await readJSONL<ErrorRow>(join(variantDir, "errors.jsonl"))
  const scored = new Set(rows.map((row) => `${row.prompt_id}#${row.rep}`))
  const openErrors = errors.filter((row) => !scored.has(`${row.prompt_id}#${row.rep}`))

  const perCase = new Map<string, ResultRow[]>()
  for (const row of rows.filter((row) => row.status === "ok")) {
    perCase.set(row.prompt_id, [...(perCase.get(row.prompt_id) ?? []), row])
  }
  const caseMean = (metric: "typechecks" | "passes" | "deprecations") =>
    [...perCase.values()].map(
      (reps) => reps.reduce((sum, row) => sum + (row.grade[metric] ?? 0), 0) / reps.length,
    )
  const mean = (values: number[]) =>
    values.length === 0 ? Number.NaN : values.reduce((a, b) => a + b, 0) / values.length

  const spendByProvider: Record<string, number> = {}
  for (const row of rows) {
    spendByProvider[row.meta.provider] =
      (spendByProvider[row.meta.provider] ?? 0) + row.meta.cost_usd
  }
  for (const row of errors) {
    spendByProvider[row.provider] = (spendByProvider[row.provider] ?? 0) + row.cost_usd
  }
  const errorsByClass: Record<string, number> = {}
  for (const row of openErrors) {
    errorsByClass[row.failure_class] = (errorsByClass[row.failure_class] ?? 0) + 1
  }

  return {
    variantDir,
    cases: perCase.size,
    rows: rows.length,
    truncated: rows.filter((row) => row.status === "truncated").length,
    errors: openErrors.length,
    errorsByClass,
    typechecks: wilson(mean(caseMean("typechecks")), perCase.size),
    passes: wilson(mean(caseMean("passes")), perCase.size),
    deprecations: mean(caseMean("deprecations")),
    spendByProvider,
  }
}

const percent = (value: number) => (Number.isNaN(value) ? "n/a" : `${(value * 100).toFixed(1)}%`)

export function formatSummary(summary: FlowSummary): string {
  const interval = (i: Interval) =>
    `${percent(i.mean)} (95% CI ${percent(i.low)} to ${percent(i.high)})`
  const errorDetail = Object.entries(summary.errorsByClass)
    .map(([name, count]) => `${name} ${count}`)
    .join(", ")
  return [
    `${summary.variantDir}`,
    `  typechecks ${interval(summary.typechecks)} over ${summary.cases} cases`,
    `  passes     ${interval(summary.passes)}`,
    `  deprecations per answer: ${Number.isNaN(summary.deprecations) ? "n/a" : summary.deprecations.toFixed(2)}`,
    `  scored rows ${summary.rows}, truncated ${summary.truncated}, unscored errors ${summary.errors}${errorDetail ? ` (${errorDetail})` : ""}`,
  ].join("\n")
}
