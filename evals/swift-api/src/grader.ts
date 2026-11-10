// Grades one Swift answer for one case.
//
// The grader type-checks the answer with the case's check file, then applies
// the rules: no banned constructs and every required symbol present.
// Both rule checks look only at code, after comments and the literal text of
// strings are removed. A grader that cannot run throws GraderError; it never
// reports a failure that it did not observe.

import { execFile } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export interface CaseMeta {
  id: string
  framework: string
  source: string
  tags: string[]
  target: string
  sdk?: string
  swift_flags?: string[]
  required_symbols: string[]
  docs: string[]
  notes: string
  round?: number
}

export interface TypeCheck {
  ok: boolean
  output: string
  errors: string[]
  warnings: string[]
  deprecations: string[]
  seconds: number
}

export interface Grade {
  /** The answer and the check file type-check together. */
  typechecks: boolean
  /** The answer type-checks, uses no banned construct, and has every required symbol. */
  passes: boolean
  /** The number of deprecation warnings that the compiler reports for the answer. */
  deprecations: number
  typeCheck: TypeCheck
  violations: string[]
  missingSymbols: string[]
}

/** The grader could not produce a verdict, for example because the SDK is missing. */
export class GraderError extends Error {
  override name = "GraderError"
}

export const bannedConstructs: { name: string; pattern: RegExp }[] = [
  { name: "fatalError", pattern: /\bfatalError\b/ },
  { name: "preconditionFailure", pattern: /\bpreconditionFailure\b/ },
  { name: "unsafeBitCast", pattern: /\bunsafeBitCast\b/ },
  { name: "force cast (as!)", pattern: /\bas!/ },
]

// Matches the first line of a compiler diagnostic, in a source file or a macro expansion.
const diagnosticLine = /^[^|`].*:\d+:\d+: (error|warning): /

// Replaces comments and the literal text of strings with spaces,
// so that rule checks see only code. Interpolated expressions stay.
export function codeOnly(source: string): string {
  let out = ""
  let i = 0
  const n = source.length
  const blank = (c: string) => (c === "\n" ? "\n" : " ")

  // Copies an interpolation \( ... ) as code, up to its closing parenthesis.
  const interpolation = () => {
    out += "\\("
    i += 2
    let depth = 1
    while (i < n && depth > 0) {
      if (source[i] === '"') {
        string()
        continue
      }
      if (source[i] === "(") depth++
      if (source[i] === ")") depth--
      out += source[i]
      i++
    }
  }

  const string = () => {
    const multiline = source.startsWith('"""', i)
    const quote = multiline ? '"""' : '"'
    out += quote
    i += quote.length
    while (i < n && !source.startsWith(quote, i)) {
      if (!multiline && source[i] === "\n") return
      if (source.startsWith("\\(", i)) {
        interpolation()
      } else if (source[i] === "\\") {
        out += "  "
        i += 2
      } else {
        out += blank(source[i])
        i++
      }
    }
    out += quote
    i += quote.length
  }

  while (i < n) {
    if (source.startsWith("//", i)) {
      while (i < n && source[i] !== "\n") {
        out += " "
        i++
      }
    } else if (source.startsWith("/*", i)) {
      let depth = 0
      do {
        if (source.startsWith("/*", i)) {
          depth++
          out += "  "
          i += 2
        } else if (source.startsWith("*/", i)) {
          depth--
          out += "  "
          i += 2
        } else {
          out += blank(source[i])
          i++
        }
      } while (i < n && depth > 0)
    } else if (source[i] === '"') {
      string()
    } else {
      out += source[i]
      i++
    }
  }
  return out
}

/** Returns the grader's command line, without the leading `xcrun`. */
export function typeCheckArguments(meta: CaseMeta): string[] {
  return [
    "--sdk",
    meta.sdk ?? "macosx",
    "swiftc",
    "-typecheck",
    "-target",
    meta.target,
    ...(meta.swift_flags ?? []),
    "answer.swift",
    "check.swift",
  ]
}

function runTypeCheck(meta: CaseMeta, dir: string): Promise<TypeCheck> {
  const start = performance.now()
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(
      "xcrun",
      typeCheckArguments(meta),
      { cwd: dir, timeout: 300_000, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const output = `${stdout}${stderr}`
        const diagnostics = output.split("\n").filter((line) => diagnosticLine.test(line))
        const errors = diagnostics.filter((line) => line.includes(": error: "))
        const warnings = diagnostics.filter((line) => line.includes(": warning: "))
        if (error) {
          const failure = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string }
          // A compile error exits with a status and prints source diagnostics.
          // Anything else (a missing tool or SDK, a crash, a timeout) is the grader's failure.
          if (typeof failure.code !== "number" || failure.killed || failure.signal) {
            rejectPromise(new GraderError(`xcrun did not run: ${error.message}`))
            return
          }
          if (errors.length === 0 || /^xcrun: error/m.test(output)) {
            rejectPromise(new GraderError(`swiftc failed without a source error:\n${output}`))
            return
          }
        }
        resolvePromise({
          ok: error === null,
          output,
          errors,
          warnings,
          deprecations: warnings.filter((line) =>
            /deprecated|renamed|#DeprecatedDeclaration/.test(line),
          ),
          seconds: (performance.now() - start) / 1000,
        })
      },
    )
  })
}

/** Grades `answer` for the case in a fresh temporary directory. */
export async function gradeAnswer(meta: CaseMeta, check: string, answer: string): Promise<Grade> {
  const dir = await mkdtemp(join(tmpdir(), `swift-api-${meta.id}-`))
  try {
    await writeFile(join(dir, "answer.swift"), answer)
    await writeFile(join(dir, "check.swift"), check)
    const typeCheck = await runTypeCheck(meta, dir)
    const code = codeOnly(answer)
    const violations = bannedConstructs.filter((c) => c.pattern.test(code)).map((c) => c.name)
    // Whitespace does not matter, so that `addObserver(\n  of:` matches `addObserver(of`.
    const compact = code.replace(/\s+/g, "")
    const missingSymbols = meta.required_symbols.filter(
      (symbol) => !compact.includes(symbol.replace(/\s+/g, "")),
    )
    const answerDeprecations = typeCheck.deprecations.filter((line) =>
      line.startsWith("answer.swift:"),
    )
    return {
      typechecks: typeCheck.ok,
      passes: typeCheck.ok && violations.length === 0 && missingSymbols.length === 0,
      deprecations: answerDeprecations.length,
      typeCheck,
      violations,
      missingSymbols,
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** Describes why an answer does not pass, or returns an empty string. */
export function describeGrade(grade: Grade): string {
  const reasons: string[] = []
  if (!grade.typechecks) reasons.push("type-check fails")
  if (grade.violations.length > 0) reasons.push(`uses ${grade.violations.join(", ")}`)
  if (grade.missingSymbols.length > 0) reasons.push(`lacks ${grade.missingSymbols.join(", ")}`)
  return reasons.join("; ")
}
