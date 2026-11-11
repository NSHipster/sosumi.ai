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

In `sosumi`, the system prompt ends with the Sosumi server's MCP instructions
under the heading "Instructions from the documentation server",
as hosts such as Claude Code show them to the model;
`--no-server-instructions` leaves them out.
`--sosumi-root <path>` starts the local server from another checkout of this repository,
such as a worktree on a branch; that checkout needs its `node_modules` installed.
Each trace starts with a header, not sent to the model,
that states the limits, whether the instructions were included and their length,
and the checkout's path and commit, which each row's `meta` records too.

Results go to `runs/<model>/<condition>/<variant>/`.
`--variant` names the variant directory, `baseline` by default or `v<N>`,
and `--change-note <text>` writes `change.md` there;
the report builder takes the variant's description from its first line.

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

## Results

These results come from runs on 2026-11-10
against Sosumi's `main` branch at `25bc75a`.

The eval has 41 Swift tasks.
31 use APIs that are new in the macOS 27.0 or iOS 27 SDKs,
5 come from recorded agent failures,
and 5 are controls that use APIs that have been stable for a long time.
Each model ran each task 3 times in each condition,
so each cell below comes from 123 attempts.
A score is the mean of the per-task pass rates for the `passes` metric.
The cost is the provider's list price for the tokens that the attempts used,
plus web search fees, divided by 123.

| Model | Sosumi | Built-in web search | No documentation |
| --- | --- | --- | --- |
| Claude Haiku 5.5 | 76.4% ($0.0022) | 64.2% ($0.0197) | 22.8% ($0.0009) |
| Claude Sonnet 5.5 | 93.5% ($0.0218) | 63.4% ($0.0446) | 30.9% ($0.0083) |
| Claude Opus 5.5 | 98.4% ($0.0573) | 83.7% ($0.1116) | 38.2% ($0.0251) |
| GPT-6.1 Sol | 96.7% ($0.0127) | 99.2% ($0.0396) | 33.3% ($0.0155) |

The columns are the `sosumi`, `web`, and `none` conditions.
In `web`, Anthropic models had at most 6 searches and 6 fetches,
and OpenAI models had one limit for all built-in calls.
Every condition had a limit of 12 tool calls.

The results support these claims:

- Without documentation, the strongest models pass about a third of the tasks.
- With Sosumi, Claude models score 12 to 30 percentage points higher
  than with their built-in web search, at about half the cost or less.
- GPT-6.1 Sol scored 2.5 percentage points higher with web search than with Sosumi,
  at about 3 times the cost per attempt.

Running the eval led to seven fixes in Sosumi.
Six of them, #122 through #127, are in `25bc75a`, the commit that these runs used.
The seventh, #129, came from a later investigation
and was merged after these runs.
For example, framework pages had rendered Apple's whole navigator index,
which was 3 MB for Observation.

### Caveats

- Each score has a 95% interval of about ±9 points.
- The two providers' web tools are different,
  so compare conditions for one provider, not web search across providers.
- In these runs, the `sosumi` condition did not include
  Sosumi's server instructions in the system prompt.
  The runner now includes them by default;
  `--no-server-instructions` matches these runs.
- Costs are list prices from `prices.json` at the time of the runs,
  not billed amounts.

### Reproduce

The published results came from two versions of the runner:
runner commit `7954250` for the `sosumi` and `none` conditions,
which ran together, and runner commit `fc377f4` for the `web` condition.
The commands below rerun the conditions with the current runner
against the Sosumi commit that these runs used,
so their results can differ from the published ones.
The grader needs Xcode with the SDKs that the cases name, as [Setup](#setup) describes.

Start from the repository root.
Check out the Sosumi commit that these runs used into its own worktree,
and install its dependencies:

```bash
git worktree add ../sosumi-25bc75a 25bc75a
(cd ../sosumi-25bc75a && npm ci)
```

Then install the runner's dependencies and run each model in the three conditions:

```bash
cd evals/swift-api
npm ci
for model in claude-haiku-5-5 claude-sonnet-5-5 claude-opus-5-5; do
  ANTHROPIC_API_KEY=... npm run eval -- --model "$model" \
    --condition sosumi,web,none --reps 3 \
    --sosumi-root ../../../sosumi-25bc75a --no-server-instructions \
    --max-usd-anthropic 40
done
OPENAI_API_KEY=... npm run eval -- --model gpt-6.1-sol \
  --condition sosumi,web,none --reps 3 \
  --sosumi-root ../../../sosumi-25bc75a --no-server-instructions \
  --max-usd-openai 10
```

The other options keep their defaults, including 12 tool calls per attempt.
The spend caps are cumulative across `runs/`,
and they leave some room above the cost of the runs above.
A model's results and its summary are in `runs/<model>/<condition>/baseline/`.

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
