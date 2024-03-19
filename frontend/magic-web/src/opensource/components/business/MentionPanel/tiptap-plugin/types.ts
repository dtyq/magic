import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion"
import type { Editor, ReactNodeViewProps } from "@tiptap/react"
import type { ComponentType } from "react"
import type {
	McpMentionData,
	AgentMentionData,
	SkillMentionData,
	MentionData,
	MentionItem,
	PanelState,
	UploadFileMentionData,
	CloudFileMentionData,
	ToolMentionData,
	DirectoryMentionData,
	CanvasMarkerMentionData,
	TransformedCanvasMarkerMentionData,
	DataService,
} from "../types"
import { MentionItemType, ProjectFileMentionData } from "../types"
import type { Language } from "../i18n/types"
import {
	isCanvasMarkerMentionData,
	isTransformedCanvasMarkerMentionData,
} from "@/opensource/pages/superMagic/components/MessageEditor/components/MentionNodes/marker/useTransformedMarkerData"
import i18n from "i18next"

// Tiptap mention node attributes
export interface TiptapMentionAttributes {
	type: MentionItem["type"]
	data: MentionItem["data"]
}

export interface MentionListItem {
	type: "mention"
	attrs: TiptapMentionAttributes
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
	onSelect: (item: MentionItem) => void
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
	renderText?: (props: {
		options: MentionPanelPluginOptions
		node: Record<string, unknown>
	}) => string
	getParentContainer?: () => HTMLElement | null
	onInsert?: (item: MentionItem) => void
	onInsertItems?: (items: MentionItem[]) => void
	onRemove?: (item: TiptapMentionAttributes, stillExists: boolean) => void
	onRemoveItems?: (items: { item: TiptapMentionAttributes; stillExists: boolean }[]) => void
	disableKeyboardShortcuts?: boolean
	isAllowedMention?: (attrs: TiptapMentionAttributes, dataService: DataService) => boolean
	dataService?: DataService
	nodeViewRenderers?: Partial<Record<MentionItemType, MentionNodeViewRenderer>>
	/** 恢复内容期间跳过 doc→mentionItems 同步，避免与 restoreMentionItems 冲突 */
	shouldSkipInsertSync?: () => boolean
	/** 程序化清空期间跳过 mention 删除同步，避免误判为用户删除 */
	shouldSkipRemoveSync?: () => boolean
	/** 删除后需要先恢复的 mention，用于等待外部确认后再真正删除 */
	shouldRestoreRemovedMention?: (item: TiptapMentionAttributes, stillExists: boolean) => boolean
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
export type MentionSelectHandler = (item: MentionItem) => void
export type MentionCloseHandler = () => void
export type MentionKeyDownHandler = (props: SuggestionKeyDownProps) => boolean

// Utility functions for TiptapMentionAttributes

// Get unique identifier for different mention types
export function getMentionUniqueId(attrs: TiptapMentionAttributes): string {
	const data = attrs.data as MentionData

	switch (attrs.type) {
		case MentionItemType.MCP:
			return `mcp:${(data as McpMentionData)?.id || ""}`
		case MentionItemType.AGENT:
			return `agent:${(data as AgentMentionData)?.agent_id || ""}`
		case MentionItemType.SKILL:
			return `skill:${(data as SkillMentionData)?.id || ""}`
		case MentionItemType.PROJECT_FILE:
			return `project:${(data as ProjectFileMentionData)?.file_id || ""}/${
				(data as ProjectFileMentionData)?.file_path || ""
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
		case MentionItemType.DESIGN_MARKER:
			const canvasMarkData = data as CanvasMarkerMentionData
			const transformedMarkData = data as unknown as TransformedCanvasMarkerMentionData
			const markId = canvasMarkData?.data?.id || ""
			if (markId) {
				return `marker:${markId}`
			}
			// 下面是兼容 TransformedCanvasMarkerMentionData 场景
			const markNumber = canvasMarkData?.mark_number || ""
			const selectedIndex = canvasMarkData?.data?.selectedSuggestionIndex || 0
			const markLabel =
				transformedMarkData.label ||
				canvasMarkData?.data?.result?.suggestions?.[selectedIndex]?.label ||
				""
			const result = [markId, markNumber, markLabel].filter(Boolean).join(":")
			return `marker:${result}`
		default:
			return `unknown:${JSON.stringify(attrs.data)}`
	}
}

// Get display name for mention
export function getMentionDisplayName(attrs: TiptapMentionAttributes): string {
	const data = attrs.data as Record<string, unknown>

	const t = i18n.t

	switch (attrs.type) {
		case MentionItemType.MCP:
			return (data?.name as string) || "MCP"
		case MentionItemType.AGENT:
			return (data?.agent_name as string) || "Agent"
		case MentionItemType.SKILL:
			return (data?.name as string) || "Skill"
		case MentionItemType.PROJECT_FILE:
		case MentionItemType.UPLOAD_FILE:
			return (data?.file_name as string) || "File"
		case MentionItemType.CLOUD_FILE:
			return (data?.file_name as string) || "Cloud File"
		case MentionItemType.FOLDER:
			return (data?.directory_name as string) || "Folder"
		case MentionItemType.TOOL:
			return (data?.name as string) || "Tool"
		case MentionItemType.DESIGN_MARKER:
			const markerData = data as unknown as
				| CanvasMarkerMentionData
				| TransformedCanvasMarkerMentionData
			// 判断数据类型
			if (isTransformedCanvasMarkerMentionData(markerData)) {
				// TransformedCanvasMarkerMentionData 直接使用 label
				return markerData.label || "Marker"
			}
			if (isCanvasMarkerMentionData(markerData)) {
				// CanvasMarkerMentionData 需要从 data.result.suggestions 中获取
				// 如果正在加载，返回加载中提示
				if (markerData.loading === true) {
					return t ? t("common.loading", "加载中...") : ""
				}
				const selectedSuggestionIndex = markerData.data?.selectedSuggestionIndex || 0
				const suggestion = markerData.data?.result?.suggestions?.[selectedSuggestionIndex]
				return suggestion?.label || "Marker"
			}
			return "Marker"
		default:
			return "Unknown"
	}
}

// Get description for mention
export function getMentionDescription(attrs: TiptapMentionAttributes): string {
	const data = attrs.data as Record<string, unknown>

	switch (attrs.type) {
		case MentionItemType.MCP:
			return (data?.description as string) || ""
		case MentionItemType.AGENT:
			return (data?.agent_description as string) || ""
		case MentionItemType.SKILL:
			return (data?.description as string) || ""
		case MentionItemType.PROJECT_FILE:
		case MentionItemType.UPLOAD_FILE:
			return (data?.file_path as string) || ""
		case MentionItemType.FOLDER:
			return (data?.directory_path as string) || ""
		case MentionItemType.TOOL:
			return (data?.description as string) || ""
		case MentionItemType.DESIGN_MARKER:
			const markerData = data as unknown as
				| CanvasMarkerMentionData
				| TransformedCanvasMarkerMentionData
			// 判断数据类型
			if (isTransformedCanvasMarkerMentionData(markerData)) {
				// TransformedCanvasMarkerMentionData 直接使用 label
				return markerData.label || ""
			}
			if (isCanvasMarkerMentionData(markerData)) {
				// CanvasMarkerMentionData 需要从 data.result.suggestions 中获取
				const selectedSuggestionIndex = markerData.data?.selectedSuggestionIndex || 0
				const suggestion = markerData.data?.result?.suggestions?.[selectedSuggestionIndex]
				return suggestion?.label || ""
			}
			return ""
		default:
			return ""
	}
}

// Get icon for mention
export function getMentionIcon(attrs: TiptapMentionAttributes): string {
	const data = attrs.data as MentionData

	switch (attrs.type) {
		case MentionItemType.MCP:
			return (data as McpMentionData)?.icon as string
		case MentionItemType.AGENT:
			return (data as AgentMentionData)?.agent_avatar as string
		case MentionItemType.SKILL:
			return (data as SkillMentionData)?.icon as string
		case MentionItemType.PROJECT_FILE:
		case MentionItemType.UPLOAD_FILE:
			return (
				(data as ProjectFileMentionData | UploadFileMentionData)?.file_extension ||
				(data as ProjectFileMentionData | UploadFileMentionData)?.file_name
					?.split(".")
					.pop() ||
				"ts-attachment"
			)
		case MentionItemType.TOOL:
			return (data as ToolMentionData)?.icon as string
		case MentionItemType.CLOUD_FILE:
			return "ts-cloud-doc"
		case MentionItemType.FOLDER:
			return "ts-folder"
		default:
			return "ts-attachment"
	}
}

// Command type declarations
declare module "@tiptap/react" {
	interface Commands<ReturnType> {
		mention: {
			updateMentionLanguage: (language: string) => ReturnType
			updateMentionKeyboardShortcuts: (disabled: boolean) => ReturnType
			updateMentionEnabled: (enabled: boolean) => ReturnType
		}
	}
}

// Storage type declarations
declare module "@tiptap/core" {
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
