# Photographic Persona Portraits

Use this reference when photographic avatars are requested. First match each saved persona against the official avatar library with `assign_persona_portraits`; use the product Agent's `generate_images` tool only for personas the library cannot cover. Portraits represent fictional adults; retain the visible AI-simulated-persona disclosure. They are not photographs of interview participants and never count as evidence.

Step 1 is always `assign_persona_portraits` for the whole saved panel, right after `save_personas`. Do not write generation prompts or call `generate_images` before its result is printed; the sections after the library section apply only to the personas it leaves unresolved.

## Match From the Official Library First

`assign_persona_portraits` picks a suitable avatar from the official library of fictional adults and binds it to each saved persona. It costs no image generation. Call it once for the whole saved panel, after `save_personas`.

Fill each request only from facts in the saved persona; omit everything unknown.

| Field | Use |
|---|---|
| `age` | Known adult age. Under 18 is not supported. |
| `gender` | `masculine`, `feminine`, or `neutral`, only when the persona states it. Never infer it from a name. |
| `country` | ISO 3166-1 alpha-2 country the persona lives in. This is a scene and appearance context, not a claim about citizenship. |
| `industry` | The persona's own industry as one ISIC Rev.5 section code (below). Choose the closest section; omit it when none fits. Never rewrite the persona to fit the library. |
| `hair`, `facial_hair`, `accessories` | Only when the persona explicitly describes them. Personality and opinions never decide a face. |

ISIC Rev.5 sections: A agriculture, forestry and fishing; B mining; C manufacturing; D electricity and gas; E water, waste and remediation; F construction; G wholesale and retail trade; H transportation and storage; I accommodation and food service; J publishing, broadcasting and content production; K telecommunications, programming, computing and information services; L finance and insurance; M real estate; N professional, scientific and technical activities; O administrative and support services; P public administration; Q education; R human health and social work; S arts, sports and recreation; T other services (for example hair salons and repair shops); U households as employers; V extraterritorial organizations. Example: the owner of a small noodle shop is `I`; a primary school teacher is `Q`.

Read each result's `match`:

- `exact`: the country and industry you supplied both matched.
- `family`: the industry fell back to a similar work setting. Acceptable.
- `generic`: only gender and age matched, or you supplied neither country nor industry. It is usable; do not describe it as a precise match. Consider generation only when the user wants a closer fit and has authorized the image cost.
- `no_match` or `unavailable`: keep the existing avatar or SVG fallback. A missing library is not a reason to generate automatically. Running out of unused suitable avatars (`no_match`, "already used by another persona") is a coverage gap; generate for that persona only within the user's authorized image budget.

Existing portraits are reused. No two personas in the workspace may share an avatar: `assign_persona_portraits` and `attach_persona_portrait` both refuse an image that another persona already uses, so the tools guarantee distinct faces. Avatars that the library flags as lookalikes of each other are treated as one: using one excludes the rest. When the library has no unused suitable avatar left, the result is `no_match` with an explanation; that persona keeps its fallback unless you generate one for it. Unmet preferences are listed in `unmet` so you can tell the user what was approximated.

```python
from sdk.tool import tool

matched = tool.call("assign_persona_portraits", {
    "requests": [
        {"persona_id": "<saved persona id>", "age": 34, "gender": "feminine", "country": "CN", "industry": "C"},
    ],
})
print(matched.content)
```

## Only for Gaps: Choose From the Persona, Not a Fixed Look

After saving the panel with `save_personas`, read each saved persona's demographics, everyday situation, and explicitly stated preferences. Use known age and gender presentation; do not infer either from a name. A region does not establish ethnicity. When appearance is unspecified, keep it an acknowledged fictional design choice rather than adding it to the persona's facts. This brief covers adults; do not invent an adult age for a persona described as a minor.

All three directions below are valid in one panel. Choose the background, clothing, expression, and camera treatment to suit the person's everyday situation. Do not assign directions mechanically by age, gender, occupation, wealth, or research segment. Avoid turning all business owners into executives in suits or making older people uniformly solemn.

| Direction | Visual brief | Useful when |
|---|---|---|
| A: Everyday social profile | A believable photo taken by a friend on a phone; relaxed angle, ordinary clothing, a quiet home, cafe, or courtyard background; natural daylight and modest depth of field | The profile describes informal daily routines, or no particular photography preference is known |
| B: Bright everyday moment | A relaxed head-and-shoulders photo outdoors in soft morning light; a simple leafy or pale-building background; an unforced smile and fresh, accurate colors | An outdoor or social setting fits the person's stated routine; do not require it for a particular age or gender |
| C: Simple editorial portrait | Pale neutral background, clean diffuse light, relaxed shoulders, an individual expression, everyday cotton or linen clothing; no corporate staging | A quieter, uncluttered composition fits the person or the user wants a simple profile picture |

Keep the collection coherent through natural skin, restrained color, readable faces, and compatible framing. Coherence does not require identical backdrops, head tilts, smiles, clothing, or facial features. Different people must look distinct without caricature. Do not turn opinions, skepticism, willingness to pay, or personality labels into facial expressions.

## Reusable Prompt

Compose the actual prompt in the user's language, as required by `generate_images`. Replace the bracketed brief fields with known facts or a clearly fictional visual choice. Omit irrelevant or unknown details rather than printing empty fields. The English text below is the reusable specification, not a requirement to send an English prompt to a Chinese-language session.

