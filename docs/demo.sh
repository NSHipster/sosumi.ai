# Source this file from docs/demo.tape.
#
# It gives Codex a temporary home with only your login,
# so the recording can't use or show your own configuration, skills, or instructions.
# Your Codex configuration isn't changed.

auth_file="${CODEX_HOME:-$HOME/.codex}/auth.json"

DEMO="$(mktemp -d)"
mkdir -p "$DEMO/home/.codex" "$DEMO/work"
ln -s "$auth_file" "$DEMO/home/.codex/auth.json"

export HOME="$DEMO/home"
export CODEX_HOME="$HOME/.codex"
cd "$DEMO/work" || return 1

codex plugin marketplace add NSHipster/sosumi.ai >/dev/null 2>&1 || return 1

# Run a prompt through Codex off camera,
# wait for a keypress from the tape,
# then replay each MCP tool call and the answer about a second apart.
# Long answers are cut so that the tool calls stay on screen.
ask() {
  local status step

  codex exec --json --skip-git-repo-check --ephemeral --sandbox read-only "$1" \
    </dev/null >"$DEMO/events.jsonl" 2>"$DEMO/stderr"
  status="$?"

  printf '.'
  read -r -s
  printf '\r\033[K'

  if [ "$status" -ne 0 ]; then
    tail -n 5 "$DEMO/stderr"
    return "$status"
  fi

  jq -j '
    if .type == "item.started" and .item.type == "mcp_tool_call" then
      "\u001b[36m-> \(.item.server)/\(.item.tool) \(.item.arguments | tojson)\u001b[0m\u0000"
    elif .type == "item.completed" and .item.type == "mcp_tool_call" and .item.status != "completed" then
      "\u001b[31m   \(.item.status)\u001b[0m\u0000"
    elif .type == "item.completed" and .item.type == "agent_message" then
      (.item.text | split("\n")) as $lines |
      "\n\($lines[:36] | join("\n"))\(if ($lines | length) > 36 then "\n\u001b[33m(\(($lines | length) - 36) more lines)\u001b[0m" else "" end)\n\u0000"
    else
      empty
    end' "$DEMO/events.jsonl" |
    while IFS= read -r -d '' step; do
      sleep 1
      printf '%s\n' "$step"
    done

  if ! jq -e 'select(.item.type == "mcp_tool_call")' "$DEMO/events.jsonl" >/dev/null; then
    sleep 1
    printf '\033[33mNo MCP tools were called.\033[0m\n'
  fi
}
