# Template Taxonomy

The live catalog from `query_slide_template_taxonomy` is authoritative. `template-taxonomy.json` is only a fallback snapshot when the backend is unavailable. Do not read the JSON file, and do not print every tag into model context.

`content` is a short index of categories and tag groups. Full tags are in `result.data`. Inspect the source first, then list only the groups this template needs, and pick exact codes by meaning. Do not substring-search names. Never `print(catalog.data)`.

Match the actual template, not words:

- Category follows audience, use case, and the decision this deck supports. An AI-assistant training course is `PPT-CATE-education-training`, not a technology category just because "AI" appears.
- Purpose follows what the reusable template is for. Training course, quarterly review, and product launch are different purposes even when the filename shares a word.
- Style, color, layout, and mood follow what the source pages show: palette, type, surface, recurring structure. A cover page is not a layout tag; do not search `封面` or `cover`.
- Language follows the intended sample copy.
- Add industry or audience tags only when the template clearly targets that domain. Do not copy `industry-education-training` just because the category is education.

```python
from sdk.tool import tool

catalog = tool.call("query_slide_template_taxonomy")
if not catalog.ok:
    raise SystemExit(catalog.content)
print(catalog.content)

needed = {
    "purpose_group",
    "style_group",
    "color_group",
    "layout_group",
    "mood_group",
    "language_group",
}
for group in catalog.data["groups"]:
    if group["code"] not in needed:
        continue
    print(f"\n{group['code']}\t{group['zh']}")
    for tag in group["tags"]:
        print(f"{tag['code']}\t{tag['zh']}")
```

Read those names against the source, then copy exact codes into `create_slide_template_project`. Create and finalize validate against the same live catalog.

## Selection rules

1. Choose one category matching this template's primary audience, use case, and decision. `scene-routing.md` is only a hint.
2. Choose 4–10 tags that describe visible or intended template characteristics.
3. Usually include one purpose tag, one or two style tags, one color tag, one or two layout tags, one mood tag, and one language tag.
4. Add industry and audience/scene tags only when the template clearly targets them.
5. Use the most specific supported tag. Do not add near-synonyms only to increase tag count.
6. Do not add `featured`; it is an operational publishing decision.

To refresh the fallback snapshot from updated source files, maintainers may run:

```bash
python3 scripts/template_taxonomy.py sync \
  --categories /path/to/slides-template-categories.json \
  --tags /path/to/slides-template-tags.json
```
