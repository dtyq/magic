---
name: dual-edition-module-migration
description: Migrate modules between shared `src/opensource/` code and enterprise overlays under `enterprise/src/opensource/`, while preserving the `src/opensource` boundary and existing component override points.
---

# Dual Edition Module Migration

## When to apply

- A module must exist in both open-source and enterprise editions
- The user mentions `src/opensource`, `enterprise/`, Vite overlay, or edition-specific behavior
- A shared module needs to stay under `src/opensource/...`, but enterprise behavior must override it
- Old `src/variant/...` or `src/opensource/variant/...` facades need to be removed
- A migration must preserve the `src/opensource` import boundary

## Core invariants

### 1. `src/opensource` is the shared source of truth

- Code under `src/opensource/` is the default implementation
- `src/opensource/` must not import commercial code
- If open-source needs a dependency, migrate that dependency too or degrade the feature
- If a file under `src/opensource/` or `enterprise/src/opensource/` imports a module outside the `opensource` tree, move that dependency into the current `opensource` closure instead of keeping a shim
- Do not pull private infrastructure such as `keewoodClient` or `teamshareClient` into `src/opensource`

### 2. `enterprise/` is an overlay, not a second app

- Keep the same relative path under `enterprise/` as the shared file under `src/`
- Runtime resolution priority is `enterprise/**` first, then `src/**`
- Enterprise files should be as thin as possible
- Prefer a re-export shim in `enterprise/...` when it preserves behavior without duplication
- Do not use re-export shims when the stable caller path is already `@/opensource/...` and the shim would import from outside the `opensource` tree
- If a dependency chain is truly enterprise-only, keep the whole chain in `enterprise/...`
- Do not leave enterprise-only stores or services in `src` just because enterprise files import them
- Do not create an enterprise overlay file that re-imports the same logical `@/opensource/...` path it overrides
- If the stable caller path is `@/opensource/...`, the enterprise implementation must live under `enterprise/src/opensource/...`
- Do not move a dual-edition module into `enterprise/components/...` or another non-mirrored path unless the user explicitly wants a commercial-only module

### 3. Open-source callers should import the real shared path

- Files under `src/opensource/` should import `@/opensource/...` directly
- Do not keep `@/variant/...` in open-source code
- If enterprise needs different behavior for that shared path, add an overlay file under `enterprise/src/opensource/...`

### 4. Choose extension point by artifact type

Use this rule first:

| Artifact                                                       | Preferred mechanism                                                                                                                                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React view/component rendered through factory                  | `ComponentFactory` default in `src/opensource` plus enterprise or premium override where still needed                                                             |
| Hook / service / preload helper imported from open-source code | Direct `@/opensource/...` import plus `enterprise/src/opensource/...` overlay when behavior differs                                                               |
| Shared implementation used by both editions                    | Move to `src/opensource/...`; if callers already target `@/opensource/...`, migrate the real code and delete the old file instead of leaving a compatibility shim |
| Legacy `src/components/...` module becoming dual-edition       | Migrate to `src/opensource/...` plus mirrored `enterprise/src/opensource/...`; then switch callers to `@/opensource/...`                                          |
| Runtime-only indirection                                       | `src/runtime/<domain>/` only when direct imports and overlay cannot express the binding                                                                           |

## Architecture patterns

### Pattern A: Shared baseline plus enterprise overlay

Use this for hooks, services, helpers, and other non-visual modules.

1. Keep the default implementation in `src/opensource/...`
2. Update callers to import that `@/opensource/...` path directly
3. If enterprise behavior differs, add the same path under `enterprise/src/opensource/...`
4. Let Vite resolve the enterprise file first at runtime
5. Remove the old `variant` facade after callers are switched

Minimal example:

```ts
// src/opensource/components/business/RecordingSummary/hooks/useCancelRecord.tsx
export default function useCancelRecord() {
	// shared implementation
}
```

```ts
// enterprise/src/opensource/components/business/RecordingSummary/hooks/useCancelRecord.tsx
export default function useCancelRecord() {
	// enterprise implementation
}
```

