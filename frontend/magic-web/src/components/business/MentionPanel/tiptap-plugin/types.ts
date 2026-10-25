import type {
	SuggestionKeyDownProps,
	SuggestionProps,
} from "@/infrastructure/editors/tiptap/suggestion"
import type { Editor, ReactNodeViewProps } from "@/infrastructure/editors/tiptap/react"
import type { ComponentType } from "react"
import type {
	McpMentionData,
	AgentMentionData,
	MicroAppMentionData,
	SkillMentionData,
	MentionData,
	MentionItem,
	MentionPanelCatalogBehavior,
	PanelState,
	MentionPanelGalleryOptions,
	MentionPanelLoadStateOptions,
	MentionPanelMultiSelectNavigationPolicy,
	MentionPanelSelectionSummary,
	MentionPanelViewMode,
	NavigationItem,
	UploadFileMentionData,
	CloudFileMentionData,
	ToolMentionData,
	ProjectMentionData,
	DirectoryMentionData,
	MemoryDirectoryMentionData,
	MemoryFileMentionData,
	UserFileMentionData,
	UserDirectoryMentionData,
	CanvasMarkerMentionData,
	TextMentionData,
	DataService,
	MentionSelectContext,
} from "../types"
import { MentionItemType, ProjectFileMentionData } from "../types"
import { LANGUAGE_PACKS, normalizeLocale } from "../i18n"
import type { Language } from "../i18n/types"
import {
	getSelectedCanvasMarkerMentionSuggestion,
	normalizeCanvasMarkerMentionData,
} from "../utils/canvasMarkerMention"
import i18n from "i18next"

// Tiptap mention node attributes
export interface TiptapMentionAttributes {
	type: MentionItem["type"]
	data: MentionItem["data"]
	/**
	 * Marks a Canvas-derived mention as a temporary preview that has not yet
	 * entered the formal mention lifecycle. Pending mentions are excluded from
	 * drafts and send payloads, and rendered with reduced opacity until promoted.
	 */
	pending?: boolean
	/**
	 * Runtime-only owner identifier for a pending mention node. The Canvas bridge
	 * uses it to replace or promote only the temporary nodes it created.
	 */
	pendingId?: string
}

export interface MentionListItem {
	type: "mention"
	attrs: TiptapMentionAttributes
}

/** Source for mention node removal (keyboard vs other editor actions) */
export type MentionDeletionInput = "forward-delete" | "backspace" | "other"

export interface MentionRemoveItemPayload {
	item: TiptapMentionAttributes
	stillExists: boolean
	deletionInput: MentionDeletionInput
}

// Suggestion props for MentionPanel
export interface MentionPanelSuggestionProps extends SuggestionProps<MentionItem> {
	editor: Editor
	query: string
	range: { from: number; to: number }
	decorationNode: Element | null
	clientRect?: (() => DOMRect | null) | null
}

// MentionPanel Renderer props
export interface MentionPanelRendererProps {
	editor: Editor
	query: string
	items: MentionItem[]
	range: { from: number; to: number }
	decorationNode: Element | null
	language?: Language
	initialLoadOptions?: MentionPanelLoadStateOptions
	initialNavigationStack?: NavigationItem[]
	catalogBehavior?: MentionPanelCatalogBehavior
	viewMode?: MentionPanelViewMode
	galleryOptions?: MentionPanelGalleryOptions
	enableMultiSelect?: boolean
	/** Limits which rows can be staged when the host enables multi-select. */
	canToggleMultiSelectItem?: (item: MentionItem) => boolean
	multiSelectNavigationPolicy?: MentionPanelMultiSelectNavigationPolicy
	selectionScopeId?: string
	selectionSummary?: MentionPanelSelectionSummary
	onSelect: (item: MentionItem, context?: MentionSelectContext) => void
	onExit: () => void
	disableKeyboardShortcuts?: boolean
	dataService: DataService
}

// MentionPanel Renderer ref interface
export interface MentionPanelRendererRef {
	onKeyDown: (props: SuggestionKeyDownProps) => boolean
	panelRef: React.RefObject<HTMLDivElement>
	isVisible: boolean
}

