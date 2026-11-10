# Swift API eval

This eval asks one question:
when an agent writes Swift for an Apple API and Sosumi is its only documentation,
does the code type-check against the SDK?
Each model runs in up to three conditions.
In `sosumi`, the agent has Sosumi's MCP tools and `submit_answer`;
in `none`, it has only `submit_answer`;
in `web`, it has its provider's built-in web search and fetch tools and `submit_answer`.
The difference between `sosumi` and `none` shows what Sosumi adds,
and the difference between `sosumi` and `web` shows whether Sosumi beats the open web.
`--condition` takes one condition or a list, such as `sosumi,web`;
`both` means `sosumi,none`.

In `web`, every server-side search and fetch counts toward the tool-call limit,
and both tools skip `sosumi.ai`.
Anthropic's API limits each web tool separately,
so the runner gives searches and fetches half of the budget each (6 and 6 of 12);
OpenAI's `max_tool_calls` limits all built-in calls together.
Each trace starts with a header that states these limits.
The eval's reference answers are public in the Sosumi repository on GitHub,
so a row whose searches, fetched URLs, or citations include `sosumi.ai`
records `web_leak` and the matching URLs, and the headline leaves it out.
`prices.json` holds the price of a web search for each provider;
the runner refuses the `web` condition for a provider without one.

`split.json` divides the cases into 26 train and 15 test cases.
Each row records its split, the summary prints the headline for each half,
and `--split train` or `--split test` runs one half.

The agent has no compiler, shell, or file access.
It ends a case by calling `submit_answer` with one complete Swift file.
It can make 12 tool calls.
An agent that reaches the limit, or ends its turn, without submitting
gets one final turn in which `submit_answer` is the only tool;
the row records `final_turn` and `final_turn_reason`.
Tool results longer than 100,000 characters are cut, with a note,
and the row records how many were cut in `cut_tool_results`.
A request that fails because the prompt exceeds the model's context window
ends the attempt, which is scored as a failure with the cause `context_overflow`.

The grader type-checks every case in the Swift 6 language mode,
unless the case's `swift_flags` set another mode,
and each task states its mode.

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

Each run starts its own local Sosumi server on a free port,
with its own Wrangler inspector port and state directory,
so that runs can start at the same time.
`--sosumi-port` chooses the port; the run stops if that port is taken.
If the server exits during a run, the runner restarts it and repeats the tool call.
An attempt that still fails because of the server is recorded as `sosumi_server`
in `errors.jsonl` and retried in the same run, up to two times.

## Run

```bash
cd evals/swift-api
ANTHROPIC_API_KEY=... npm run eval -- --model claude-sonnet-5-5 --max-usd-anthropic 5
```

The runner reads keys only from `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.
It refuses to run a model without a price in `prices.json`.
The spend caps are cumulative: before each attempt, the runner adds up the spend
that every flow under `runs/` has recorded for the provider,
and it starts no attempt that could take that total past the cap.
Run `npm run eval -- --help` for every option.

Each attempt writes a row to `results.jsonl` (or, when no answer can be scored,
to `errors.jsonl` with a failure class), a trace in `traces/`,
and the submitted file in `answers/`.
A second run of the same command resumes: it skips every (case, rep)
that already has a result and attempts failed ones again.

## Metrics

- `passes` (the headline): the answer type-checks, uses no `fatalError`,
  `preconditionFailure`, `unsafeBitCast`, or force cast,
  and contains every required symbol.
  A required symbol is one that every correct answer must contain;
  whitespace does not matter, an entry can list alternatives, and some cases have none.
- `typechecks`: the answer and the check file type-check together.
  A stub with `fatalError()` bodies type-checks, so this metric alone overstates success.
- `deprecations`: the number of deprecation warnings in the answer.

## Tests without paid calls

```bash
npm run test:mock     # every case, both conditions, through the local server
npm run regrade -- runs/<model>/<condition>/baseline
npm run regrade -- --write regrade.jsonl runs/<model>/<condition>/baseline
npm run typecheck
```
