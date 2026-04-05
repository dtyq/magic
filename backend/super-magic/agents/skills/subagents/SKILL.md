---
name: subagents
description: Use when multiple independent subtasks can run in parallel, when a research or exploration task is large enough to keep separate rather than do inline (doing it inline fills the conversation with intermediate steps you'll carry through to the end), or when you need a specialized agent type (explore for deep search, shell for system commands). Any task with a clear deliverable and no dependency on the current thread is a good candidate to delegate.
---

# Subagent Dispatch Skill

Use `call_subagent` to delegate tasks to other agents, and `wait_for_subagents` to collect results from background runs.

## When To Use

Delegate when at least one is true:

- The task is large enough to benefit from an isolated execution context
- Multiple independent tasks can run in parallel
- You need a specialized agent type (read-only explore, shell-heavy work)

Do not delegate when:

- The task is small and can be done directly
- The work requires constant access to the current conversation state
- Multiple sub-agents would write to the same file with no merge plan
- You cannot summarize the full context into a self-contained prompt

**Depth limit**: sub-agents cannot call `call_subagent`. Only the root agent may dispatch.

## Tool: call_subagent

```python
from sdk.tool import tool

result = tool.call("call_subagent", {
    "agent_name": str,   # required
    "agent_id":   str,   # required
    "prompt":     str,   # required
    "model_id":   str,   # optional, defaults to inheriting the caller's model
    "background": bool,  # optional, default False
})
```

### agent_name

Maps to a `.agent` filename under `agents/`. Built-in types:

- `magic`: general-purpose, full tool access (web, files, code). Use for complex multi-step tasks.
- `explore`: read-only. Searches files, reads code, answers structural questions. Cannot modify anything.
- `shell`: shell command specialist. Runs scripts, installs deps, performs system operations.

Other `.agent` files (e.g. `data-analyst`) can also be used by name.

### agent_id

Human-readable session identity, e.g. `market-research-phase1`.

- Same `agent_id` → resume the existing conversation (same chat history)
- Different `agent_id` → fresh start with empty history
- Name by responsibility, not by sequence: `ppt-outline`, `shell-install-ffmpeg` — not `task1`, `worker-a`

### prompt

The sub-agent has **no access to the parent's conversation history**. The prompt must be fully self-contained. Include:

- The exact task
- Expected output format
- Relevant file paths or object identifiers
- Constraints (e.g. read-only, specific file to write)
- Success criteria

Bad:

```text
Continue the previous analysis and finish it.
```

Good:

```text
Read app/api/routes/skills.py and summarize how agent_context_id is validated.
Do not modify files. Return:
1. the validation flow
2. error behavior when lookup fails
```

### background

- `False` (default): run synchronously, block until the sub-agent finishes, return result immediately.
- `True`: dispatch as a background task and return immediately. Must follow with `wait_for_subagents` to collect the result.

Use `background=True` for all parallel workloads. Sequential `call_subagent(..., background=True)` calls result in concurrent execution regardless of whether the model supports parallel tool calls.

## Tool: wait_for_subagents

```python
from sdk.tool import tool

result = tool.call("wait_for_subagents", {
    "agent_ids": ["id-a", "id-b"],  # required, list of agent_ids from background calls
    "timeout":   30,                # optional, seconds, default 30, recommended 30–60
})
```

Awaits all listed agents together. `result.content` uses this format per agent:

```
[i/total] agent_type/session_id: status
Result:
```final output```
```

- `status` values: `done`, `error`, `interrupted`, `running`, `not_found`, `ambiguous`
- `Result:` appears only when status is `done` — contains the sub-agent's final output
- When status is `running` (timed out), `Result:` is replaced by `Last message:` — this is the last assistant message the sub-agent produced before the timeout, useful for gauging progress
- `wait_for_subagents` is idempotent — if status is still `running`, call it again or decide to stop waiting
- `result.data["results"]`: structured list for programmatic access, fields: `agent_id`, `agent_name`, `status`, `result`, `error`, `last_activity`

## Output Target

Decide where results go before dispatching. If the output target is missing from the prompt, the sub-agent will guess — and will usually create a file or object it shouldn't.

Three patterns:

**Shared container** (canvas, slides): pass the same container identifier (e.g. project path) to every sub-agent; tell each one which section it owns. Do not let sub-agents create or choose their own container.

**Single file** (report, document): assign the full file to one agent, or have parallel agents draft their sections independently then designate one merge agent to write the final file.

**Independent outputs** (one file per topic, one canvas per theme): each agent gets its own target; no coordination needed.

Never let multiple sub-agents write to the same file concurrently.

## Reporting Results to the User

Sub-agents may include output file paths in their results. When reporting to the user, convert those paths to `[@file_path:path]` format — the frontend renders them as clickable links.

Example: Research report is ready: `[@file_path:reports/market-research.md]`

## Sync Example

```python
from sdk.tool import tool

result = tool.call("call_subagent", {
    "agent_name": "explore",
    "agent_id": "routing-audit",
    "prompt": """Read app/api/routes/skills.py.
Return how call_tool resolves agent_context_id and what happens on lookup failure.
Do not modify files.""",
    "background": False,
})

print(result.content)
```

## Parallel Example

Dispatch first (sequential calls, concurrent execution):

```python
from sdk.tool import tool

def dispatch(agent_id, prompt):
    tool.call("call_subagent", {
        "agent_name": "explore",
        "agent_id": agent_id,
        "prompt": prompt,
        "background": True,
    })

dispatch("read-api", "Read app/api/routes/skills.py. Summarize the request routing flow. Return only proven code facts.")
dispatch("read-sdk", "Read sdk/tool.py and sdk/mcp.py. Summarize how agent_context_id is propagated from skill snippets.")
```

Then wait:

```python
result = tool.call("wait_for_subagents", {
    "agent_ids": ["read-api", "read-sdk"],
    "timeout": 30,
})

print(result.content)
```

## Checklist

Before dispatching:

- Is delegation actually necessary?
- Does the prompt contain all required context (no reference to parent conversation)?
- Is `agent_id` stable, human-readable, and unique to this task branch?
- Is the output target explicit and conflict-free?
- If `background=True`, is there a matching `wait_for_subagents`?