```ts
import useCancelRecord from "@/opensource/components/business/RecordingSummary/hooks/useCancelRecord"
```

### Pattern B: Component override

Use this when a UI component needs edition-specific rendering.

1. Keep the default implementation in `src/opensource/...`
2. Register it in `src/opensource/components/ComponentRender/config/defaultComponents.tsx`
3. Keep commercial-only UI in `src/...` only when it owns real delta
4. Register premium overrides only where the factory still needs explicit component replacement
5. For helper imports such as preload code, prefer direct `@/opensource/...` imports plus enterprise overlay

This keeps render-time switching and non-render imports aligned.

### Pattern B.5: Shared facade plus enterprise child override

Use this when the only edition difference is a small injected block inside a much larger shared page or layout.

Rules:

1. Extract the changing block into the smallest possible shared child component or hook under `src/opensource/...`
2. Keep the shared baseline minimal: `null`, `false`, no-op callback, or another tiny safe fallback
3. Mirror only that child component or hook under `enterprise/src/opensource/...`
4. Update the large shared page or layout to import the stable `@/opensource/...` facade instead of importing commercial modules directly
5. Do **not** override the whole page or layout when a banner, modal, slogan, model tag, or hook is the real variability point

Why:

- It minimizes duplicated page code
- It prevents accidental divergence between editions
- It makes review easier because the commercial delta is isolated to one extension point

Example use cases:

- Activity banner slot in `EmptyWorkspacePanel`
- Activity modal slot in `MainLayout`
- Login slogan slot in `SSOLayout`
- Enterprise-only hook such as `useFreePointsTrigger`

### Pattern C: Temporary enterprise shim over existing commercial file

Use this only as a short-lived transition when a large enterprise implementation already exists under `src/...` and the user has not required a hard `opensource`-only closure.

1. Add `enterprise/src/opensource/<same-path>.ts(x)`
2. Re-export from the existing commercial file under `src/...`
3. Switch all shared callers to `@/opensource/...`
4. Remove `variant` files
5. Later, inline or fold the shim if the codebase is cleaned up further

Do not use this pattern when the user requires `src/opensource/...` and `enterprise/src/opensource/...` to avoid importing any dependency outside the `opensource` tree.

### Pattern D: Enterprise-only dependency closure

Use this when a module and its dependencies only exist for enterprise or App-native behavior.

Rules:

1. Move the whole closure into `enterprise/src/opensource/...`
2. Do not add `src/opensource` stubs for enterprise-only stores or services unless the user explicitly wants a temporary bridge
3. Update enterprise callers to use the stable `@/opensource/...` path, so overlay resolves the real file
4. Delete the old `src/...` files once imports are switched

Example closure:

- `stores/recordingSummary/appNative.ts`
- `services/recordSummaryAppNativeService/**`
- `services/AppAIRecordingService/**`

Why:

- Leaving half the chain in `src` recreates the old boundary violation
- Enterprise-only dependencies should not look shared just because shared callers reference the logical path

### Pattern E: Enterprise-only module with open-source stub

Use when a hook or component is moved entirely to `enterprise/src/opensource/...`, but `src/opensource` callers still import it (e.g. overlay disabled, or callers exist in both editions).

Rules:

1. Keep a **stub** in `src/opensource/...` at the same logical path
2. Stub returns no-op values: empty array for lists, `false` for flags, `() => {}` for callbacks, `null` for ReactNode
3. Stub must match the enterprise interface exactly so all callers work without changes
4. Enterprise overlay provides the full implementation when overlay is enabled

Stub minimization rules:

1. Keep only the smallest surface that current open-source callers actually import
2. Do not copy enterprise-only helper files, upload types, or private dependency adapters into `src/opensource/...` if the stub does not use them
3. Prefer flattening a stub to one file when the open-source side only needs a no-op export plus one or two lightweight enums or helpers
4. If a helper already exists globally, reuse it instead of creating a module-local duplicate in the stub

Example:

