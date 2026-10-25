# Prompt library search

Load this reference only when the user explicitly asks for prompt inspiration or says they have no idea — e.g. "help me find some inspiration", "I have no prompt ideas", "give me some references", "I need some ideas". It never widens the parent skill's retry, deletion, or direct file-operation boundaries.

The `search_canvas_image_prompts` tool provides access to 1300+ curated AI image prompts from the nanobanana library, ranked by real-world engagement (likes + views).

## When to use — trigger condition

Only on an explicit inspiration request. Do not trigger proactively when the user provides a subject but no style details.

1. Call `search_canvas_image_prompts` with a query that reflects the user's intent and scene type.
2. Read the results and derive 3–5 distinct prompt options, each adapted to the user's subject.
3. Present the options in the user's language and ask them to pick one or say what to adjust.
4. Generate only after the user confirms a direction.

## When not to use

- The user provides a specific, detailed prompt — use it directly.
- The request is clear enough to construct a complete prompt from first principles.

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `query` | Yes | Keyword search across prompt text, author, and categories |
| `category` | No | `Photography`, `Product & Brand`, `Girl`, `Food & Drink`, `Illustration & 3D`, `App`, `JSON`, `Other` |
| `sort_by` | No | `rank` (default), `likes`, `views`, `date` |
| `limit` | No | Number of results, default 5, max 20 |
| `offset` | No | Pagination offset |
| `random` | No | Set `true` for open-ended inspiration browsing |

```python
from sdk.tool import tool

result = tool.call("search_canvas_image_prompts", {
    "query": "product storyboard",
    "category": "Product & Brand",
    "limit": 5,
})
print(result.content)
```

## Deriving options from results

Library prompts are structural references, not templates to copy verbatim. For each option you present:

- Take the structural pattern and technical vocabulary from a high-ranking result.
- Substitute the user's actual subject, scene, and any constraints they mentioned.
- Give each option a short label so the user can refer to it (e.g. "Option A — studio grid storyboard", "Option B — lifestyle editorial").

After the user picks, apply the prompt-engineering principles in `references/image-generation.md` before generating.
