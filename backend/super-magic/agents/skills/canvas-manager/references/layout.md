# Canvas space and arrangement

Load for finding nearby Elements, relative placement, alignment or equal spacing. Use exact queried IDs; names and visual intuition select targets, but the program computes coordinates and display sizes.

## query_canvas_layout

`project_path` is required. Choose one scope:

- `around` (default): required `anchor_element_ids`; pass one exact ID by default; the finite world rectangle is centered on its display bounds. An explicitly requested group uses the union bounds. Use `context_scale` (default 3) or both `view_width` and `view_height`, never both methods. Dimensions describe Canvas space, not image pixel dimensions.
- `frame`: required `frame_element_id`; query the exact Frame and its descendants.
- `region`: required `region={x,y,width,height}` in world coordinates.
- `all`: search the lightweight document index; no image rendering or automatic whole-Canvas visual overview.

Optional `query` matches Canvas titles and the current file path basename; `include_hidden=false`, `page=1`, `limit=50` (maximum 100). Results include matching count, `has_more`, finite bounds, geometry completeness, exact IDs, parent, versions, status and axis-aligned bounds relations. Frame clipping is reflected in `visible_bounds`. A bounds overlap is a geometric relation, not a business Connection or proof of semantic image content.

Pagination never changes the region. Follow `has_more`; do not treat page 1 as the entire area. Do not enlarge a region to reach an image count or shrink it to cap the count. Twenty/one hundred images are evaluation workloads, not query limits. Missing geometry is reported, never guessed from source file pixels.

```python
from sdk.tool import tool
result = tool.call("query_canvas_layout", {
    "project_path": "Demo", "scope": "around", "anchor_element_ids": ["element-A"],
    "view_width": 4096, "view_height": 3072,
})
print(result.content)
```

## arrange_canvas_elements

Required: `project_path`, ordered `element_ids`. The program retains dimensions, Content, files and Connections; never fabricate Connections to express visual placement.

- `operation=arrange` (default): `pattern=row|column|grid`, `columns` required for grid; optional `anchor_element_ids`, `side=left|right|above|below`, `alignment=start|center|end`, `gap` in Canvas units (default existing spacing 200).
- Targets and references must share the same immediate parent; reference Elements stay still. The target order defines row/column/grid order. A collision moves the entire group farther along the specified side, without moving other Elements. Without a reference, the group starts at its current bounds; a collision is rejected.
- `operation=align`: `direction=left|center|right|top|middle|bottom`.
- `operation=distribute`: `direction=horizontal|vertical`; uses the same row/column arrangement, exact target order and nonnegative spacing as `arrange`. Supports `gap`, `anchor_element_ids`, `side` and `alignment`; do not pass `pattern` or `columns`. Prefer `arrange` for ordinary material organization.
- Rearrangement uses actual display sizes and spacing, never squeezes Elements into their previous outer bounds or the visible viewport. For widths 600/1000/700 with gap 200, the new row is 2700 wide even if the previous bounds were only 1900. Elements are not resized.
- For alignment/distribution inside one Frame, set `scope=children` and pass only the Frame ID. Visible direct children are used; locked children still cause rejection. Distribution retains their spatial order along the requested axis, starts at their current top-left and uses the same spacing; it does not spread spare Frame space to edge margins. A fixed Frame is a real container: a layout exceeding its boundaries fails without moving Elements. Do not treat a viewport as a Frame or silently enlarge a Frame.
- `dry_run=true` returns the direction, spacing, before/after positions and bounds without writing. Execute recalculates from current persisted state. Locked targets/ancestors are never silently unlocked; hidden targets are not automatically revealed.

```python
from sdk.tool import tool
result = tool.call("arrange_canvas_elements", {
    "project_path": "Demo", "element_ids": ["element-B", "element-C", "element-D"],
    "pattern": "row", "anchor_element_ids": ["element-A"], "side": "right",
})
print(result.content)
```

Generating images use their persisted placeholder size. Their final display size may change; this operation does not create a persistent layout constraint. The ordinary generation layout strategies remain unchanged. This reference does not provide show/hide, lock/unlock, layer reordering, resizing, cross-container movement or a visual preview tool.

Use one reference ID by default. Supply several `anchor_element_ids` only when the user explicitly asks about a group; the program returns their union bounds. Never build a large reference group from the first page of search results.