```ts
// src/opensource/.../useCollaboratorUpdatePanel.tsx (stub)
function useCollaboratorUpdatePanel({ selectedProject: _sp, onClose: _onClose }) {
	return {
		collaborators: [],
		collaborationInfo: { is_collaboration_enabled: false, default_join_permission: "viewer" },
		openManageModal: () => {},
		CollaboratorUpdatePanel: null,
	}
}
```

```ts
// enterprise/src/opensource/.../useCollaboratorUpdatePanel.tsx (full impl)
// Full implementation with CollaborationManageModal, useCollaborationManageData, etc.
```

### Pattern F: Optional runtime facade

Use only when direct imports plus overlay are still not enough.

Rules:

1. Create `src/runtime/<domain>/`
2. Export a stable runtime API from that layer
3. Keep `src/opensource/` off that runtime facade unless the user explicitly wants the extra indirection
4. Justify the runtime layer with a real binding problem, not habit

### Enterprise overlay import resolution

When creating an enterprise overlay file (e.g. `enterprise/src/opensource/.../ProjectCardContainer`), relative imports like `../ProjectCard` may fail TypeScript resolution if the target has no enterprise overlay (only partial overlay like `ProjectCardShareSection`).

Rule: use `@/opensource/...` absolute paths for modules that exist only in `src` or have no full enterprise overlay, so resolution falls through to `src` correctly.

## Migration workflow

### 0. Find all importers before migration

Before moving or stubbing a module, run `rg "ModuleName|useModuleName"` (or equivalent) to find every caller.

Rule: each importer must either (a) get the stub when overlay is disabled, or (b) be updated to conditionally use the feature. Missing an importer causes build failures such as `EISDIR` or "module not found".

### 0.5. Choose the final logical path first

Before creating files, decide which import path should survive after migration.

Ask:

- Should callers end up on `@/opensource/...`?
- Is this actually a commercial-only module that should stay under `@/components/...`?
- Does the enterprise implementation need to mirror `src/opensource/...` under `enterprise/src/opensource/...`?

Rule: do not start by copying code into `enterprise/components/...` when the long-term target is a dual-edition `@/opensource/...` path.

### 0.6. Choose the smallest override surface

Before creating any overlay file, ask:

- Is the real delta a whole page, or only one injected child block?
- Can the shared page keep working if that child becomes a `null` or no-op facade?
- Would extracting a shared banner/modal/slogan/tag/hook avoid duplicating the page?

Rule: if the delta is only a small block inside a large shared file, first extract that block into a shared `src/opensource/...` facade and override only that facade in `enterprise/src/opensource/...`.

### 1. Classify the target from first principles

Split the target into:

- Shared baseline
- Enterprise-only delta
- Open-source forbidden dependencies
- UI override points
- Helper or preload entrypoints
- Old `variant` facades that can be removed
- Enterprise-only dependency closures such as native stores and native services

Ask:

- What must exist in both editions?
- What is truly enterprise-only?
- Which imports inside `src/opensource` still point at indirection instead of the real shared file?
- Can Vite overlay solve this directly with a mirrored enterprise path?
- Are there forbidden clients or App-only branches that must stay out of `src/opensource`?

### 2. Keep the baseline in `src/opensource`

- Move or keep the shared implementation in `src/opensource/...`
- Rewrite internal imports to `@/opensource/...`
- If an internal import still points outside `opensource`, migrate that dependency into the same closure or inline the needed code before proceeding
- Remove App-only or enterprise-only branches from the shared copy
- Add safe stubs or degrade behavior instead of importing private clients

### 3. Preserve enterprise deltas with mirrored paths

- Add `enterprise/src/opensource/...` only for real behavior differences
- Prefer thin enterprise shims only when they do not violate the `opensource` boundary
- If the enterprise implementation already lives in `src/...` but callers must stay inside `opensource`, migrate the real implementation or the required subset into the mirrored `enterprise/src/opensource/...` path
- If a dependency chain is enterprise-only, move the full chain instead of splitting it across `src` and `enterprise`

### 4. Remove `variant`

When old code uses `@/variant/...`:

1. Replace each caller with the corresponding `@/opensource/...` import
2. Create `enterprise/src/opensource/...` overlays for any enterprise-only behavior
3. Delete `src/variant/...`
4. Delete `src/opensource/variant/...`

### 5. Verify boundaries

For the migrated domain, check:

- `src/opensource/...` only imports shared-safe dependencies
- No `src/opensource` file imports `@/variant/...`
- Enterprise overrides mirror the shared path under `enterprise/src/opensource/...`
- `src/opensource` still avoids private clients and private infrastructure
- Preload helpers import the same `@/opensource/...` path that runtime code conceptually depends on
- Enterprise-only stores and services do not remain in `src`
- If a shared initializer still needs enterprise-only restore logic, split the initializer:
  shared file keeps shared logic, enterprise overlay re-adds the enterprise branch

### 6. Verify compatibility

- Shared imports still work in open-source mode
- Enterprise runtime resolves overlay files as expected
- Existing explicit component overrides still work if they remain in use
- No leftover imports reference deleted `variant` paths

## Boundary checklist

- [ ] `src/opensource` does not import commercial modules directly
- [ ] `src/opensource` does not import `@/variant/...`
- [ ] Shared dependencies needed by the migrated module are available under `src/opensource`
- [ ] Enterprise-only behavior is mirrored under `enterprise/src/opensource/...`
- [ ] Enterprise-only stores/services are not left behind in `src`
- [ ] Runtime-only facades are used only when direct imports plus overlay are insufficient
- [ ] Private clients such as `keewoodClient` and `teamshareClient` are not introduced into `src/opensource`
- [ ] Files under `src/opensource` and `enterprise/src/opensource` do not import modules outside the `opensource` tree unless the user explicitly approves a temporary exception

## Verification checklist

- [ ] Find all importers of the target module with `rg` before migration
- [ ] Run targeted lint checks for touched files
- [ ] Run focused tests for changed logic when available
- [ ] Run build verification and fix missing mirrored dependencies iteratively
- [ ] Search for leftover `@/variant/...` imports
- [ ] Confirm enterprise overlay paths match the shared path exactly
- [ ] Search for leftover imports to deleted enterprise-only source paths under `src`
- [ ] Check initializers and lazy imports for unresolved paths after moving enterprise-only modules
- [ ] If overlay is disabled: ensure open-source stubs exist and match the enterprise interface
- [ ] Search for leftover imports to the pre-migration commercial path such as `@/components/business/<module>`

## Common pitfalls

### Pitfall 1: Keeping `variant` after the overlay exists

This preserves dead indirection and makes the import graph harder to reason about.

Rule: if direct `@/opensource/...` plus mirrored `enterprise/...` works, delete `variant`.

### Pitfall 2: Letting `src/opensource` import commercial code

This breaks the hard boundary.

Rule: only `enterprise/...` may point back to commercial implementations as migration shims.

### Pitfall 3: Forgetting helper imports

Render-time code may be correct while preload or utility code still points at old facades.

Rule: migrate preload helpers and utility imports together with the main implementation.

### Pitfall 4: Copying enterprise code blindly

Large duplicate files increase drift immediately.

Rule: prefer a thin enterprise re-export shim first, then refactor if needed.

### Pitfall 4.5: Leaving old commercial files behind after callers switch

This invites regressions because new code can accidentally import the pre-migration path again.

Rule: once callers are updated to `@/opensource/...`, delete the old `src/components/...` source files for that migrated closure.

### Pitfall 5: Smuggling private clients into open-source

If a feature depends on private infrastructure, the shared layer should not import it.

Rule: degrade or stub the open-source path instead of copying the client.

### Pitfall 6: Keeping enterprise-only stores or services in `src`

This makes the import graph look shared when the implementation is not actually shared.

Rule: if the module only exists for enterprise/App-native behavior, move the full chain into `enterprise/src/opensource/...`.

### Pitfall 7: Forgetting initializer split after moving enterprise-only services

A shared initializer may still dynamically import files that were intentionally removed from `src`.

