// Writes evals/swift-api/CASES.md, a review copy of every case's task and reference.
//
// Usage: node --experimental-strip-types evals/swift-api/scripts/render-cases.ts

import { readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const evalDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const casesDir = join(evalDir, "cases")

interface CaseMeta {
  id: string
  framework: string
  source: string
  target: string
  swift_flags?: string[]
  required_symbols: (string | string[])[]
  docs: string[]
  notes: string
  round?: number
}

// Returns a backtick fence longer than any backtick run in the text.
function fence(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length))
  return "`".repeat(Math.max(3, longest + 1))
}

function block(language: string, text: string): string {
  const marks = fence(text)
  return `${marks}${language}\n${text.trimEnd()}\n${marks}`
}

function code(text: string): string {
  return text.includes("`") ? `\`\` ${text} \`\`` : `\`${text}\``
}

const ids = (await readdir(casesDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const cases = await Promise.all(
  ids.map(async (id) => {
    const read = (file: string) => readFile(join(casesDir, id, file), "utf8")
    return {
      meta: JSON.parse(await read("meta.json")) as CaseMeta,
      task: await read("task.md"),
      reference: await read("reference.swift"),
    }
  }),
)

const lines: string[] = [
  "# Swift API eval cases",
  "",
  "This file collects the task and reference answer of each case for review.",
  "Each case directory under `cases/` also holds the check file,",
  "a stale answer, a stub answer, and metadata.",
  "`scripts/verify-cases` type-checks every case against the SDK;",
  "`scripts/render-cases.ts` regenerates this file.",
  "",
]

const latestRound = Math.max(...cases.map(({ meta }) => meta.round ?? 1))
if (latestRound > 1) {
  const changed = cases.filter(({ meta }) => (meta.round ?? 1) === latestRound)
  lines.push(`## New in round ${latestRound}`, "")
  lines.push(`These ${changed.length} cases have \`"round": ${latestRound}\` in \`meta.json\`.`, "")
  for (const { meta } of changed) lines.push(`- [${meta.id}](#${meta.id}) (${meta.framework})`)
  lines.push("")
}

lines.push(
  "| ID | Framework | Source | Target | Required symbols |",
  "| --- | --- | --- | --- | --- |",
)
for (const { meta } of cases) {
  const symbols = meta.required_symbols
    .map((entry) => (Array.isArray(entry) ? entry.map(code).join(" or ") : code(entry)))
    .join(", ")
  lines.push(
    `| [${meta.id}](#${meta.id}) | ${meta.framework} | ${meta.source} | ${code(meta.target)} | ${symbols} |`,
  )
}

for (const { meta, task, reference } of cases) {
  lines.push("", `## ${meta.id}`, "")
  lines.push(`- Framework: ${meta.framework}`)
  lines.push(`- Source: ${meta.source}`)
  lines.push(`- Target: ${code(meta.target)}`)
  if (meta.round) lines.push(`- Round: ${meta.round}`)
  if (meta.swift_flags?.length) lines.push(`- Compiler flags: ${code(meta.swift_flags.join(" "))}`)
  else lines.push("- Compiler flags: `-swift-version 6` (the default)")
  lines.push(`- Documentation: ${meta.docs.map((url) => `<${url}>`).join(", ")}`)
  lines.push("", meta.notes, "", "### task.md", "", block("markdown", task))
  lines.push("", "### reference.swift", "", block("swift", reference))
}

await writeFile(join(evalDir, "CASES.md"), `${lines.join("\n")}\n`)
console.log(`Wrote ${cases.length} cases to CASES.md`)
