import type {
	FileAccessState,
	FileActionOptions,
	FileAccessConfig,
	FileAccessContextValue,
} from "./types"
export const DEFAULT_FILE_ACCESS: Readonly<FileAccessState> = Object.freeze({
	download: true,
	preview: true,
	share: true,
	view: true,
	export: true,
})
export const DEFAULT_FILE_ACTION_OPTIONS: Readonly<FileActionOptions> = Object.freeze({
	copyTo: true,
	moveTo: true,
	shareTopic: true,
	createNewTopic: true,
	fullscreen: true,
	versionHistory: true,
	shareInReadOnly: false,
})
export const DEFAULT_FILE_ACCESS_CONTEXT: FileAccessContextValue = Object.freeze({
	permissions: DEFAULT_FILE_ACCESS,
	options: DEFAULT_FILE_ACTION_OPTIONS,
	isScoped: false,
})
export const FILE_WORKSPACE_CONFIG: FileAccessConfig = { options: { copyTo: true, moveTo: true } }
export const EDITOR_FILE_CONFIG: FileAccessConfig = {
	options: { ...FILE_WORKSPACE_CONFIG.options, shareTopic: false },
}
export const CLAW_FILE_CONFIG: FileAccessConfig = {
	options: { ...EDITOR_FILE_CONFIG.options, createNewTopic: false },
}
/** Viewers retain preview/download capabilities, subject to inherited restrictions. */
export const VIEWER_FILE_CONFIG: FileAccessConfig = {
	permissions: { share: false },
	options: { copyTo: false, moveTo: false, shareTopic: false, createNewTopic: false },
}
