import { JSONContent, Editor } from "@tiptap/react"
import { ReportFileUploadsResponse } from "@/apis/modules/file"
import { UploadResponse } from "@/hooks/useUploadFiles/types"
import { ProjectListItem, Topic, TopicMode, Workspace } from "../../pages/Workspace/types"
import { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { SaveUploadFileToProjectResponse } from "../../utils/api"
import { AttachmentItem } from "../TopicFilesButton/hooks"

// Re-export ModelSwitch types for unified type imports
export type {
	ModelItem,
	ModelSwitchProps,
	ModelConfig,
	ProviderItem,
	ModeModelGroup,
} from "./components/ModelSwitch/types"
// Re-export enums (cannot use 'export type' for const enums as they are values)
export { ModelStatusEnum, ModelTagEnum } from "./components/ModelSwitch/types"
import type { ModelItem } from "./components/ModelSwitch/types"
import { MentionPanelStore } from "@/components/business/MentionPanel/store"

// File upload status
export type FileUploadStatus = "init" | "uploading" | "done" | "error"

export enum UploadSource {
	Home = 1, // 从首页上传
	ProjectFile = 2, // 从项目文件列表上传
	AgentFile = 3, // Agent自己上传
	RecordSummary = 4, // 从录音总结上传
}

// File data structure
export interface FileData {
	saveResult?: SaveUploadFileToProjectResponse
	id: string
	name: string
	file: File
	status: FileUploadStatus
	progress?: number
	result?: UploadResponse
	reportResult?: ReportFileUploadsResponse
	error?: string
	cancel?: () => void
	suffixDir?: string // 记录文件的上传目录
}

/**
 * Serializable file data for draft storage
 *
 * This interface excludes non-cloneable properties like:
 * - file: File object (cannot be serialized to IndexedDB, but stored separately in file cache)
 * - cancel: function (cannot be serialized, will be recreated during restoration)
 *
 * Complex result objects are safely serialized after testing for circular references.
 */
export interface SerializableFileData {
	id: string
	name: string
	status: FileUploadStatus
	progress?: number
	error?: string
	/** Basic file metadata that can be safely serialized */
	fileInfo: {
		name: string
		size: number
		type: string
	}
	/** Upload results - serialized safely */
	saveResult?: any // SaveUploadFileToProjectResponse
	result?: any // UploadResponse
	reportResult?: any // ReportFileUploadsResponse
}

// Component size
export type MessageEditorSize = "small" | "default" | "mobile"

export interface MessageEditorModuleConfig {
	enabled?: boolean
}

export interface MessageEditorUploadModuleConfig extends MessageEditorModuleConfig {
	confirmDelete?: boolean
}

export interface MessageEditorMCPModuleConfig extends MessageEditorModuleConfig {
	storageKey?: string
	useTempStorage?: boolean
}

export interface MessageEditorModules {
	mention?: MessageEditorModuleConfig
	aiCompletion?: MessageEditorModuleConfig
	mcp?: MessageEditorMCPModuleConfig
	upload?: MessageEditorUploadModuleConfig
	voiceInput?: MessageEditorModuleConfig
}

// Component Props
export interface MessageEditorProps {
	/** Class name */
	className?: string
	/** Container class name */
	containerClassName?: string
	/** Send callback */
	onSend?: (content: {
		value: JSONContent | undefined
		mentionItems: MentionListItem[]
		topicMode?: TopicMode
		selectedModel?: ModelItem | null
		selectedImageModel?: ModelItem | null
	}) => void
	/** Placeholder */
	placeholder?: string
	/** File upload callback */
	onFileUpload?: (files: FileData[]) => void
	/** task running state - controls send/interrupt button */
	isTaskRunning?: boolean
	/** Interrupt action handler */
	onInterrupt?: (callback?: () => void) => void
	/** Selected topic */
	selectedTopic?: Topic | null
	/** Selected project */
	selectedProject?: ProjectListItem | null
	/** Selected workspace */
	selectedWorkspace?: Workspace | null
	/** Draft key resolved by caller */
	draftKey?: DraftKey
	/** Topic mode */
	topicMode?: TopicMode
	/** Component size */
	size?: MessageEditorSize
	/** Module capability configuration */
	modules?: MessageEditorModules
	/** Whether is sending */
	isSending?: boolean
	/** Focus callback */
	onFocus?: () => void
	/** Blur callback */
	onBlur?: () => void
	/** Mention insert callback (multiple items) */
	onMentionInsertItems?: (items: any[]) => void
	/** Select detail callback */
	onFileClick?: (fileItem?: any) => void
	/** Attachments */
	attachments?: AttachmentItem[]
	/** Whether is editing queue item */
	isEditingQueueItem?: boolean
	/** Create topic callback */
	onCreateTopic?: () => void
	/** Show loading */
	showLoading?: boolean
	editorModeSwitch?: ({ disabled }: { disabled: boolean }) => React.ReactNode
	/** Mention panel store */
	mentionPanelStore?: MentionPanelStore
	/**
	 * Layout configuration for toolbar buttons
	 * If not provided, uses default layout
	 * @example
	 * layoutConfig={{
	 *   topBarLeft: [ToolbarButton.AT, ToolbarButton.DRAFT_BOX],
	 *   bottomLeft: [ToolbarButton.MODEL_SWITCH],
	 *   bottomRight: [ToolbarButton.UPLOAD, ToolbarButton.MCP, ToolbarButton.SEND_BUTTON]
	 * }}
	 */
	layoutConfig?: MessageEditorLayoutConfig
	/** Enable message send by content */
	enableMessageSendByContent?: boolean
}

// Component Ref
export interface MessageEditorRef {
	editor: Editor | null
	/** Whether can send message (has content and all files uploaded) */
	canSendMessage: boolean
	/** Get current files */
	getFiles: () => FileData[]
	/** Clear all files */
	clearFiles: () => void
	/** Get current content value */
	getValue: () => JSONContent | undefined
	/** Clear current content */
	clearContent: () => void
	/** Clear editor after successful send without remote deletion */
	clearContentAfterSend: () => void
	/** Set content and sync internal state */
	setContent: (content: JSONContent | undefined) => void
	/** Restore mention items */
	restoreMentionItems: (items: MentionListItem[]) => void
	/** 统一恢复内容：先 updateContent 再 restoreMentionItems，恢复期间抑制 appendTransaction */
	restoreContent: (content?: JSONContent, mentionItems?: MentionListItem[]) => void
	/** Focus */
	focus: ({ enableWhenIsMobile }: { enableWhenIsMobile: boolean }) => void
	/** Set topic models */
	setModels: (params: { languageModel?: ModelItem | null; imageModel?: ModelItem | null }) => void
}

// Draft functionality types
export interface DraftKey {
	/** Workspace id to scope drafts per workspace */
	workspaceId: string
	/** Project id to scope drafts per project */
	projectId: string
	/** Topic id to scope drafts per topic */
	topicId: string
}

export interface DraftData {
	/** Workspace id to scope drafts per workspace */
	workspaceId: string
	/** Project id to scope drafts per project */
	projectId: string
	/** Topic id to scope drafts per topic */
	topicId: string
	/** Message content */
	value?: JSONContent
	/** Mention items */
	mentionItems: MentionListItem[]
	/** Creation timestamp */
	createdAt: number
	/** Last updated timestamp */
	updatedAt: number
	/** Version ID for draft versions */
	versionId?: string
	/** Version timestamp for draft versions */
	versionTimestamp?: number
	/** Whether this is an auto-saved version */
	isAutoSaved?: boolean
}

export type LegacyDraftData = {
	projectId: string
	topicId: string
	value?: JSONContent
	mentionItems: MentionListItem[]
	files: SerializableFileData[]
	createdAt: number
	updatedAt: number
	fileCacheInfo?: Record<string, FileData>
	key: string
}

/** Draft version information for listing versions */
export interface DraftVersionInfo {
	/** Version ID */
	versionId: string
	/** Version creation timestamp */
	versionTimestamp: number
	/** Whether this is an auto-saved version */
	isAutoSaved: boolean
	/** Last updated timestamp */
	updatedAt: number
	/** Creation timestamp */
	createdAt: number
	/** version key */
	versionKey?: string
	/** Topic id - for project-level queries to identify which topic the version belongs to */
	topicId?: string
}

/** Draft version with full data */
export interface DraftVersion extends DraftData {
	/** Version ID */
	versionId: string
	/** Version creation timestamp */
	versionTimestamp: number
	/** Whether this is an auto-saved version */
	isAutoSaved: boolean
}

export interface DraftServiceInterface {
	/** Save draft data */
	saveDraft(key: DraftKey, data: Omit<DraftData, "createdAt" | "updatedAt">): Promise<void>
	/** Load draft data */
	loadDraft(key: DraftKey): Promise<DraftData | null>
	/** Delete draft data */
	deleteDraft(key: DraftKey): Promise<void>
	/** Clear all drafts */
	clearAllDrafts(): Promise<void>
	/** Save a draft version */
	saveDraftVersion(
		key: DraftKey,
		data: Omit<DraftData, "createdAt" | "updatedAt">,
		force?: boolean,
	): Promise<void>
	/** Load all draft versions for a key */
	loadDraftVersions(key: DraftKey): Promise<DraftVersionInfo[]>
	/** Load all draft versions for a project (across all topics) */
	loadProjectDraftVersions(
		key: Pick<DraftKey, "workspaceId" | "projectId">,
		offset?: number,
		limit?: number,
	): Promise<DraftVersionInfo[]>
	/** Load a specific draft version */
	loadDraftByVersion(key: DraftKey, versionId: string): Promise<DraftData | null>
	/** Delete a specific draft version */
	deleteDraftVersion(key: DraftKey, versionId: string): Promise<void>
	/** Delete all draft versions */
	deleteDraftVersions(key: DraftKey): Promise<void>
	/** Cleanup expired draft versions (older than retentionDays) */
	cleanupExpiredVersions(retentionDays?: number): Promise<void>
	/** Close connection/cleanup resources */
	close(): void
	/** Load the latest draft version */
	loadLatestDraftVersion(key: DraftKey): Promise<DraftData | null>
}

// Button keys for layout configuration
export enum ToolbarButton {
	DRAFT_BOX = "draftBox",
	AT = "at",
	MODEL_SWITCH = "modelSwitch",
	INTERNET_SEARCH = "internetSearch",
	MCP = "mcp",
	UPLOAD = "upload",
	VOICE_INPUT = "voiceInput",
	EDITOR_MODE_SWITCH = "editorModeSwitch",
	/**
	 * Send button - automatically switches to interrupt button when task is running
	 * You typically only need to configure SEND_BUTTON, not INTERRUPT_BUTTON
	 */
	SEND_BUTTON = "sendButton",
	/**
	 * Interrupt button - usually not needed in config as SEND_BUTTON handles it
	 * Only use this if you want interrupt button separate from send button
	 */
	INTERRUPT_BUTTON = "interruptButton",
	/** Divider */
	DIVIDER = "divider",
	/** Token usage indicator - shows context window usage percentage */
	TOKEN_USAGE = "tokenUsage",
}

// Layout configuration interface
export interface MessageEditorLayoutConfig {
	topBarLeft?: ToolbarButton[]
	topBarRight?: ToolbarButton[]
	bottomLeft?: ToolbarButton[]
	bottomRight?: ToolbarButton[]
	outsideBottom?: ToolbarButton[]
	outsideTop?: ToolbarButton[]
}
