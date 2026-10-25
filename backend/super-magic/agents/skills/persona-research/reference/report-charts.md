# Report Charts and Data Tables

Decide whether the study's data warrants a chart, and which kind, before writing `report.html`. Prose is the default. A report with no chart is correct when no chart would show something the text does not; never add one for decoration. Draw each chart from `synthesis.json`, `desk-research.md`, or the transcripts by code, never by retyping values.

## Choose by the data's job

| The reader needs to see | Use | Draw it when | Data |
|---|---|---|---|
| Who stands where on each theme, and where the panel disagrees | Stance matrix (themes x personas, grouped by segment) | At least 4 themes and at least 4 interviewed personas. With fewer, the prose is already short | `themes[].stance_by_persona`, `segments`, `confidence` |
| How segments differ on the same factors | Level table (factors x segments) | `dimensions` is not empty | `dimensions[].level_by_segment` |
| What numbers respondents gave for one question (price, frequency, days) | Range strip: one dot per person, no mean | At least 3 personas gave a number in the same unit, each number found in a quote that `quote_refs` can locate | the quotes |
| What outside sources say about one measure | Benchmark table with `[S#]` in every row | At least 2 desk-research sources give the same measure | `desk-research.md` |
| Classification by segment under a framework | Framework table (KANO class per feature and segment; journey stage, pain, drop-off) | `framework` is KANO or user journey | transcripts |
| Whether new interviews keep adding themes | Saturation bars | At least 4 completed interviews | `saturation.new_themes_per_interview` |
| AI vs. real-person agreement | The comparison table in the template | `validation_compared` has happened | `validation-results.json` |

At most 3 charts or tables besides the stance matrix. Skip any that fail the "Draw it when" test, and do not substitute a different chart for a failed test.

## Rules that keep the chart honest

- A cell or dot is one AI-simulated respondent. Never draw percentages, shares, pie slices, stacked totals, an average, or a median, and never show a count of personas per stance. The legend lists meanings only. AI samples do not support statistical inference.
- `not_mentioned` is shown as its own symbol and legend entry, never left out and never counted as agreement. When `homogeneity.warning` is true, say beside the matrix that many themes are unanimous and that this more likely reflects model homogeneity than strong evidence.
- Do not rely on color alone: the stance matrix pairs each color with a symbol (support, oppose, mixed, not mentioned).
- Numbers respondents gave are willingness-to-pay style evidence: label the figure "AI-simulated, pending real-person validation", draw ranges only, show only numbers the respondent said (never your conversion of a price into another unit), and repeat the pricing warning from methods.md. Say what each person anchored on; answers anchored on different things are not comparable and are never averaged.
- Outside numbers (benchmark table) never share a chart with respondent numbers. Every row carries its `[S#]`.
- Every figure ends with a caption explaining what a mark means and an evidence bar following report-templates.md and report-writing.md: cite the data actually drawn and label interviews, sources or inference in plain words; state real-person status only after real answers have been compared. Do not repeat whole-study totals as support for the chart.
- Place charts inside `findings` (or `hypotheses` when the chart serves one hypothesis). Do not insert them into `summary`.
- A chart never carries a claim the text does not state; the text still cites `[Q#]` and `[S#]`.

## Drawing it

Charts are self-contained HTML fragments: inline `<style>` with the `pr-chart-` class prefix, inline SVG, no scripts, no chart library, so they render in every template, in older project copies of `templates/voices.html`, and in print. Generate the fragment in Code Mode and paste it into the report; print only a short check (rows and columns drawn), not the fragment.

