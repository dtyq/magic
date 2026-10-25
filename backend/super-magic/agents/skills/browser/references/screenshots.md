# Screenshots and Visual Queries

Read [SKILL.md](../SKILL.md) first. Use these tools when the task depends on rendered pixels, layout, or visual evidence rather than accessible names and DOM structure.

## Tool Signatures

```python
browser_screenshot(
    labels: bool = False,
    full_page: bool = False,
    output_path: str | None = None,
    scale: float | None = None,
    quality: int | None = None,
    tab_id: str | None = None,
)
browser_visual_query(
    query: str,
    full_page: bool = False,
    tab_id: str | None = None,
)
browser_find_visual(target: str, tab_id: str | None = None)
```

Screenshots and visual tools capture the current tab. Each Tool Detail screenshot is bound to the actual tab used by that operation, even when a different desktop tab is visible or an action opens a popup. If that tab disappears before capture, the tool keeps its result without substituting another tab's image.

`browser_visual_query` captures the page once, publishes one topic-scoped screenshot artifact, and attaches it as native visual input for the next main model request. Do not call `browser_screenshot` first when the task is to answer a visual question, and do not call `visual_understanding` on the Browser screenshot separately.

For long, dense visual content, scroll one viewport at a time and call `browser_visual_query` on each viewport. Use `full_page=True` only for overall layout because very long screenshots lose fine detail when compressed.

Screenshot format is inferred from `.webp`, `.jpg`, `.jpeg`, or `.png`. Omit `scale` and `quality` normally. `scale` accepts 0.5-3.0; WebP and JPEG `quality` accepts 1-100; PNG rejects `quality`.

## Labeled Screenshots

`browser_screenshot(labels=True)` first obtains an interactive viewport element list, renders labels for selected element refs, captures the image, and removes the overlay.

Labels exist only for that screenshot. The overlay is temporary, and labels are not stable identifiers.

The result includes a `label_to_ref` mapping. Convert a visual choice back to the mapped ref and use a normal interaction tool:

```python
shot = tool.call("browser_screenshot", {
    "labels": True,
})
print(shot.content)
if shot.ok:
    target_ref = shot.data["label_to_ref"]["A2"]
    print(tool.call("browser_click", {
        "ref": target_ref,
    }).content)
```

Do not infer a ref from the label text. Do not reuse a label mapping after scrolling, resizing, navigation, or another element list that changes the page state.

Prefer `browser_find_visual` when the goal is to find one visually described control. It performs the labeled screenshot and returns one validated ref directly.
