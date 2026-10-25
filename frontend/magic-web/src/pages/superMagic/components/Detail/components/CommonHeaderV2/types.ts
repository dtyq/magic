import type { ReactNode } from "react"
import type { MenuProps } from "antd"
import type {
	DownloadImageMode,
	FileHistoryVersion,
} from "@/pages/superMagic/pages/Workspace/types"
import type {
	AttachmentItem,
	AttachmentSource,
} from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { BeforeAction } from "../../utils/actionGuard"

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
	projectId?: string
	projectName?: string
	relativeFilePath?: string
}

export interface ActionContext {
	/** Optional guard run before toolbar actions. */
	beforeAction?: BeforeAction
	type?: string
	viewMode: ViewMode
	isMobile: boolean
	showButtonText: boolean
	isShareRoute: boolean
	isFromNode: boolean
	isFullscreen: boolean
	isFullscreenMode: boolean
	isEditMode: boolean
	detailMode?: "single" | "files"
	showDownload: boolean
	showRefreshButton: boolean
	isNewestFileVersion: boolean
	allowEdit: boolean
	/** Allows the share action in read-only previews without granting edit permission. */
	shareInReadOnly?: boolean
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
	/** 触发历史版本对比的回调（仅对非最新版本生效） */
	onCompareVersion?: (version: number) => void
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
	/** Optional DOM anchor for a feature tour of the More menu. */
	moreButtonId?: string
	/** Optional guard run before toolbar actions. */
	beforeAction?: BeforeAction
	/** Whether this cached preview should expose test ids. */
	testIdsEnabled?: boolean
	renderMode?: "full" | "actions"
	/** Keeps the standard separator unless an embedded preview already provides its own border. */
	showBottomBorder?: boolean
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
	/** 自定义「定位到文件」行为，未传时使用 currentFile.id */
	onLocateFile?: () => void
	/** 额外的「更多」菜单项，追加在默认菜单项之后 */
	extraMoreMenuItems?: MenuProps["items"]
	/** 触发历史版本对比的回调（选中非最新版本时调用，替代直接切换） */
	onCompareVersion?: (version: number) => void
	/** 「更多」菜单开关状态变化 */
	onMoreMenuOpenChange?: (open: boolean) => void
}
