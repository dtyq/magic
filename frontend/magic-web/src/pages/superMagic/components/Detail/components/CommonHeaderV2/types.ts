import type { ReactNode } from "react"
import type {
	DownloadImageMode,
	FileHistoryVersion,
} from "@/pages/superMagic/pages/Workspace/types"
import type {
	AttachmentItem,
	AttachmentSource,
} from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

export type ViewMode = "code" | "desktop" | "phone"

export type ActionKey =
	| "viewMode"
	| "refresh"
	| "download"
	| "copy"
	| "share"
	| "openUrl"
	| "fullscreen"
	| "versionMenu"
	| "more"

export type ActionZone = "leading" | "primary" | "secondary" | "overflow" | "trailing"

export interface CurrentFileInfo {
	id: string
	name: string
	type: string
	url?: string
	source?: AttachmentSource
}

export interface ActionContext {
	type?: string
	viewMode: ViewMode
	isMobile: boolean
	showButtonText: boolean
	isShareRoute: boolean
	isFromNode: boolean
	isFullscreen: boolean
	isEditMode: boolean
	detailMode?: "single" | "files"
	showDownload: boolean
	showRefreshButton: boolean
	isNewestFileVersion: boolean
	allowEdit: boolean
	currentFile?: CurrentFileInfo
	attachments?: AttachmentItem[]
	fileContent?: string
	fileVersion?: number
	fileVersionsList?: FileHistoryVersion[]
	onFullscreen?: () => void
	onDownload?: (mode?: DownloadImageMode) => void
	onOpenUrl?: () => void
	onViewModeChange?: (mode: ViewMode) => void
	onCopy?: (fileVersion?: number) => void
	onRefresh?: () => void
	onLocateFile?: () => void
	onShare?: () => void
	changeFileVersion?: (version: number, isNewestVersion: boolean) => void
	/** 全屏等场景下将 Tooltip/Dropdown 挂载到指定容器内，避免被裁切 */
	getPopupContainer?: () => HTMLElement | null
}

export interface ActionOverride {
	visible?: boolean | ((context: ActionContext) => boolean)
	disabled?: boolean | ((context: ActionContext) => boolean)
	order?: number
	text?: string
	tooltip?: string
	onClick?: (context: ActionContext) => void | Promise<void>
	iconStyle?: React.CSSProperties
	showText?: boolean
}

export interface CustomActionSpec {
	key: string
	zone?: ActionZone
	before?: ActionKey
	after?: ActionKey
	visible?: boolean | ((context: ActionContext) => boolean)
	render: (context: ActionContext) => ReactNode
}

export interface HeaderActionConfig {
	overrides?: Partial<Record<ActionKey, ActionOverride>>
	order?: ActionKey[]
	customActions?: CustomActionSpec[]
	hideDefaults?: ActionKey[]
	gap?: string // 按钮之间的间距，支持 CSS 变量
}

export interface BuiltinActionDefinition {
	key: ActionKey
	zone: ActionZone
	order: number
}

export interface BuiltinComposedAction {
	kind: "builtin"
	key: ActionKey
	zone: ActionZone
	order: number
	disabled?: boolean
	text?: string
	tooltip?: string
	onClick?: (context: ActionContext) => void | Promise<void>
	iconStyle?: React.CSSProperties
	showText?: boolean
}

export interface CustomComposedAction {
	kind: "custom"
	key: string
	zone: ActionZone
	order: number
	render: (context: ActionContext) => ReactNode
}

export type ComposedAction = BuiltinComposedAction | CustomComposedAction

export interface CommonHeaderV2Props {
	renderMode?: "full" | "actions"
	type?: string
	onFullscreen?: () => void
	onDownload?: (mode?: DownloadImageMode) => void
	isFromNode?: boolean
	isFullscreen?: boolean
	viewMode?: ViewMode
	onViewModeChange?: (mode: ViewMode) => void
	onCopy?: (fileVersion?: number) => void
	fileContent?: string
	currentFile?: CurrentFileInfo
	onOpenUrl?: () => void
	detailMode?: "single" | "files"
	showDownload?: boolean
	isEditMode?: boolean
	fileVersion?: number
	isNewestFileVersion?: boolean
	showRefreshButton?: boolean
	changeFileVersion?: (version: number | undefined) => void
	fileVersionsList?: FileHistoryVersion[]
	handleVersionRollback?: (version?: number) => void
	quitEditMode?: () => void
	allowEdit?: boolean
	attachments?: AttachmentItem[]
	actionConfig?: HeaderActionConfig
	/** 全屏等场景下将 Tooltip/Dropdown 挂载到指定容器内，避免被裁切 */
	getPopupContainer?: () => HTMLElement | null
}
