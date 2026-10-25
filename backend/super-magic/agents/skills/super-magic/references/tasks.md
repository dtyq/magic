# Tasks in other topics

## Delegate, collect results, then continue

When the current task delegates work needed for its own answer or deliverable, the initiating topic remains responsible for collecting and checking the results. The default workflow is:

1. Resolve the target project and topic IDs. Give each delegated task a concrete scope, expected output, and relevant project/file locations. Keep independent tasks in separate topics; avoid overlapping edits to the same files.
2. Submit independent tasks before waiting for their results so they can run concurrently. Record each returned task or queue ID immediately, together with its project, topic, assigned work, and which next step depends on it. Do not wait for all unrelated activity in a topic or project to stop.
3. Continue useful work that does not depend on those results. Before a dependent step, query the exact delegated task IDs and collect their final results. A final comparison of A and B requires both results; a step using only A can proceed once A's result has been checked.
4. Read the completed task's response and inspect relevant output files. Confirm the expected deliverable exists and is usable before satisfying that dependency. Then perform the dependent work and report the actual outcome.

For example: submit project analyses to topics A and B, prepare the report outline while they run, collect and check both analyses, then write the comparison. Do not produce the final comparison from submission receipts or treat a missing analysis as an empty result.

If the user only asks to dispatch work to another topic, report its accepted or queued state; collecting its eventual result is not required by that request. Do not promise automatic follow-up unless an actual runtime mechanism has been established. Do not delegate to the initiating topic and wait on yourself, or create a dependency cycle in which the delegated topic must wait for the initiating task to finish.

## Submit and retain the receipt

`start_topic_task(project_id, topic_id, content, force_interrupt=False)` submits plain-text work. An existing target topic keeps its Agent configuration; a topic with no mode inherits the initiating chat's mode and custom Agent identity. It also inherits the user's selected text model when compatible with the resolved mode. If chat configuration is absent, the tool reads project/platform defaults and the user's topic, project, mode, and global model preferences. These defaults are resolved by the tool, not by updating the topic or inventing parameters. The topic must belong to the supplied project. On an idle topic it creates a new product task and returns `task_id`; creating a topic first and starting its task are separate actions. `send_topic_message` accepts the same parameters for a follow-up, which also creates a new task or queue entry rather than changing an earlier task.

When a topic already has an active task, `force_interrupt=False` queues the new message and returns `queue_id`. `force_interrupt=True` asks the service to suspend that active task and start this one immediately, returning a new `task_id`. Use interruption only when the user's intent includes replacing the current work; do not choose it solely to avoid a queue receipt. A queue ID is never a task ID, and this tool set has no reliable queue-to-task mapping.

```python
from sdk.tool import tool

submitted = tool.call("start_topic_task", {
    "project_id": "<resolved-project-id>",
    "topic_id": "<resolved-other-topic-id>",
    "content": "Analyze the specified project files and return findings with file references. The initiating topic will use your result in its comparison.",
    "force_interrupt": False
})
print(submitted.content)
if submitted.ok:
    receipt = submitted.data or {}
    if receipt.get("kind") == "task":
        print("Track this exact task:", receipt["task_id"])
    elif receipt.get("kind") == "queue":
        print("Queued; task ID is not yet known:", receipt["queue_id"])
```

Replace the example instruction with the actual assignment, files, and expected output. Retain receipts across subsequent snippets; do not rerun submission code just to resume waiting. A lost submission response may still represent an accepted write. Inspect state before resubmitting; if the exact accepted task cannot be identified, report that uncertainty rather than creating duplicate work.

## Wait for specific tasks and validate results

`get_topic_task(task_id)` reads one real task's status; only `task_status="finished"` returns a final result. Read `result.content` first. The structured `data.result` may contain `content`, `truncated`, and `attachments` with file IDs/names. A finished status does not guarantee that the assignment succeeded: missing output, an error in the response, or an unmet requirement leaves the dependency unresolved. When a result is truncated or an attachment is needed, inspect the relevant project file through [Files](files.md); do not infer omitted findings.

The following performs one collection round for known task IDs. Replace placeholders with retained receipts. Reconstruct the pending set from the latest checked states in later snippets; Python variables are not a durable scheduler.

```python
from sdk.tool import tool

task_ids = ["<delegated-task-a-id>", "<delegated-task-b-id>"]
needs_followup = []
for task_id in task_ids:
    checked = tool.call("get_topic_task", {"task_id": task_id})
    print(checked.content)
    data = checked.data or {}
    if not checked.ok or data.get("task_status") != "finished" or not data.get("result"):
        needs_followup.append(task_id)
print("Tasks requiring follow-up:", needs_followup)
# Even an empty list only means final responses were returned.
# Read and validate those responses before doing dependent work.
```

| Observed state | Next action |
| --- | --- |
| Running or otherwise actively progressing | Keep the dependency pending; do independent work or check again after a pause. |
| `finished` | Read and validate the final result and required artifacts before continuing dependent work. |
| Waiting for input or suspended | Inspect the reason and resolve the blocker within the user's authorization; ask for missing user input when necessary. Do not poll endlessly. |
| Failed or canceled | Report the failure and preserve completed results from other tasks. Decide on recovery within the original scope; do not silently substitute an incomplete result or restart blindly. |
| Lookup failure, missing task, or unknown status | Completion is unconfirmed. Preserve the exact ID and explain the uncertainty; do not use another task's result. |

Keep status-checking time bounded to about 60 seconds in one user-facing turn, with pauses between checks rather than a tight loop. This is a waiting budget, not a deadline for the remote task or permission to skip a dependency. Retain known IDs and states before a snippet can time out. If the budget expires, report which work is complete and which dependency remains pending; do not report the overall task complete or perform the dependent step. Resume checking the same IDs when execution continues. These tools do not provide durable suspension, completion callbacks, or automatic resumption of the initiating task after its turn ends; do not promise those behaviors.

## Queued work and cancellation

`list_topic_queued_messages(topic_id, page=1, page_size=20)` inspects one page of a topic's queue. Match the exact retained `queue_id`, and follow pagination only as needed. Queue delivery or disappearance is not proof of Agent completion. With the current tool set, a queued dependency remains unconfirmed until its actual task ID can be reliably established; do not substitute the topic's latest task, an older result, or the queue ID. Explain this tracking limitation when it prevents collecting the required result. Do not interrupt another task or submit a duplicate to bypass it.

`cancel_topic_task(task_id)` requests cancellation of a real task. `delete_topic_queued_message(queue_id)` withdraws a queued entry when permitted; it does not cancel an already running task. Canceling a local wait does not cancel remote work, and a cancellation request is not confirmation that the remote task has stopped. Apply cancellation only to the exact work covered by the user's intent and inspect the resulting state when needed.
