# Browser Debugging

Read [SKILL.md](../SKILL.md) first. Use diagnostic tools only when page behavior, JavaScript, console output, or network activity is relevant to the user's task. This reference contains their exact signatures.

## Tool Signatures

```python
browser_evaluate(
    expression: str,
    argument: JSON | None = None,
    tab_id: str | None = None,
)
browser_add_init_script(source: str, tab_id: str | None = None)
browser_read_console(
    clear: bool = True,
    limit: int = 100,
    tab_id: str | None = None,
)
browser_read_network(
    clear: bool = True,
    limit: int = 100,
    tab_id: str | None = None,
)
```

## JavaScript Evaluation

`browser_evaluate` runs targeted JavaScript in the current tab. All diagnostic tools use that same current tab. `browser_add_init_script` registers JavaScript before site scripts on future navigations of this tab; it does not execute on the current document.

Use it for:

- reading application state that the rendered page does not expose;
- checking a precise DOM or JavaScript condition during development;
- invoking an application-provided function when the user explicitly needs it;
- lightweight inspection after a local page edit.

Do not use it to:

- implement a second Markdown reader;
- recreate the accessibility or DOM snapshot collector;
- locate and click elements instead of using refs;
- send arbitrary CDP commands;
- access another origin, unauthorized tab, cookie store, password, or secret.

Keep expressions focused and return small serializable values. Do not return a complete DOM tree or large application state object.

The result content shows a bounded value preview. The complete JSON-serializable value remains in `result.data["value"]`.

```python
result = tool.call("browser_evaluate", {
    "expression": "() => ({ title: document.title, ready: document.readyState })",
})
print(result.content)
```

## Console

Use `browser_read_console` when the task involves runtime errors, warnings, logs, or client-side behavior. It returns the newest 100 entries by default; set `limit` from 1 to 500 when needed. The default `clear=True` clears that page's current console buffer after reading, so later calls are incremental.

Do not expose secrets found in console output. Summarize the relevant errors and preserve exact error text only when it is safe and useful.

## Network

Use `browser_read_network` when the task involves failed requests, status codes, redirects, API timing, downloads, or page loading behavior.

It returns the newest 100 entries by default; set `limit` from 1 to 500 when needed. The default `clear=True` clears that page's current network buffer after reading. Use `clear=False` only when another call must inspect the same buffer.

Prefer metadata such as method, sanitized URL, status, resource type, timing, and failure reason. Do not print authorization headers, cookies, request bodies containing secrets, or large response bodies.

## Failure Handling

- Stale ref: take a new snapshot.
- Page not found: use `browser_list_tabs` and `browser_select_tab` to choose an existing tab, or `browser_navigate` when no tabs remain.
- Session disconnected: list Browser instances; resume only through the product connection flow.
- Unsupported capability: read session capabilities and use a documented alternative.
- Navigation timeout: inspect the current URL and page state before retrying. Do not assume the navigation failed completely.
- Script injection or Lens failure: report the error. Do not silently replace Lens with a server-side converter.
- User interruption: stop the workflow. Do not retry through a fallback path.

## Output Control

Browser diagnostics can be large, so they are a normal exception to content-first reading. For a small batch, print and read `result.content`. For a large batch or a pipeline step, filter `result.data["console_entries"]` or `result.data["network_entries"]` in code and print only the conclusion and relevant evidence. Do not print the complete structured batch.