```python
import html, json

STANCE = {"support": ("✓", "support"), "oppose": ("✕", "oppose"), "mixed": ("~", "mixed"), "not_mentioned": ("·", "not mentioned")}
CONFIDENCE = {"high": "high", "medium": "medium", "low": "low", "to_validate": "to validate"}  # translate labels into the user's language
STYLE = """<style>
.pr-chart-wrap{overflow-x:auto}.pr-chart-matrix{border-collapse:collapse;width:100%;font-size:13px}
.pr-chart-matrix th,.pr-chart-matrix td{padding:6px 8px;border-bottom:1px solid #ece9e5;text-align:center}
.pr-chart-matrix th{font-weight:500;color:#9a938c;font-size:12px}.pr-chart-matrix .pr-chart-theme{text-align:left;min-width:200px}
.pr-chart-cell{display:inline-flex;width:26px;height:26px;border-radius:7px;align-items:center;justify-content:center;font-weight:700}
.pr-chart-support{background:#e7f2ec;color:#2e7a57}.pr-chart-oppose{background:#f8e9e7;color:#b24a44}
.pr-chart-mixed{background:#f7efdf;color:#a8741a}.pr-chart-not_mentioned{background:#faf9f7;color:#9a938c}
.pr-chart-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:#5e5852;margin-top:8px}
</style>"""


def stance_matrix(synthesis, names, labels, confidence_labels=CONFIDENCE):
    """names: persona_id -> display name; labels: stance value -> label in the user's language."""
    columns = []
    for segment in synthesis["segments"]:
        ids = [pid for pid in segment["persona_ids"] if any(pid in t["stance_by_persona"] for t in synthesis["themes"])]
        columns.append((segment["name"], ids))
    head_seg = "".join(f'<th colspan="{len(ids)}">{html.escape(name)}</th>' for name, ids in columns if ids)
    head_people = "".join(f"<th>{html.escape(names.get(pid, pid))}</th>" for _, ids in columns for pid in ids)
    rows = []
    for theme in synthesis["themes"]:
        cells = ""
        for _, ids in columns:
            for pid in ids:
                stance = theme["stance_by_persona"].get(pid, "not_mentioned")
                symbol, _ = STANCE[stance]
                cells += f'<td><span class="pr-chart-cell pr-chart-{stance}" title="{html.escape(names.get(pid, pid))}: {html.escape(labels[stance])}">{symbol}</span></td>'
        confidence = html.escape(confidence_labels[theme["confidence"]])
        rows.append(f'<tr><td class="pr-chart-theme">{html.escape(theme["name"])}</td>{cells}<td>{confidence}</td></tr>')
    legend = "".join(f'<span><span class="pr-chart-cell pr-chart-{key}" style="width:18px;height:18px;font-size:11px">{STANCE[key][0]}</span> {html.escape(labels[key])}</span>' for key in STANCE)
    return (
        f'{STYLE}<div class="pr-chart-wrap"><table class="pr-chart-matrix"><thead>'
        f'<tr><th></th>{head_seg}<th></th></tr><tr><th class="pr-chart-theme"></th>{head_people}<th></th></tr></thead>'
        f'<tbody>{"".join(rows)}</tbody></table></div><div class="pr-chart-legend">{legend}</div>'
    )


def range_strip(points, low, high, unit, width=760):
    """points: [{"label": "Name 30 · what they anchored on", "value": 30}], one per person; low/high are the axis ends."""
    span = high - low
    def x(value):
        return 40 + (value - low) / span * (width - 80)
    ordered = sorted(points, key=lambda p: p["value"])
    dots = ""
    for index, point in enumerate(ordered):
        label_y = 82 if index % 2 == 0 else 58  # alternate rows so neighbouring labels do not collide
        dots += (
            f'<circle cx="{x(point["value"]):.1f}" cy="100" r="6" fill="#2f4a7a"/>'
            f'<text x="{x(point["value"]):.1f}" y="{label_y}" font-size="11" fill="#5e5852" text-anchor="middle">{html.escape(point["label"])}</text>'
        )
    ticks = "".join(
        f'<text x="{x(low + span * i / 4):.1f}" y="130" font-size="11" fill="#9a938c" text-anchor="middle">{low + span * i / 4:g}{html.escape(unit) if i == 4 else ""}</text>'
        for i in range(5)
    )
    return f'<svg viewBox="0 0 {width} 140" width="100%" role="img"><line x1="40" y1="100" x2="{width - 40}" y2="100" stroke="#ece9e5"/>{dots}{ticks}</svg>'
```

Calling them: read `synthesis.json`, build `names` from `personas/<id>.json` `name` for every persona id in the stances, translate `labels` and `confidence_labels` into the user's language, and print the fragment's row and column counts to check against `synthesis.json`. For the strip, give each point's label the speaker's name, the number, and what they anchored on, and add a `[Q#]` link in the caption.

For the level, benchmark, and framework tables, write plain `<table>` markup from the same sources with the report template's table classes.
