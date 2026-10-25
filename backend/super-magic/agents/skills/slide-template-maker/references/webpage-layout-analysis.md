# Webpage layout analysis

`analysis_slide_webpage` is Code Mode only. Use it for layout QA on local HTML or a
remote webpage, through `sdk.tool.call` inside `run_sdk_snippet`. It checks DOM geometry
and asks the configured model for repair suggestions; it does not modify the page.
Use `visual_understanding_webpage` separately for visual hierarchy and design judgment.

| Parameter | Required | Meaning |
| --- | --- | --- |
| `target` | Yes | HTML file path relative to the workspace, or a remote webpage URL. |
| `max_width` | Yes | Positive declared canvas width in pixels; also the browser viewport width. |
| `max_height` | Yes | Positive declared canvas height in pixels; also the browser viewport height. |
| `top_elements_offset` | No | Zero-based offset into the main-layout-element list, default `0`. |
| `top_elements_limit` | No | Number of main layout elements to include, default `10`, range `5`–`20`. |

Read the template's declared canvas instead of assuming every source is 1920 × 1080.
Pagination controls the main-layout-element list in the report; it is not page navigation.
For more layout elements, make another call with the next offset and inspect its content.

```python
from sdk.tool import tool

result = tool.call("analysis_slide_webpage", {
    "target": "quarterly-template/slides/cover.html",
    "max_width": 1920,
    "max_height": 1080,
    "top_elements_offset": 0,
    "top_elements_limit": 10
})
print(result.content)
```

The returned `content` is a readable analysis and repair report. There is no structured
`result.data` contract or issue-count field to consume. `ok=True` means analysis completed,
not that the page has no defects. Read the findings before claiming QA passed.

Issue categories include canvas and parent overflow, clipping, horizontal/vertical
scrollbars, failed images, distorted aspect ratios, and significantly cut-off image content.
Fix the reported defects and analyze again. Keep visual inspection as a separate check.

`ok=False` can mean a missing local file, unavailable browser page, empty analysis, or
another analysis failure. Print its content, verify the target and declared dimensions,
then resolve the reported blocker. Do not substitute an invented report or call a failed
check a pass. This tool provides evidence for template QA; it does not replace the
template workflow's required finalization or published preview checks.