// Plugin configuration options
export interface MentionPanelPluginOptions {
	language?: Language
	searchPlaceholder?: string
	allowSpaces?: boolean
	allowedPrefixes?: string[] | null
	trailingTextAfterInsert?: string
	canSelectItem?: (item: MentionItem) => boolean
	renderText?: (props: {
		options: MentionPanelPluginOptions
		node: Record<string, unknown>
	}) => string
	getParentContainer?: () => HTMLElement | null
	initialLoadOptions?: MentionPanelLoadStateOptions
	initialNavigationStack?: NavigationItem[]
	getInitialLoadOptions?: () => MentionPanelLoadStateOptions | undefined
	getInitialNavigationStack?: () => NavigationItem[] | undefined
	catalogBehavior?: MentionPanelCatalogBehavior
	viewMode?: MentionPanelViewMode
	galleryOptions?: MentionPanelGalleryOptions
	enableMultiSelect?: boolean
	/** Limits which rows can be staged when the host enables multi-select. */
	canToggleMultiSelectItem?: (item: MentionItem) => boolean
	multiSelectNavigationPolicy?: MentionPanelMultiSelectNavigationPolicy
	selectionScopeId?: string
	selectionSummary?: MentionPanelSelectionSummary
	/** Resolve dynamic selection counts when the editor extension remains stable. */
	getSelectionSummary?: () => MentionPanelSelectionSummary | undefined
	onInsert?: (item: MentionItem) => void
	onInsertItems?: (items: MentionItem[]) => void
	onRemove?: (item: TiptapMentionAttributes, stillExists: boolean) => void
	onRemoveItems?: (items: MentionRemoveItemPayload[]) => void
	disableKeyboardShortcuts?: boolean
	isAllowedMention?: (attrs: TiptapMentionAttributes, dataService: DataService) => boolean
	dataService?: DataService
	nodeViewRenderers?: Partial<Record<MentionItemType, MentionNodeViewRenderer>>
	/** 恢复内容期间跳过 doc→mentionItems 同步，避免与 restoreMentionItems 冲突 */
	shouldSkipInsertSync?: () => boolean
	/** Allows trusted programmatic content restoration to keep existing Mention nodes intact. */
	shouldSkipMentionValidation?: () => boolean
	/** Allows trusted restored nodes to survive follow-up ReactNodeView transactions. */
	isTrustedMention?: (attrs: TiptapMentionAttributes) => boolean
	/** 程序化清空期间跳过 mention 删除同步，避免误判为用户删除 */
	shouldSkipRemoveSync?: () => boolean
	/** 删除后需要先恢复的 mention，用于等待外部确认后再真正删除 */
	shouldRestoreRemovedMention?: (
		item: TiptapMentionAttributes,
		stillExists: boolean,
		context?: { deletionInput: MentionDeletionInput },
	) => boolean
}

export interface MentionNodeViewRendererProps extends ReactNodeViewProps {
	attrs: TiptapMentionAttributes
}

export type MentionNodeViewRenderer = ComponentType<MentionNodeViewRendererProps>

// Internal state for managing panel lifecycle
export interface MentionPanelState {
	isVisible: boolean
	currentQuery: string
	panelState: PanelState
	selectedItem: MentionItem | null
}

// Event handler types
export type MentionSelectHandler = (item: MentionItem, context?: MentionSelectContext) => void
export type MentionCloseHandler = () => void
export type MentionKeyDownHandler = (props: SuggestionKeyDownProps) => boolean

// Utility functions for TiptapMentionAttributes

