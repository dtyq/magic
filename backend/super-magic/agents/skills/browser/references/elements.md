# Elements and Refs

Read [SKILL.md](../SKILL.md) first. This reference contains the exact signatures for page observation tools and explains the element identity system used by structured observations.

## Tool Signatures

```python
browser_read_page(
    scope: "viewport" | "full" = "viewport",
    tab_id: str | None = None,
)
browser_read_html(
    ref: str | None = None,
    detail: "outline" | "full" = "outline",
    max_chars: int = 20000,
    tab_id: str | None = None,
)
browser_find(
    role: str | None = None,
    name: str | None = None,
    text: str | None = None,
    visible_only: bool = True,
    limit: int = 20,
    tab_id: str | None = None,
)
browser_list_elements(
    scope: "interactive" | "viewport" | "subtree" | "full" | "changes" = "interactive",
    ref: str | None = None,
    tab_id: str | None = None,
)
```

`browser_read_page` is for article-style rendered content. `browser_read_html` exposes real tags, classes, and data attributes for application-style pages. `browser_find` filters the full element set and returns refs without silently choosing one.

On a very large page, do not dump everything. Narrow down in three steps:

1. Use `browser_find` to get a region ref.
2. Use `browser_read_html(ref=that_ref)` to inspect real markup.
3. Use `browser_evaluate` with selectors taken from that output to read the required values.

## Element-list Scopes

- `interactive`: interactive nodes plus the minimum ancestor context needed to understand dialogs, forms, navigation, lists, tables, and page regions. Use this by default before acting.
- `viewport`: the visible page structure, including useful non-interactive context.
- `subtree`: one ref and its descendants. Use it for a large dialog, table, form, or repeated region after the parent is known.
- `full`: the full page skeleton. Use only when the task genuinely requires page-wide structure.
- `changes`: changes since the previous compatible snapshot. Use after an action to verify observable effects.

A snapshot may be truncated. If the target is outside the returned region, narrow the scope, scroll, or request a relevant subtree. Do not respond by printing raw browser protocol data.

## Reading the Tree

Read `result.content` first. Structured data lives under `result.data["snapshot"]`:

- `root_nodes`: the snapshot tree.
- `refs`: the ref records and allowed actions.

There are no `controls` or `elements` fields.

The model-readable tree uses roles, names, states, and refs:

```text
[dialog] Sign in
  [textbox ref=e12 actions=click,fill,press,scroll] Email
  [textbox ref=e13 actions=click,fill,press,scroll] Password
  [button ref=e14 actions=click,hover,scroll] Sign in

[main]
  [heading] Product details
  [button ref=e21 actions=click,hover,scroll] Add to cart
```

Use the hierarchy to distinguish repeated labels. A button named `Close` inside an advertisement dialog is not the same target as a button named `Close` inside the user's current form.

Nodes may include states such as disabled, checked, selected, expanded, pressed, required, readonly, or focused. They may also include actions confirmed by the runtime, such as click, fill, select, check, scroll, hover, or upload.

Each structured ref record contains `ref`, `role`, `accessible_name`, `text`, `attributes`, and `allowed_actions`. It is an accessibility record, not a DOM record: do not read `tag_name` or a top-level HTML `type`. HTML attributes are under `attributes`.

## Ref Lifetime

A ref is valid only for its session, page, frame, and document generation. Within one document generation, repeated snapshots keep a ref stable when backend identity, a unique strong identity, or a unique full fingerprint proves it is the same compatible element. Ambiguous identity or changed allowed actions produce a new ref.

Take a fresh snapshot when:

- the main frame navigated;
- the document was replaced;
- the page reloaded or rebuilt substantially;
- an action reports a stale, missing, or ambiguous ref;
- a dialog, frame, or large page region changed and the previous target can no longer be resolved uniquely.

Do not carry refs between pages, tabs, sessions, or later navigations. Do not save refs in long-lived files or scheduled task definitions.

## Action Verification

An action result can report navigation, new pages, downloads, dialogs, and a snapshot diff. Use those facts before claiming success.

```python
action = tool.call("browser_click", {
    "ref": target_ref,
})
if not action.ok:
    print(action.content)
else:
    changes = tool.call("browser_list_elements", {
        "scope": "changes",
    })
    print(changes.content)
```

If no observable change is available, report that the action was dispatched and inspect the page again using the method appropriate to the task.

## Labeled Screenshots

## Stale Ref Recovery

1. Stop the failed action sequence.
2. Take a fresh `interactive` snapshot of the current page.
3. Re-evaluate the target using its role, accessible name, hierarchy, and state.
4. If multiple candidates remain, inspect a subtree or use a labeled screenshot.
5. Ask the user when the correct target cannot be determined without guessing.

Never recover by clicking the nearest text match or by converting the old ref into a selector.
