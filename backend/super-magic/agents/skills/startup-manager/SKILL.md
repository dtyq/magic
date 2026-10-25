---
name: startup-manager
description: Register, inspect, test, or remove scripts that run every time this sandbox starts, such as reinstalling project dependencies onto local disk after a sandbox rebuild. Use when dependencies or other local state must come back automatically, or when the user asks what runs at sandbox startup. Not for inspecting, upgrading, or restarting the sandbox itself (use sandbox-manager) or for clock-based schedules (use using-cron).
---

# Startup Manager

A startup task is a shell script stored in `.workspace/.magic/startup/<task_id>.md`. After every sandbox start, all enabled tasks run once, one after another, in the background.

## 1. When to use

| Situation | Use |
| --- | --- |
| Dependencies or other local state must come back after a sandbox rebuild | This skill |
| Run something at a time of day or on an interval | `using-cron` |
| Inspect, upgrade, or restart the sandbox itself | `sandbox-manager` |

Check the `Runtime Environment` section in the system prompt. In a cloud sandbox, a rebuild empties local disk, so startup tasks are what bring dependencies back. On a local machine, dependencies are not lost; do not suggest a startup task unless the user asks for one. If they do, it runs every time the service starts.

## 2. Ask the user first

Tell the user that the script will run automatically every time the sandbox starts, and show the script. Pass `confirmed: True` only after the user agrees. Creating a task, changing its script, and enabling it all require this confirmation; without it the tool returns `confirmation_required`.

## 3. Write idempotent scripts

After a rebuild, dependency directories are empty, not missing. Never use "the directory exists" to decide that dependencies are installed. Use the package manager's own idempotent install:

- npm: `npm install`
- pnpm: `pnpm install --frozen-lockfile`
- Python venv:
  ```bash
  [ -x .venv/bin/python ] || python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
  ```
- uv: `uv sync`
- Composer: `composer install`

Scripts must not wait for input. Set `workdir` to the project directory relative to `.workspace` instead of starting the script with `cd`.

## 4. How tasks run

- Tasks run in the background after each sandbox start. They never block the conversation and never notify anyone.
- Each run is a normal background shell task, so its output can be read with `shell_await`.
- Results only exist for the current sandbox session. You do not need to check them routinely; check them when something looks wrong, such as a missing dependency.
- A task copied from another project, for example through import or sharing, is skipped until the user confirms it for the current project.

## 5. Tools

All tools are called through Code Mode and return a readable `result.content`.

Register a task, then test it right away:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("startup_task_create", {
    "name": "my-app deps",
    "workdir": "my-app",
    "script": "npm install",
    "confirmed": True,
})
print(result.content)
if result.ok:
    run = tool.call("startup_task_run", {"task_id": result.data["task_id"]})
    print(run.content)
""")
```

If the run moved to the background, wait for it with the `shell_await` call given in `run.content` until it finishes, and confirm it succeeded.

Other operations:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

print(tool.call("startup_task_list", {}).content)
print(tool.call("startup_task_update", {"task_id": "my-app-deps", "timeout_seconds": 1800}).content)
print(tool.call("startup_task_delete", {"task_id": "my-app-deps"}).content)
""")
```

`startup_task_update` changes only the fields you pass. Changing `script` or passing `enabled: True` also requires `confirmed: True`.

## 6. Read the status

`startup_task_list` reports how each task ran after this sandbox started:

| Status | What to do |
| --- | --- |
| Running | Wait with `shell_await` on its background task ID, then retry your command |
| Succeeded | Nothing |
| Failed | Read the output or log, fix the script or install manually, and tell the user |
| Stopped after timeout | Read the log; raise `timeout_seconds` only if the install was still progressing |
| Skipped, disabled | Enable it only if the user wants it |
| Skipped, confirmed in a different project | Ask the user again, then call `startup_task_update` with `enabled: True` and `confirmed: True` |
| Not run yet | The startup round has not reached it, or it was never run in this session |