```text
Create one square photographic avatar of one entirely fictional adult AI research persona.

Person: [known adult age or age range and gender presentation, if supplied].
Everyday context: [a short non-identifying situation from the saved persona].
Visual direction: [A, B, or C, expressed as a concrete photographic brief].
Scene and clothing: [ordinary setting and clothing consistent with that context].
Expression and pose: [one natural, comfortable choice; vary it across people].

Show the complete head, hair, and upper shoulders with clear margins for a circular crop.
Keep the face near the center and about half of the square's width. Eyes and facial
features must remain clear at small avatar size. Use soft natural-looking light,
accurate skin tones, realistic age-appropriate texture, and restrained color grading.
Make this a believable personal profile photo with individual human features.

No corporate glamour, mandatory suits, exaggerated business staging, fashion-model
casting, heavy makeup, beauty filters, waxy skin, aggressive sharpening, dramatic
cinematic lighting, exaggerated flaws, text, logos, watermarks, borders, collages,
or multiple people. Do not resemble a named real person or recreate an uploaded
participant's identity. This is a fictional visual representation, not evidence.
```

For A, describe realistic phone-camera perspective and a lightly informal composition rather than a cinematic lens. For B, keep outdoor light soft and the background quiet rather than bright blown-out highlights. For C, preserve a relaxed expression rather than a rigid ID-photo pose. These are directions to adapt, not three mandatory presets or a rule to generate three versions per person.

## Generate, Inspect, and Reuse

Generate only for personas that `assign_persona_portraits` left unresolved or that the user wants closer to a stated appearance.

1. Reuse a suitable portrait already delivered for the same persona ID. Changing the research question, interview round, display name, or report style alone does not require a new face. A requested appearance change may justify regeneration; do not replace an existing usable image silently.
2. Before an initial batch, state how many portraits will be generated and the expected image cost under the deployment's normal media-generation rules. Generate only when this deliverable is authorized; research-plan approval alone is not approval for unmentioned image costs. Do not exceed the selected panel size or the study's persona limit.
3. Use `generate_images` with one task per person, never a contact sheet, in batches of at most 5 tasks (the tool limit). Set `prompt`, `name`, `output_path`, and a square `size` supported by the current session's image-model information. Use a descriptive localized file stem and save under a localized working directory. After inspection, bind the successful output with `attach_persona_portrait`; the tool stores a project-level 320px WebP under `personas/portraits/<persona_id>/`, so deleting a study does not remove a reused person's image. Read the tool's current schema rather than inventing model options or a response field.
4. Send only the non-identifying visual brief. Do not send raw interviews, private customer details, evidence quotations, or hypothesis verdicts to the image tool. Use text-only generation for fictional identity; an identifiable person's photo is not needed as a face reference. If the user supplies such an image, explain the conflict rather than silently forwarding it or ignoring it.
5. Inspect the actual returned images: one adult per file, appropriate age presentation, no malformed face or glasses, no duplicate-looking faces, a clear circular crop, readable features at roughly 32-48 CSS pixels, and natural texture. Link accepted files using the exact successful output paths reported by the tool. A successful request alone does not establish visual quality; if inspection is unavailable, say the images are unreviewed.
6. For every accepted image, call `attach_persona_portrait` with `persona_id` and the exact successful `image_path`. Read `result.content`; a generated file without successful attachment is not an installed avatar. Use `replace: true` only for a user-requested appearance change. Reused personas keep their existing portrait by default.
7. Keep successful images when a batch partly fails. Report which personas have no accepted portrait and retain their existing fallback; do not automatically retry a paid batch. Reuse the accepted file in every output that supports it. Regenerate a rejected portrait only within the user's image-generation authorization.

## Binding and Report Integration

The optional `portrait` field is maintained only by `attach_persona_portrait`. Do not write it with file tools or invent an `avatar_url`. Old personas without this field keep their existing SVG fallback. The research list, interviews, tool cards, and share views resolve the same bound project image through the existing file access layer; images hidden by share permissions remain on the fallback.

After writing `studies/<slug>/report.html`, send the existing `update_study` event `report_written`; it automatically synchronizes the portraits, so a separate embedding call is unnecessary. The embedding step reads the panel and bound persona files and embeds the same small WebP images as a portable snapshot; it never generates new portraits or stores signed URLs. It preserves the template SVGs underneath, along with the AI-simulation disclosure and citation scripts. Missing or failed portraits keep the SVG. Keep `data-persona` on every portrait element and set `data-persona-id` to the saved persona ID, especially for namesakes; do not infer identity from a name. Custom templates with no persona elements get no invented image slots. The embedding tool also works on older copies of the default template.

If a user explicitly replaces a portrait, rerun embedding for the report they want updated; do not rewrite unrelated historical reports. Portrait generation is separate from decorative report images and does not consume or expand their four-image allowance. Keep the visible AI-simulated-persona wording, including on photo-style portraits. Generation, attachment, or embedding failure must not stop the research or hide the remaining deliverables.

```python
from sdk.tool import tool

attached = tool.call("attach_persona_portrait", {
    "persona_id": "<saved persona id>",
    "image_path": "<exact successful generate_images output path>",
})
print(attached.content)

# To refresh a chosen existing report after a requested portrait replacement:
embedded = tool.call("embed_persona_portraits", {"study_dir": "studies/<slug>"})
print(embedded.content)
```

Repository LFS rules apply if developers check images into source control, not to ordinary Agent-generated user workspace files. Never commit these runtime portraits or use their visual realism to claim a real interview occurred.