// Get unique identifier for different mention types
export function getMentionUniqueId(attrs: TiptapMentionAttributes | null | undefined): string {
	if (!attrs) return ""

	const data = attrs.data as MentionData

	switch (attrs.type) {
		case MentionItemType.MCP:
			return `mcp:${(data as McpMentionData)?.id || ""}`
		case MentionItemType.AGENT:
			return `agent:${(data as AgentMentionData)?.agent_id || ""}`
		case MentionItemType.MICRO_APP:
			return `micro-app:${(data as MicroAppMentionData)?.app_id || ""}`
		case MentionItemType.SKILL:
			return `skill:${(data as SkillMentionData)?.id || ""}`
		case MentionItemType.PROJECT_FILE:
			return `project:${(data as ProjectFileMentionData)?.file_id || ""}/${
				(data as ProjectFileMentionData)?.file_path || ""
			}`
		case MentionItemType.MEMORY_FILE:
			return `memory-file:${(data as MemoryFileMentionData)?.file_id || ""}/${
				(data as MemoryFileMentionData)?.file_path || ""
			}`
		case MentionItemType.USER_FILE:
			return `user-file:${(data as UserFileMentionData)?.file_id || ""}`
		case MentionItemType.USER_DIRECTORY:
			return `user-directory:${(data as UserDirectoryMentionData)?.directory_id || ""}`
		case MentionItemType.MEMORY_DIRECTORY:
			return `memory-directory:${(data as MemoryDirectoryMentionData)?.directory_id || ""}/${
				(data as MemoryDirectoryMentionData)?.directory_path || ""
			}`
		case MentionItemType.FOLDER:
			return `folder:${(data as DirectoryMentionData)?.directory_path || ""}`
		case MentionItemType.UPLOAD_FILE:
			return `upload:${(data as UploadFileMentionData)?.file_id || ""}`
		case MentionItemType.CLOUD_FILE:
			return `cloud:${
				(data as CloudFileMentionData)?.file_id ||
				(data as CloudFileMentionData)?.file_path ||
				""
			}`
		case MentionItemType.TOOL:
			return `tool:${(data as ToolMentionData)?.id || ""}`
		case MentionItemType.PROJECT:
			return `project:${(data as ProjectMentionData)?.project_id || ""}`
		case MentionItemType.DESIGN_MARKER:
			const canvasMarkData = data as CanvasMarkerMentionData
			const markerData = normalizeCanvasMarkerMentionData(canvasMarkData)
			const markId = markerData?.marker_id || ""
			if (markId) {
				return `marker:${markId}`
			}
			const markNumber = markerData?.mark_number || ""
			const markLabel = markerData?.label || ""
			const result = [markId, markNumber, markLabel].filter(Boolean).join(":")
			return `marker:${result}`
		case MentionItemType.TEXT:
			return `text:${(data as TextMentionData)?.id || ""}`
		default:
			return `unknown:${JSON.stringify(attrs.data)}`
	}
}

function getProjectDisplayName(data: Record<string, unknown>, language?: string) {
	const projectName = (data.project_name as string)?.trim()
	// Keep unnamed project references identifiable instead of silently dropping their project segment.
	return projectName || LANGUAGE_PACKS[normalizeLocale(language || "")].unnamedProject
}

function shouldShowProjectPrefix(data: Record<string, unknown>) {
	// Current-project files also carry project_id; project_name is only attached to cross-project references.
	return Boolean(data.project_id && typeof data.project_name === "string")
}

// Get display name for mention
export function getMentionDisplayName(
	attrs: TiptapMentionAttributes,
	language = i18n.resolvedLanguage || i18n.language,
): string {
	const data = attrs?.data as Record<string, unknown>

	if (!data) return ""

	const t = i18n.t
	const memoryPrefix = i18n.t("super/longMemory:mentionPrefix", {
		defaultValue: "Memory",
	})

	switch (attrs.type) {
		case MentionItemType.MCP:
			return (data?.name as string) || "MCP"
		case MentionItemType.AGENT:
			return (data?.agent_name as string) || "Agent"
		case MentionItemType.MICRO_APP:
			return (data?.app_name as string) || "Micro app"
		case MentionItemType.SKILL:
			return (data?.name as string) || "Skill"
		case MentionItemType.PROJECT_FILE: {
			const fileName = (data?.file_name as string) || "File"
			return shouldShowProjectPrefix(data)
				? `${getProjectDisplayName(data, language)}/${fileName}`
				: fileName
		}
		case MentionItemType.MEMORY_FILE:
			return `${memoryPrefix}:${(data?.file_name as string) || "File"}`
		case MentionItemType.USER_FILE:
			return (data?.file_name as string) || "File"
		case MentionItemType.USER_DIRECTORY:
			return (data?.directory_name as string) || "Folder"
		case MentionItemType.MEMORY_DIRECTORY:
			return `${memoryPrefix}:${(data?.directory_name as string) || "Folder"}`
		case MentionItemType.UPLOAD_FILE:
			return (data?.file_name as string) || "File"
		case MentionItemType.CLOUD_FILE:
			return (data?.file_name as string) || "Cloud File"
		case MentionItemType.FOLDER: {
			const directoryName = (data?.directory_name as string) || "Folder"
			return shouldShowProjectPrefix(data)
				? `${getProjectDisplayName(data, language)}/${directoryName}`
				: directoryName
		}
		case MentionItemType.TOOL:
			return (data?.name as string) || "Tool"
		case MentionItemType.PROJECT:
			return getProjectDisplayName(data, language)
		case MentionItemType.DESIGN_MARKER:
			const markerData = normalizeCanvasMarkerMentionData(data)
			if (markerData?.loading === true) return t ? t("common.loading", "加载中...") : ""
			return markerData?.label || "Marker"
		case MentionItemType.TEXT:
			return (data?.label as string) || "Text"
		default:
			return "Unknown"
	}
}

