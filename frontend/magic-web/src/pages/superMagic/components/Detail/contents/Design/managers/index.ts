export { DesignProjectManager } from "./DesignProjectManager"
export type { DesignProjectManagerFactoryParams } from "./DesignProjectManager"
export { DesignLoadManager } from "./DesignLoadManager"
export { DesignSaveManager } from "./DesignSaveManager"
export type {
	DesignSaveFailureReason,
	DesignSaveContext,
	DesignSaveLifecycleHandlers,
	DesignSaveMetadata,
	DesignSaveResult,
	DesignSaveSource,
	RemoteUpdateCheckResult,
} from "./DesignSaveManager"
export { DesignVersionManager } from "./DesignVersionManager"
export {
	DesignRemoteListener,
	type ApplyRemoteDesignDataFn,
	type FetchRemoteDesignDataFn,
	type LoadAndApplyRemoteFn,
} from "./DesignRemoteListener"
export {
	type DesignRemoteUpdateListenerMode,
	type DesignCurrentFileLoadResult,
	type PendingDesignUpgrade,
	type DesignConflict,
	type DesignConflictReason,
	type DesignElementConflict,
	type DesignElementConflictReason,
	type DesignElementConflictStatus,
	type DesignProjectManagerOptions,
	type DesignProjectStateBag,
	type DesignProjectStateBagSetters,
	getDataToCompare,
} from "./types"
