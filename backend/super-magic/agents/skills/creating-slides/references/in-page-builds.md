# In-slide builds

Use when the user requests click-controlled reveals in the online presentation player, or
proactively under the "Proactive use" rules below.
Keep the slide static: do not add animation CSS, scripts, timers, or navigation listeners.
The player executes these declarations during presentation; reading, thumbnails, standalone
HTML and exports show the full page. Do not promise native PowerPoint animations.

Add `data-ppt-step` (and optionally `data-ppt-effect`) to an existing source HTML element or
content container:

```html
<div data-ppt-step="1">First point</div>
<div data-ppt-step="2" data-ppt-effect="appear">Second point</div>
```

- `data-ppt-step` must be an integer from 1 to 1000.
- `data-ppt-effect` is `appear` or `fade` (250 ms, reduced motion uses appear); omit it for `fade`.
- `data-ppt-after` (optional, integer milliseconds 0 to 60000) makes a step play by itself that
  long after the previous step has finished (the first step: after the page appears) instead of
  waiting for a click. Use it only when the user asks for automatic or timed steps, and put the
  same value on every element of that step. Going back stops the automatic chain until the next
  click.
- Equal step numbers appear together. Numbers sort ascending; gaps do not create empty steps.
- Elements without the attribute remain visible. Remove both attributes to remove the build.
- A container and its descendants may both be configured. The container reveals its whole
  content at its step; a configured descendant stays hidden until its own step and the
  container's step have both been reached. Give a descendant a step later than its container's
  to stage content inside it; an earlier or equal step just shows with the container.
- Do not configure html/body, document metadata, scripts, styles, SVG internals or generated DOM.
- Preserve attributes on surviving elements during edits. Whole-page regeneration may replace
  those elements: explicitly report any build settings that cannot be preserved.
- Forward reveals the next group before changing page. Backward hides the most recent group;
  at step zero it returns to the previous visible page with that page fully revealed.
- Direct jumps start the target at step zero. Step progress is not saved to the file.

Use the existing slide creation and localized editing workflows. Do not create sidecar files,
change page order, split builds into extra slides, or modify page transition metadata.

## Proactive use

Builds are optional. The default is no builds, and a page without them is always fine. They
exist mainly to present several substantial content blocks one at a time (distinct sections,
panels, cards or phases that each carry their own body of content and that a presenter would
speak to separately).

- Do not use them for short material: a few lines of text, bullet lists, a handful of short
  items, table rows, or single-sentence points. Also skip covers, section dividers, ending
  pages, single-block pages, dense charts, and image-only pages.
- Follow the user's habit first. If a remembered preference exists (always add, never add, or
  ask each time), apply it without asking again. When file memory or a user profile is
  available, record the user's answer as that preference; otherwise honor what they said in
  the current conversation only.
- With no known preference, either add builds yourself in a clear case (three or more
  substantial blocks on one page), or offer them at a natural moment, for example together with
  other confirmations or in the delivery summary ("pages 3 and 5 could reveal block by block;
  want that?"). Never stop generation just to ask about builds, and ask at most once per task.
- Original animation wins. Do not add a build to an element that has its own animation or
  transition (CSS `animation`, `transition`-driven entrance, keyframe or animate-style
  classes, SMIL), or whose ancestor or descendant does. If a page already relies on element
  animations to reveal its content, leave that page without builds.
- Keep the page title and its context visible; reveal only the content blocks. Use 2 to 6
  steps per page, numbered consecutively from 1, and group blocks that belong together under
  the same step. Only nest builds when you want to stage content inside a revealed container,
  and give nested items later steps than their container.
- Attributes must be exactly `data-ppt-step` (integer 1 to 1000) and optionally
  `data-ppt-effect` (`appear` or `fade`) on elements that exist in the source HTML. Do not
  invent other attributes, values, versions, classes or wrapper elements, and do not edit the
  slide just to host a build. After writing, re-read the file and confirm every value is valid.
- Never change builds the user already configured. When editing or regenerating a page,
  preserve existing attributes.
- Tell the user briefly which pages received steps and that they can adjust or remove them
  in the page's in-slide animation panel, or ask you to change them.
