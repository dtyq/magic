# Legacy Migration

## When to Trigger

If the workspace contains micro-apps using the **old path convention** (`.magic/<name>/SKILL.md` instead of `.magic/skills/<name>/SKILL.md`), automatically migrate before proceeding with any new work.

**Detection heuristic:** If a directory under `.magic/` contains a `SKILL.md` and is NOT named `skills`, it's a legacy skill directory that needs migration.

---

## Migration Steps

1. **Detect** — check if `.magic/` contains skill directories directly (not under `skills/`)
2. **Move** — relocate `.magic/<name>/SKILL.md` → `.magic/skills/<name>/SKILL.md` (preserve any `references/` subdirectory too)
3. **Update references** — fix all `file_path` values in HTML files that reference the old path
4. **Notify user** — briefly inform what was migrated

---

## Example

```javascript
// Old path in HTML that needs updating:
// Before:
data: { file_id: "skill_ref", file_name: "SKILL.md", file_path: ".magic/report_writer/SKILL.md", file_extension: "md" }

// After:
data: { file_id: "skill_ref", file_name: "SKILL.md", file_path: ".magic/skills/report_writer/SKILL.md", file_extension: "md" }
```

---

## File System Operations

```bash
# For each legacy skill directory found:
# 1. Create skills/ if not exists
mkdir -p .magic/skills/

# 2. Move each legacy skill directory
mv .magic/<name>/ .magic/skills/<name>/

# 3. Search and replace in all HTML files
# Old: .magic/<name>/SKILL.md
# New: .magic/skills/<name>/SKILL.md
```

---

## Edge Cases

- If `.magic/skills/<name>/` already exists (collision), **do not overwrite** — ask user which version to keep
- If the legacy directory contains files other than `SKILL.md` and `references/`, move them all
- If HTML files reference the skill via hardcoded strings (not in tiptap JSON), also update those
- Preserve the `name` field inside `SKILL.md` frontmatter — it should still match the directory name (no change needed since only the parent path changes)
