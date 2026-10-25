import { JSONContent, Editor } from "@/infrastructure/editors/tiptap/react"
import { ReportFileUploadsResponse } from "@/apis/modules/file"
import { UploadResponse } from "@/hooks/useUploadFiles/types"
import { ProjectListItem, Topic, Workspace } from "../../pages/Workspace/types"
import { TopicMode } from "../../pages/Workspace/TopicMode"
import { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { DataService } from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { SaveUploadFileToProjectResponse } from "../../utils/api"
import { AttachmentItem } from "../TopicFilesButton/hooks"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import type { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"

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
import { MentionPanelStore } from "@/components/business/MentionPanel/builtin-store"

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
	isVirtualReference?: boolean
	progress?: number
	result?: UploadResponse
	reportResult?: ReportFileUploadsResponse
	error?: string
	cancel?: () => void
	parentId?: string // 记录文件的父目录ID
	defaultRelativePath?: string // 默认相对路径（当 parentId 为空时使用）
	isHidden?: boolean
	/** Canvas clipboard assets stay upload mentions and are never promoted to project mentions. */
	isCanvasClipboard?: boolean
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
	isCanvasClipboard?: boolean
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
	send?: MessageEditorModuleConfig
}

export interface EditorPromptCarouselConfig {
	examples: string[]
	typingIntervalMs?: number
	holdDurationMs?: number
	fadeDurationMs?: number
	clickable?: boolean
	tabLabel?: string
	acceptLabel?: string
	navigationLabel?: string
	applyAriaLabel?: string
}

// Component Props
export interface MessageEditorProps {
	/** Class name */
	className?: string
	/** Container class name */
	containerClassName?: string
	/** 输入框内头部与正文之间的状态内容，不占用工具按钮的布局配置。 */
	headerContent?: React.ReactNode
	/** Send callback */
	onSend?: (content: {
		value: JSONContent | undefined
		mentionItems: MentionListItem[]
		topicMode?: TopicMode
		selectedModel?: ModelItem | null
		selectedImageModel?: ModelItem | null
		selectedVideoModel?: ModelItem | null
		shouldClearEditorAfterSend?: boolean
		extra?: Record<string, unknown>
		targetTopic?: Topic | null
	}) => void | boolean | Promise<void | boolean>
	/** Placeholder */
	placeholder?: string
	/** Rotating prompt examples shown while the editor is empty */
	promptCarousel?: EditorPromptCarouselConfig
	/** File upload callback */
	onFileUpload?: (files: FileData[]) => void
	/** task running state - controls send/interrupt button */
	isTaskRunning?: boolean
	/** Interrupt callback override */
	onInterrupt?: () => void
	/** Extra interrupt button loading state */
	stopEventLoading?: boolean
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
	/** Model catalog mode. Defaults to topicMode when not specified. */
	modelTopicMode?: TopicMode
	/** Composer employee used for model selection; overrides the historical topic employee. */
	agentCode?: string | null
	/** Component size */
	size?: MessageEditorSize
	/** Module capability configuration */
	modules?: MessageEditorModules
	/** Whether is sending */
	isSending?: boolean
	/** Extra send button loading state (independent from task running state) */
	sendButtonLoading?: boolean
	/** Focus callback */
	onFocus?: () => void
	/** Blur callback */
	onBlur?: () => void
	/** Fires when editor commands are subscribed and the current draft is restored. */
	onReady?: () => void
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
	/** Ensure a project exists before uploads that require project context */
	onEnsureProject?: () => Promise<ProjectListItem | null>
	/** Show loading */
	showLoading?: boolean
	editorModeSwitch?: ({ disabled }: { disabled: boolean }) => React.ReactNode
	modelSwitch?: React.ReactNode
	/** Mention panel store */
	mentionPanelStore?: MentionPanelStore
	/** Override mention validation in special restore scenarios */
	isAllowedMention?: (attrs: TiptapMentionAttributes, dataService: DataService) => boolean
	/** Project files store used by upload optimistic updates */
	projectFilesStore?: ProjectFilesStore
	/** Shared topic model store */
	topicModelStore?: ReturnType<typeof createSuperMagicTopicModelStore>
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
	/** Skip initial draft restore to avoid overwriting externally restored content */
	skipInitialDraftRestore?: boolean
}

export interface SendMessageByContentPayload {
	/** Optional scoped request acknowledgement; transport failures remain in message history. */
	targetProjectId?: string
	tryClaim?: () => boolean
	onHandled?: (accepted: boolean) => void
	jsonContent: JSONContent
	mentionItems?: MentionListItem[]
	topicMode?: TopicMode
	selectedModel?: ModelItem | null
	selectedImageModel?: ModelItem | null
	selectedVideoModel?: ModelItem | null
	shouldClearEditorAfterSend?: boolean
	extra?: Record<string, unknown>
	targetTopic?: Topic | null
}

// Component Ref
export interface MessageEditorRef {
	getDraftKey: () => DraftKey | null
	beginDraftSwitch: () => Promise<boolean>
	endDraftSwitch: () => void
	prepareQueueDraft: (draft: QueueDraftSnapshot) => Promise<void>
	restoreQueueDraft: (
		draft: QueueDraftSnapshot,
		activate?: boolean,
	) => Promise<"activated" | "saved">
	getQueueDraft: () => QueueDraftSnapshot | null
	subscribeQueueDraft: (listener: (draft: QueueDraftSnapshot | null) => void) => () => void
	keepQueueDraft: () => Promise<void>
	completeQueueDraft: (syncId: string, submittedValue?: JSONContent) => Promise<boolean>
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
	focus: (params?: { enableWhenIsMobile?: boolean; preventScroll?: boolean }) => void
	/** Set topic models */
	setModels: (params: {
		languageModel?: ModelItem | null
		imageModel?: ModelItem | null
		videoModel?: ModelItem | null
	}) => void
}

// 队列的提交内容与编辑器草稿共用类型，避免恢复时漏掉模型或场景参数。
export interface QueueMessageInput {
	content: JSONContent
	mentionItems: MentionListItem[]
	dynamicParams?: Record<string, unknown>
	selectedModel?: ModelItem | null
	selectedImageModel?: ModelItem | null
	selectedVideoModel?: ModelItem | null
	topicMode?: TopicMode
	agentCode?: string | null
}

export interface QueueDraftMetadata extends Omit<QueueMessageInput, "content" | "mentionItems"> {
	sourceId: string
	userId: string
	organizationCode: string
	returnPosition: "original" | "tail"
	beforeId: string | null
	afterId: string | null
	originalIndex: number
	phase: "removing" | "detached" | "submitting" | "unconfirmed"
	clientSyncId: string
	expectedSyncId: string
	localSource: boolean
	// 请求结果未知时重试同一份提交；编辑器正文可以继续变化，不能替换已发出的请求。
	submission?: QueueMessageInput
}

export interface QueueDraftSnapshot extends DraftKey {
	value?: JSONContent
	mentionItems: MentionListItem[]
	queueDraft: QueueDraftMetadata
}

// Draft functionality types
export interface DraftKey {
	/** 固定异步保存的账户归属，省略时沿用当前账户。 */
	userId?: string
	organizationCode?: string
	/** Workspace id to scope drafts per workspace */
	workspaceId: string
	/** Project id to scope drafts per project */
	projectId: string
	/** Topic id to scope drafts per topic */
	topicId: string
}

export interface DraftData {
	/** 当前输入快照；无此标记的旧记录仍按历史版本恢复。 */
	isCurrentSnapshot?: boolean
	queueDraft?: QueueDraftMetadata
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
	SLASH_COMMAND = "slashCommand",
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