// Get description for mention
export function getMentionDescription(attrs: TiptapMentionAttributes | null | undefined): string {
	const data = attrs?.data as Record<string, unknown>

	if (!data) return ""

	switch (attrs?.type) {
		case MentionItemType.MCP:
			return (data?.description as string) || ""
		case MentionItemType.AGENT:
			return (data?.agent_description as string) || ""
		case MentionItemType.MICRO_APP:
			return ""
		case MentionItemType.SKILL:
			return (data?.description as string) || ""
		case MentionItemType.PROJECT_FILE:
		case MentionItemType.UPLOAD_FILE:
		case MentionItemType.MEMORY_FILE:
			return (data?.file_path as string) || ""
		case MentionItemType.USER_FILE:
			return (data?.file_path as string) || ""
		case MentionItemType.FOLDER:
		case MentionItemType.USER_DIRECTORY:
		case MentionItemType.MEMORY_DIRECTORY:
			return (data?.directory_path as string) || ""
		case MentionItemType.TOOL:
			return (data?.description as string) || ""
		case MentionItemType.PROJECT:
			return ""
		case MentionItemType.DESIGN_MARKER:
			const markerData = normalizeCanvasMarkerMentionData(data)
			return markerData
				? getSelectedCanvasMarkerMentionSuggestion(markerData)?.label || ""
				: ""
		case MentionItemType.TEXT:
			return (data?.text as string) || ""
		default:
			return ""
	}
}

// Get icon for mention
export function getMentionIcon(attrs: TiptapMentionAttributes | null | undefined): string {
	const data = attrs?.data as MentionData

	if (!data) return ""

	switch (attrs?.type) {
		case MentionItemType.MCP:
			return (data as McpMentionData)?.icon as string
		case MentionItemType.AGENT:
			return (data as AgentMentionData)?.agent_avatar as string
		case MentionItemType.MICRO_APP:
			// Cover URLs are not part of the mention node payload; the renderer provides the fallback icon.
			return ""
		case MentionItemType.SKILL:
			return (data as SkillMentionData)?.icon as string
		case MentionItemType.PROJECT_FILE:
		case MentionItemType.UPLOAD_FILE:
		case MentionItemType.MEMORY_FILE:
		case MentionItemType.USER_FILE:
			return (
				(data as ProjectFileMentionData | UploadFileMentionData | MemoryFileMentionData)
					?.file_extension ||
				(
					data as ProjectFileMentionData | UploadFileMentionData | MemoryFileMentionData
				)?.file_name
					?.split(".")
					.pop() ||
				"ts-attachment"
			)
		case MentionItemType.TOOL:
			return (data as ToolMentionData)?.icon as string
		case MentionItemType.CLOUD_FILE:
			return "ts-cloud-doc"
		case MentionItemType.PROJECT:
		case MentionItemType.FOLDER:
		case MentionItemType.MEMORY_DIRECTORY:
		case MentionItemType.USER_DIRECTORY:
			return "ts-folder"
		default:
			return "ts-attachment"
	}
}

// Command type declarations
declare module "@/infrastructure/editors/tiptap/react" {
	interface Commands<ReturnType> {
		mention: {
			updateMentionLanguage: (language: string) => ReturnType
			updateMentionKeyboardShortcuts: (disabled: boolean) => ReturnType
			updateMentionEnabled: (enabled: boolean) => ReturnType
			openMentionPanel: () => ReturnType
		}
	}
}

// Storage type declarations
declare module "@/infrastructure/editors/tiptap/core" {
	interface Storage {
		mention?: {
			language: Language
			disableKeyboardShortcuts: boolean
			enabled: boolean
			lastAtInputAt: number
			lastAtInputPos: number
		}
	}
}
