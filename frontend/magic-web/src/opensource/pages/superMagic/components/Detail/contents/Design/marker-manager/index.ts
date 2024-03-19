export {
	SuperMagicMarkerManager,
	fromCanvasMarkerMentionData,
	isLikelyAbortError,
} from "./SuperMagicMarkerManager"
export {
	useSuperMagicMarkerManager,
	useSuperMagicMarkerManagerOptional,
} from "./SuperMagicMarkerManagerContext"
export { MarkerStorage } from "./storage/MarkerStorage"
export { MarkerCompositorService } from "./compositor/MarkerCompositorService"
export type {
	MarkerCompositorMethods,
	MarkerCompositorInput,
	CompositeResult,
	IdentifyInput,
} from "./compositor/MarkerCompositorService"
export type {
	SuperMagicMarkerManagerOptions,
	SyncToMessageEditorMode,
	SyncToMessageEditorOptions,
} from "./types"
export type { SuperMagicMarkerManagerDependencies } from "./SuperMagicMarkerManager"
