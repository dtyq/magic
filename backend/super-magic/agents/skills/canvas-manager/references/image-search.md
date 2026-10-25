# Image search

Load this reference only when the user asks to search for external image candidates and import them into the Canvas.

## search_canvas_image_candidates

Search, download, validate, and import image candidates as imported Image Content.

| Parameter | Required | Description |
|---|---|---|
| `project_path` | Yes | Project path |
| `topic_id` | Yes | Topic key; the same topic deduplicates by source URL |
| `tasks` | Yes | Each item: `item_ref`, `name`, `query` required; `requirement_explanation`, `expected_aspect_ratio`, `count` optional |

```python
tool.call("search_canvas_image_candidates", {
    "project_path": "Demo",
    "topic_id": "product-hero",
    "tasks": [{
        "item_ref": "hero-candidates",
        "name": "Product hero candidates",
        "query": "premium product studio photography",
        "expected_aspect_ratio": "16:9",
        "count": 3,
    }],
})
```

Only successfully downloaded and validated candidates become imported Image Content. Results may be partial; keep successful Elements and report failed items with the external reason when available. A partial batch is not a Canvas-wide failure, and a failed external candidate is not evidence that successful imports are invalid. Retry only a failed item after the user asks, not the whole batch.

After import, use the exact returned `element_id` for `query_canvas_element_details` and verify the imported Content's `content_type`, status, and project-local media path. Do not infer the Element from the candidate name, source URL, array position, or the local `images/` directory. Only after this verification may the image be used as a generation reference or Connection endpoint.