Rule: keep the shared initializer web-safe, and add an enterprise overlay initializer when native restore logic must remain.

### Pitfall 8: Making an overlay file import itself logically

If `enterprise/src/opensource/foo.ts` re-exports from `@/opensource/foo`, overlay resolution points back to the same enterprise file.

Rule: put the real enterprise implementation in the overlay file, or use a temporary non-overlay source path only during an explicit short-lived migration step.

### Pitfall 9: Overlay disabled but modules moved to enterprise only

`vitePluginEnterpriseOverlay` may be commented out; the build then uses only `src`. Enterprise overlay files are never loaded.

Rule: when moving hooks/components to `enterprise/src/opensource/...` only, keep open-source stubs in `src/opensource/...` that satisfy all imports. Otherwise the build fails (e.g. `EISDIR: illegal operation on a directory` when importing a deleted module).

### Pitfall 10: Stub interface mismatch

Open-source stubs must return the exact same interface as the enterprise implementation.

Rule: hooks must return the same shape (e.g. `collaborators: []`, `collaborationInfo: { ... }`, `openManageModal: () => {}`, `CollaboratorUpdatePanel: null`). Components must export the same default and accept the same props.

### Pitfall 11: Putting the enterprise file under the wrong root

If callers are meant to import `@/opensource/...`, placing the real file under `enterprise/components/...` breaks the mirrored overlay model and leaves the import graph inconsistent.

Rule: dual-edition overlays for shared modules belong under `enterprise/src/opensource/...`.

### Pitfall 12: Overbuilding the open-source stub

Copying all enterprise files, types, and helpers into `src/opensource/...` increases drift and makes the stub look like a real shared implementation when it is not.

Rule: keep the stub minimal. Export only what open-source callers need right now.

### Pitfall 13: Duplicating generic helpers inside the migrated module

A local helper such as `utils/env.ts` may duplicate an existing global utility and create extra cleanup work during migration.

Rule: prefer shared utilities like `@/opensource/utils/env` when they already express the same behavior.

### Pitfall 14: Putting the real implementation into `src/opensource` by mistake

This usually happens when the user says "enterprise only" or "open-source should not include this", but the migration starts from caller paths instead of feature ownership.

Rule:

1. `src/opensource/...` may contain only the shared facade or no-op stub for that feature
2. The real enterprise implementation must live under the mirrored `enterprise/src/opensource/...` path
3. If the user explicitly says the open-source edition must not include the feature, do not put visible runtime behavior into `src/opensource/...`

### Pitfall 15: Overriding a whole page for one small delta

Copying an entire page or layout just to swap one banner or modal creates unnecessary drift immediately.

Rule: extract the variable block into a dedicated shared child component or hook first, then override only that child in `enterprise/src/opensource/...`.

## RecordingSummary reference

Use `RecordingSummary` as the reference implementation:

- `src/opensource/...` is the shared baseline
- Open-source callers import `@/opensource/...` directly
- Enterprise-only `useCancelRecord` and `useIsCurrentRecording` behavior is exposed through `enterprise/src/opensource/...`
- App-native store and native recording services live only under `enterprise/src/opensource/...`
- `initRecordSummaryService` is split so shared code keeps only web restore logic and enterprise overlay restores native logic
- `preloadRecordSummaryEditorPanel` no longer needs a `variant` facade
- Old `src/variant/...` and `src/opensource/variant/...` files are deleted after migration

## Output expectations

When using this skill, produce:

1. A short architecture decision: direct shared import vs enterprise overlay vs component override vs runtime facade
2. A migration plan grouped by shared baseline, enterprise deltas, and forbidden dependencies
3. The concrete file changes
4. Verification status for lint, tests, and build

## Keep it minimal

- Prefer the smallest boundary-preserving change
- Prefer enterprise shims over duplicated enterprise copies
- Prefer direct `@/opensource/...` imports over extra facades
- Do not migrate unrelated historical boundary violations unless the user expands scope

## Additional resources

- For concrete decision examples, see [examples.md](examples.md)
