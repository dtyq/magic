# Examples

## Example 1: Shared caller imports the real shared path

Use this when the caller lives under `src/opensource/` and the baseline implementation is shared.

```ts
import useCancelRecord from "@/opensource/components/business/RecordingSummary/hooks/useCancelRecord"
import { useIsCurrentRecording } from "@/opensource/components/business/RecordingSummary/hooks/useisCurrentRecording"
```

Why:

- Open-source code should depend on the real shared path
- The import graph stays obvious
- Enterprise can still override the same path through `enterprise/src/opensource/...`

## Example 2: Enterprise overlay for a hook

Use this when shared callers import `@/opensource/...`, but enterprise behavior differs.

```ts
// enterprise/src/opensource/components/business/RecordingSummary/hooks/useCancelRecord.tsx
export default function useCancelRecord() {
	// enterprise implementation
}
```

Why:

- Shared callers keep one direct import
- Vite resolves the enterprise file first
- The overlay file keeps the logical path stable
- For a large enterprise-only hook, move the real implementation here instead of keeping it in `src`

## Example 3: Enterprise overlay for a preload target

Use this when helper code should import the shared component path directly.

Shared helper:

```ts
function preloadRecordSummaryEditorPanel() {
	return import("@/opensource/components/business/RecordingSummary/EditorPanel")
}
```

Enterprise overlay:

```ts
// enterprise/src/opensource/components/business/RecordingSummary/EditorPanel.tsx
export default function RecordingSummaryEditorPanel() {
	return <div>{/* enterprise implementation */}</div>
}
```

Why:

- The helper no longer needs `@/variant/...`
- Open-source and enterprise both preload the same logical path
- Enterprise behavior still wins at runtime
- The enterprise overlay file must not re-import the same logical `@/opensource/...` path

## Example 4: Component override with `ComponentFactory`

Use this when a rendered UI component still needs explicit factory registration.

Shared default:

```ts
const RecordingSummaryEditorPanel = lazy(
	() => import("@/opensource/components/business/RecordingSummary/EditorPanel"),
)
```

Premium override when still required:

```ts
const RecordingSummaryEditorPanel = lazy(
	() => import("@/opensource/components/business/RecordingSummary/EditorPanel"),
)
```

Caller side:

```tsx
<ComponentRender componentName={DefaultComponents.RecordingSummaryEditorPanel} />
```

Why:

- Render-time replacement remains explicit
- Shared imports still point at the shared path
- Overlay and factory can coexist during migration

## Example 5: Removing old `variant` facades

Bad:

```ts
import useCancelRecord from "@/variant/recording-summary/use-cancel-record"
```

Good:

```ts
import useCancelRecord from "@/opensource/components/business/RecordingSummary/hooks/useCancelRecord"
```

Then delete:

```text
src/variant/recording-summary/*
src/opensource/variant/recording-summary/*
```

Why:

- The facade is redundant once the overlay path exists
- Fewer indirection layers make migration safer

## Example 6: Thin compatibility re-export

Use this when the shared implementation becomes the source of truth, but old paths still need to compile temporarily.

```ts
export { default } from "@/opensource/stores/recordingSummary"
export * from "@/opensource/stores/recordingSummary"
```

Why:

- Shared logic stays in one place
- Existing callers can be migrated incrementally

## Example 7: Enterprise-only native dependency closure

Use this when a capability only exists for enterprise or App-native runtime.

Move the whole closure into enterprise:

```text
enterprise/src/opensource/stores/recordingSummary/appNative.ts
enterprise/src/opensource/services/recordSummaryAppNativeService/index.ts
enterprise/src/opensource/services/recordSummaryAppNativeService/RecordingPersistence.ts
enterprise/src/opensource/services/AppAIRecordingService/index.ts
```

Caller side still uses the logical path:

```ts
import { recordingSummaryAppNativeStore } from "@/opensource/stores/recordingSummary/appNative"
import { initializeService as initializeRecordSummaryAppNativeService } from "@enterprise/opensource/services/recordSummaryAppNativeService"
```

Why:

- The logical path stays stable for callers
- Open-source code does not need fake copies of enterprise-only modules
- Overlay resolves the enterprise implementation at runtime

## Example 8: Split shared and enterprise initializers

Use this when a shared initializer previously loaded both web and native branches.

Shared file:

```ts
export async function tryRestorePreviousRecordSummarySession({ userId }: InitRecordSummaryParams) {
	const { hasRecoverableRecordingSession } =
		await import("@/opensource/services/recordSummary/recordingRecoveryChecker")
	// web restore only
}
```

Enterprise overlay:

```ts
if (isMagicApp) {
	const nativeModule = await import("./recordSummaryAppNativeService")
	await nativeModule.initializeService().tryRestorePreviousSession()
	return
}
```

Why:

- Shared code remains web-safe
- Enterprise keeps native restore logic without unresolved imports in `src`

## Example 9: Optional runtime facade

Use this only when direct imports plus overlay still cannot model the required binding.

```ts
import commercialHook from "@/components/business/foo/useFoo"
import sharedHook from "@/opensource/components/business/foo/useFoo"
import { isCommercial } from "@/opensource/utils/env"

const useFooImpl = isCommercial() ? commercialHook : sharedHook

export default function useFoo(options = {}) {
	return useFooImpl(options)
}
```

Do not use this when:

- The caller can import `@/opensource/...` directly
- A mirrored `enterprise/...` file would already solve the problem

## Example 10: Remove forbidden private clients

Bad:

```ts
import teamshareClient from "@/opensource/apis/clients/teamshare"
export const MergeApi = generateMergeApi(teamshareClient)
```

Good:

```ts
magicToast.error(t("recordingSummary.fileChangeModal.aiResolveError"))
```

Why:

- Private clients do not belong in `src/opensource`
- Open-source should degrade or stub the feature instead

## Example 11: Enterprise-only hook with open-source stub

Use when `useCollaboratorUpdatePanel` (or similar) is moved to enterprise but callers in `src` still import it. Overlay may be disabled, so the build uses only `src`.

Open-source stub:

```ts
// src/opensource/.../WithCollaborators/hooks/useCollaboratorUpdatePanel.tsx
function useCollaboratorUpdatePanel({ selectedProject: _sp, onClose: _onClose }) {
	return {
		collaborators: [],
		collaborationInfo: { is_collaboration_enabled: false, default_join_permission: "viewer" },
		openManageModal: () => {},
		CollaboratorUpdatePanel: null,
	}
}
```

Enterprise overlay:

```ts
// enterprise/src/opensource/.../WithCollaborators/hooks/useCollaboratorUpdatePanel.tsx
// Full impl with useCollaborationManageData, CollaborationManageModal, etc.
```

Why:

- Stub satisfies all callers (ProjectCardContainer, ProjectPage, useProjectActions, CollaborationProjectsPanel, …) when overlay is off
- Interface must match exactly so no caller changes are needed
- Enterprise overlay provides real behavior when overlay is enabled

## Example 12: Enterprise-only component with open-source stub

Use when `WithCollaborators` (or similar) is moved to enterprise but lazy-imported from `src`.

Open-source stub:

```ts
// src/opensource/.../WithCollaborators/index.tsx
function WithCollaborators(_props: WithCollaboratorsProps) {
	return null
}
export default observer(WithCollaborators)
```

Why:

- Lazy import `import("@/opensource/.../WithCollaborators")` must resolve to a file
- Stub exports same default and accepts same props
- Prevents `EISDIR` or "module not found" when the module was deleted from `src`

## Example 13: Overlay disabled — build uses only `src`

If `vitePluginEnterpriseOverlay` is commented out in `vite.config.ts`, the build never loads `enterprise/` files.

Rule: any module imported from `src` must exist in `src`. Moving to enterprise-only without an open-source stub breaks the build. Add stubs (see Pattern E: Enterprise-only module with open-source stub) so imports resolve.

## Example 14: Legacy commercial component becomes dual-edition

Use when a module currently lives under `src/components/business/...`, but the final shared caller path should be `@/opensource/...`.

Target layout:

```text
src/opensource/components/business/OnlineFeedbackModal/index.tsx
enterprise/src/opensource/components/business/OnlineFeedbackModal/component.tsx
enterprise/src/opensource/components/business/OnlineFeedbackModal/index.ts
enterprise/src/opensource/components/business/OnlineFeedbackModal/types.ts
```

Shared callers after migration:

```ts
import showOnlineFeedbackModal, {
	OnlineFeedbackModalType,
} from "@/opensource/components/business/OnlineFeedbackModal"
```

Minimal open-source stub:

```ts
export enum OnlineFeedbackModalType {
	PointsChange = "pointsChange",
	SubscriptionBill = "subscriptionBill",
}

export function showOnlineFeedbackModal() {
	return Promise.resolve(null)
}
```

Why:

- The dual-edition logical path becomes `@/opensource/...`
- The real enterprise implementation must mirror that path under `enterprise/src/opensource/...`
- Do not place the migrated file under `enterprise/components/...`
- Do not keep extra stub files like local `utils/env.ts` when `@/opensource/utils/env` already provides the shared helper
