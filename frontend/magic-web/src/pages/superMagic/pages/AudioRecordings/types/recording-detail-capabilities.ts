/** Tab keys shown in the recording detail right panel workbench. */
export type RecordingDetailTabKey =
	| "summary"
	| "topics"
	| "highlights"
	| "insights"
	| "metrics"
	| "mindmap"
	| "followup"
	| "power_dynamics"
	| "intent"
	| "notes"

/** Capability matrix injected by owner/share shells so the workbench stays context-agnostic. */
export interface RecordingDetailCapabilities {
	viewMode: "owner" | "folder" | "share"
	canRename: boolean
	canDelete: boolean
	canMoveGroup: boolean
	canGenerateSummary: boolean
	canManageShare: boolean
	canCopyToProject: boolean
	canExport: boolean
	canEditSpeakers: boolean
	visibleTabKeys: RecordingDetailTabKey[]
}

/** Project-folder entry hides project management actions while preserving speaker-name editing. */
export const FOLDER_RECORDING_DETAIL_CAPABILITIES: RecordingDetailCapabilities = {
	viewMode: "folder",
	canRename: false,
	canDelete: false,
	canMoveGroup: false,
	canGenerateSummary: false,
	canManageShare: false,
	canCopyToProject: false,
	canExport: false,
	canEditSpeakers: true,
	visibleTabKeys: [
		"summary",
		"topics",
		"highlights",
		"insights",
		"mindmap",
		"metrics",
		"followup",
		"power_dynamics",
		"intent",
		"notes",
	],
}

/** Owner entry capabilities for the PC/H5 recording detail workbench. */
export const OWNER_RECORDING_DETAIL_CAPABILITIES: RecordingDetailCapabilities = {
	viewMode: "owner",
	canRename: true,
	canDelete: true,
	canMoveGroup: true,
	canGenerateSummary: true,
	canManageShare: true,
	canCopyToProject: true,
	canExport: true,
	canEditSpeakers: true,
	visibleTabKeys: [
		"summary",
		"topics",
		"highlights",
		"insights",
		"mindmap",
		"metrics",
		"followup",
		"power_dynamics",
		"intent",
		"notes",
	],
}

/** Share read-only capabilities reserved for future share-link entry. */
export const SHARE_RECORDING_DETAIL_CAPABILITIES: RecordingDetailCapabilities = {
	viewMode: "share",
	canRename: false,
	canDelete: false,
	canMoveGroup: false,
	canGenerateSummary: false,
	canManageShare: false,
	canCopyToProject: false,
	canExport: false,
	canEditSpeakers: false,
	visibleTabKeys: [
		"summary",
		"topics",
		"highlights",
		"insights",
		"mindmap",
		"metrics",
		"followup",
		"power_dynamics",
		"intent",
		"notes",
	],
}

/** Future share data source contract; owner wraps useRecordingDetailData today. */
export interface RecordingDetailDataSource {
	projectId: string
	load(): Promise<unknown>
}
