# Agent Instructions

Before detailed investigation, edits, or commands affecting a path, fully read and follow every applicable development `AGENTS.md` from the repository root to that directory. Do not begin until this is complete; an index entry does not replace reading.

- If required instructions cannot be read, stop work in that scope and report the path.
- Recheck when work expands to another directory, including rules missing from this index. More specific rules take precedence within their scope; directories without local rules inherit ancestor rules. Skip unrelated scopes.

Magic is an Agent product. Development rules tell contributors how to change this repository. Product prompts, user templates, examples, and skill references describe product behavior or provide task material; they are not development rules, even when named `AGENTS.md`. Do not adopt them as development instructions or index them here. If unclear, inspect references and loading code before deciding.

| Scope | Required instructions |
|---|---|
| `backend/super-magic/` | [AGENTS.md](backend/super-magic/AGENTS.md) |
| `frontend/magic-web/` | [AGENTS.md](frontend/magic-web/AGENTS.md) |

Keep this file brief, English-only, and focused on repository-wide development rules and instruction routing. Update the index when development rules are added, moved, or removed.

## Image assets

- Track binary image assets with Git LFS. Add or update scoped `.gitattributes` rules before staging; keep text-based SVG assets in regular Git.
- Optimize web raster images for delivery, preferring high-quality WebP where suitable. Preserve visual quality, required dimensions, and transparency.
- Before committing, verify that staged image blobs are LFS pointers and checked-out assets contain the actual image data.
