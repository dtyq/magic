import type { DesignData } from "../types"
import type {
	CanvasConnection,
	CanvasDocumentMergeConnectionConflictReason,
	CanvasDocumentMergeElementConflictReason,
	ElementDetailsProvenance,
	LayerElement,
} from "@/components/CanvasDesign/runtime/document"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { DesignAttachmentIndex } from "../utils/designAttachmentIndex"
import type { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"
import type {
	DesignLoadIssue,
	DesignSidecarStatus,
	LoadDesignDataToRuntimeResult,
} from "../utils/designDataLoader"
import type { CanvasAccessMode } from "@/components/CanvasDesign/public/props"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"

export type DesignRemoteUpdateListenerMode = "message" | "file-change"

export interface PendingDesignUpgrade {
	reason: "legacy-dsl" | "sidecar-retry"
	fileId: string
	sourceVersion: string
	targetVersion: string
	createdAt: number
}

export type DesignConflictReason =
	| "remote-update-with-local-dirty"
	| "save-content-conflict"
	| "draft-remote-advanced"
	| "element-level-conflict"
	| "connection-level-conflict"

export type DesignElementConflictReason = CanvasDocumentMergeElementConflictReason
export type DesignConnectionConflictReason = CanvasDocumentMergeConnectionConflictReason

export type DesignElementConflictStatus = "unresolved" | "resolved"
export type DesignConnectionConflictStatus = "unresolved" | "resolved"

export interface DesignElementConflict {
	elementId: string
	reason: DesignElementConflictReason
	status: DesignElementConflictStatus
	baseElement: LayerElement | null
	localElement: LayerElement | null
	remoteElement: LayerElement | null
	baseParentId: string | null
	localParentId: string | null
	remoteParentId: string | null
	createdAt: number
	resolvedAt?: number
	resolution?: "use-local" | "use-remote"
}

export interface DesignConnectionConflict {
	connectionId: string
	reason: DesignConnectionConflictReason
	status: DesignConnectionConflictStatus
	baseConnection: CanvasConnection | null
	localConnection: CanvasConnection | null
	remoteConnection: CanvasConnection | null
	createdAt: number
	resolvedAt?: number
	resolution?: "use-local" | "use-remote"
}

export interface DesignConflict {
	reason: DesignConflictReason
	baseFingerprint: string
	localFingerprint: string
	remoteFingerprint: string
	localData: DesignData
	remoteData: DesignData
	createdAt: number
	localDataRestored?: boolean
	elementConflicts?: DesignElementConflict[]
	connectionConflicts?: DesignConnectionConflict[]
	mergedData?: DesignData
}

export interface DesignCurrentFileLoadResult {
	fileId: string | null
	accessIdentity: string
	data: DesignData | null
	loadResult?: LoadDesignDataToRuntimeResult
}

export interface DesignProjectManagerOptions {
	currentFile?: { id: string; name: string }
	attachments?: FileItem[]
	flatAttachments?: FileItem[]
	/** 已拿到附件快照，可开始解析 magic.project.js */
	attachmentsReady?: boolean
	projectPath?: string
	projectId?: string
	allowEdit: boolean
	isPlaybackMode: boolean
	isShareRoute: boolean
	isMobile: boolean
	/** Unified access mode consumed by the Design lifecycle and Canvas runtime. */
	accessMode?: CanvasAccessMode
	/** Runtime environment constraint used when deriving the initial mode. */
	isOffline?: boolean
	designProjectId?: string
	designProjectName?: string
	/** 扁平附件索引：远端同步 / 路径解析等链路复用，避免重复 O(N) 扫描 */
	attachmentIndex?: DesignAttachmentIndex | null
	selectedTopicId?: string | null
	onRemoteDesignDataUpdate?: (
		oldDesignData: DesignData,
		newDesignData: DesignData,
		updateType: "message" | "revoke" | "restore" | "draft",
	) => void
	updateListenerDebounceMs?: number
	remoteUpdateListenerMode?: DesignRemoteUpdateListenerMode
	onVersionChange?: (designData: DesignData, isViewingHistory: boolean) => void
	/** i18n 翻译函数，用于 toasts 等 */
	getT?: () => (key: string) => string
	/**
	 * Boundary-bound file client. Design managers live outside React, so the
	 * entry hook injects one closure built from the ambient FileAccessProvider.
	 * Omitted in host-only/test construction; managers then fall back to the
	 * unbound leaves (session identity is the intended host default).
	 */
	fileApi?: FileApi
}

/**
 * Resolve the host lifecycle mode at the integration boundary. Once resolved,
 * downstream managers must consume accessMode instead of re-evaluating the
 * legacy boolean flags independently.
 */
export function resolveDesignAccessMode(
	options: Pick<
		DesignProjectManagerOptions,
		"allowEdit" | "isPlaybackMode" | "isShareRoute" | "isMobile" | "accessMode" | "isOffline"
	>,
): CanvasAccessMode {
	if (options.accessMode) return options.accessMode
	if (options.isShareRoute) return "share"
	if (options.isPlaybackMode) return "history"
	if (!options.allowEdit || options.isMobile || options.isOffline) return "readonly"
	return "edit"
}

/**
 * Read the mode selected by the Design state owner. The legacy flag resolver
 * is retained only for older direct manager/test construction that omits the
 * normalized accessMode field.
 */
export function getDesignBaseAccessMode(
	options: Pick<
		DesignProjectManagerOptions,
		"allowEdit" | "isPlaybackMode" | "isShareRoute" | "isMobile" | "accessMode" | "isOffline"
	>,
): CanvasAccessMode {
	return options.accessMode ?? resolveDesignAccessMode(options)
}

export interface DesignProjectStateBagSetters {
	setMagicProjectJsFileId: (v: string | null) => void
	setDesignData: (data: DesignData) => void
	setElementDetailsProvenance?: (provenance: ElementDetailsProvenance) => void
	setPendingDesignUpgrade?: (upgrade: PendingDesignUpgrade | null) => void
	setDesignLoadIssue?: (issue: DesignLoadIssue | undefined) => void
	setSidecarStatus?: (status: DesignSidecarStatus) => void
	setIsInitialLoading: (v: boolean) => void
	setIsSaving: (v: boolean) => void
	setAccessMode: (v: CanvasAccessMode) => void
	setFileVersionsList: (v: FileHistoryVersion[]) => void
	setFileVersion: (v: number | undefined) => void
	setIsProcessingRevoke: (v: boolean) => void
	setRevokeType: (v: "revoke" | "restore" | null) => void
	setConflictState: (v: DesignConflict | null) => void
}

export interface DesignProjectStateBag {
	getDesignData: () => DesignData
	getElementDetailsProvenance?: () => ElementDetailsProvenance
	getPendingDesignUpgrade?: () => PendingDesignUpgrade | null
	getDesignLoadIssue?: () => DesignLoadIssue | undefined
	getSidecarStatus?: () => DesignSidecarStatus
	getConflictState: () => DesignConflict | null
	getMagicProjectJsFileId: () => string | null
	/** 空字符串表示尚未建立基线（等价于旧逻辑的「空字符串」） */
	getPrevDesignDataFingerprint: () => string
	setPrevDesignDataFingerprint: (v: string) => void
	getAccessMode: () => CanvasAccessMode
	setters: DesignProjectStateBagSetters
}

export function getDataToCompare(data: DesignData) {
	return {
		type: data.type,
		name: data.name,
		version: data.version,
		canvas: {
			elements: data.canvas?.elements || [],
			connections: data.canvas?.connections || [],
		},
	}
}

/** 异步读写必须仍属于发起时的项目、文件访问凭据和权限。 */
export function getDesignRequestIdentity(options: DesignProjectManagerOptions): string {
	return JSON.stringify([
		options.projectId ?? null,
		options.fileApi?.identityKey ?? "none",
		getDesignBaseAccessMode(options),
	])
}
