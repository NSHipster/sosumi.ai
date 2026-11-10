# Swift API eval

This eval asks one question:
when an agent writes Swift for an Apple API and Sosumi is its only documentation,
does the code type-check against the SDK?
Each model runs in two conditions.
In `sosumi`, the agent has Sosumi's MCP tools and `submit_answer`;
in `none`, it has only `submit_answer`.
The difference between the two scores shows what Sosumi adds.

The agent has no compiler, shell, or file access.
It ends a case by calling `submit_answer` with one complete Swift file.

## Layout

- `cases/<id>/`: the task, check file, reference, stale, and stub answers, and metadata.
  [`CASES.md`](CASES.md) shows every task and reference for review.
- `scripts/verify-cases`: checks that every reference passes
  and that the stale, empty, and stub answers fail.
- `src/run.ts`: the runner. `src/grader.ts`: the grader.
- `prices.json`: USD per million tokens, used for spend caps and reports.
- `runs/<model>/<condition>/baseline/`: results (ignored by Git).

## Setup

The `sosumi` condition starts a local Sosumi server from this worktree,
so the repository's own dependencies must be installed too:

```bash
npm ci                         # in the repository root, for the local server
cd evals/swift-api && npm ci   # for the runner
```

The grader needs Xcode with the macOS and iOS SDKs that the cases name.

## Run

```bash
cd evals/swift-api
ANTHROPIC_API_KEY=... npm run eval -- --model claude-sonnet-5-5 --max-usd-anthropic 5
```

The runner reads keys only from `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.
It refuses to run a model without a price in `prices.json`.
Run `npm run eval -- --help` for every option.

Each attempt writes a row to `results.jsonl` (or, when no answer can be scored,
to `errors.jsonl` with a failure class), a trace in `traces/`,
and the submitted file in `answers/`.
A second run of the same command resumes: it skips every (case, rep)
that already has a result and attempts failed ones again.

## Metrics

- `typechecks`: the answer and the check file type-check together.
- `passes`: the answer type-checks, uses no `fatalError`, `preconditionFailure`,
  `unsafeBitCast`, or force cast, and contains every required symbol.
- `deprecations`: the number of deprecation warnings in the answer.

## Tests without paid calls

```bash
npm run test:mock     # every case, both conditions, through the local server
npm run regrade -- runs/<model>/<condition>/baseline
npm run typecheck
```
