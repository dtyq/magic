---
name: sandbox-manager
description: Inspect, upgrade, or restart the sandbox this Agent is running in. Use when the user asks about this Agent's sandbox or virtual machine status, Agent image version, or explicitly asks to upgrade or restart its current environment.
---

# Sandbox Manager

This skill manages the execution environment hosting the current Agent. “Current sandbox” means the environment running this Agent process, not an arbitrary sandbox selected by the user.

## User terminology

In this product, “virtual machine”, “VM”, and “virtual machine environment” are user-facing names for the current sandbox hosting this Agent. Treat requests to inspect, upgrade, or restart that virtual machine as requests for the corresponding sandbox operation. Do not interpret them as requests to manage the host machine or another sandbox.

These are Code Mode tools. Execute every example through `run_sdk_snippet` with `sdk.tool.call(...)`; do not invent or pass a sandbox ID.

## Read the result correctly

`result.content` is the model-facing summary. `result.data` is the structured payload for programmatic decisions. A `run_sdk_snippet` call only exposes its standard output to the outer Agent, so print both values when inspecting a result.

Use this error pattern:

```python
if not result.ok:
    print(result.content)
    raise SystemExit(1)
```

## Inspect the current sandbox

Use `get_sandbox_info` for the current sandbox ID, runtime status, current Agent image version, latest available version, and update flag.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("get_sandbox_info", {})
if not result.ok:
    print(result.content)
    raise SystemExit(1)

print(result.content)
print(result.data)

data = result.data
if data["needs_update"]:
    print("Latest image:", data["latest_version"])
""")
```

Typical `result.content`:

```text
Current sandbox information:
- Sandbox ID: sandbox_example
- Status: Running
- Current Agent image version: v1
- Latest Agent image version: v2
- Update needed: yes
```

Typical `result.data`:

```json
{
  "sandbox_id": "sandbox_example",
  "status": "Running",
  "current_version": "v1",
  "latest_version": "v2",
  "needs_update": true
}
```

`status` is one of `Pending`, `Running`, `Exited`, `Unknown`, or `NotFound`. Version strings can be empty when the service cannot determine them.

## Upgrade the current sandbox

Call `upgrade_sandbox` only after the user explicitly asks to upgrade this sandbox to the latest Agent image. It does nothing when the image is already current.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("upgrade_sandbox", {})
if not result.ok:
    print(result.content)
    raise SystemExit(1)

print(result.content)
print(result.data)

data = result.data
if data["operation"] == "already_current":
    print("No rebuild is needed")
elif data["operation"] == "upgrade_scheduled":
    print("Scheduled after", data["delay_seconds"], "seconds")
""")
```

When an update is needed, the tool schedules the existing rebuild API and returns before rebuilding:

```text
The current sandbox upgrade has been scheduled. The sandbox is scheduled to be rebuilt in 10 seconds. Reply to the user now and do not call more tools. This confirms scheduling, not completion; after the sandbox is available again, use get_sandbox_info to verify the new image version.
```

Typical requested `result.data`:

```json
{
  "sandbox_id": "sandbox_example",
  "operation": "upgrade_scheduled",
  "current_version": "v1",
  "latest_version": "v2",
  "needs_update": true,
  "delay_seconds": 10
}
```

If the image is already current, the result is:

```json
{
  "sandbox_id": "sandbox_example",
  "operation": "already_current",
  "current_version": "v2",
  "latest_version": "v2",
  "needs_update": false,
  "delay_seconds": 0
}
```

`upgrade_scheduled` means only that a delayed rebuild request was created in the current Agent process. It does not mean the new image is running. Send the user a short final response immediately and do not call another tool in the same run. After the Agent is available again, call `get_sandbox_info` to verify the actual image version.

## Restart the current sandbox

Call `restart_sandbox` only from the interactive main Agent after the user explicitly asks to restart this sandbox, regardless of its image version. Sub-agents must return the request to the main Agent.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("restart_sandbox", {})
if not result.ok:
    print(result.content)
    raise SystemExit(1)

print(result.content)
print(result.data)

data = result.data
if data["operation"] == "restart_requested":
    print("Restart requested; it will be sent after this Agent run is finalized")
""")
```

Typical `result.content`:

```text
The unconditional restart of the current sandbox has been requested. After your final reply, other Agent tasks will be interrupted and the existing archive will be attempted before the restart request is sent. No fixed duration is promised. Reply to the user now and do not call more tools. A new user message or interruption before API dispatch will cancel the pending restart. After the sandbox is available again, the runtime will automatically resume this conversation and use get_sandbox_info to verify its status.
```

Typical `result.data`:

```json
{
  "sandbox_id": "sandbox_example",
  "operation": "restart_requested"
}
```

For a requested restart, `sandbox_id` is the ID of the sandbox being replaced. It is not a promise that the rebuilt sandbox will have the same ID. The request is held until the main Agent finishes its reply, other Agent tasks receive interruption, and the existing archive is attempted. Cleanup timeout or archive failure does not prevent restarting. A new user message or interruption before API dispatch can cancel the pending request. Send the user a short final response immediately and do not call another tool in the same run. After recovery, the runtime resumes the conversation and calls `get_sandbox_info`; report the current availability without assuming the earlier restart request succeeded.

## Safety and persistence

- Never upgrade or restart merely because `needs_update` is true; both operations require explicit user intent.
- Save required work in `.workspace` before a rebuild. Files there persist across sandbox rebuilds; processes, temporary VM state, and files outside `.workspace` do not.
- Restart waits for the main Agent's final reply, bounded interruption of other Agent tasks, and a best-effort archive. A process crash before dispatch can lose the pending request.
- The tool stores a resumption before registering the deferred restart. After the new runtime is ready, it resumes this conversation and checks the current sandbox status before replying.
- A new user message or interruption before API dispatch cancels the pending restart. Once dispatch begins, no new Agent work starts in the old runtime. A failed API request is not automatically retried.
- Do not automatically retry a failed or interrupted upgrade/restart. Inspect the returned error, and after recovery use `get_sandbox_info` before deciding what to do next.
