import type { ReactNode } from "react"
import type { AttachmentItem } from "../../hooks/types"
import type { FileHelpContext } from "../../utils/magic-system-folder"
import type { TopicFilesSpaceConfig } from "../../file-space"
import type { ProjectListItem, Topic } from "../../../../pages/Workspace/types"
import type { FileManagerLocationSnapshot } from "@/models/config/repositories/SuperProjectStateTypes"
import type {
	FileItem,
	FileManagerAreaRequest,
	FileManagerStateChangeOptions,
} from "../../../Detail/components/FilesViewer/types"
import type { ProjectFilesStore } from "@/stores/projectFiles"

export type FileManagerView = FileManagerLocationSnapshot["view"]
export type FileManagerSort = FileManagerLocationSnapshot["sort"]
export type FileManagerSortDirection = FileManagerLocationSnapshot["sortDirection"]
export type FileManagerCommand =
	| "open"
	| "rename"
	| "createFolder"
	| "cut"
	| "copy"
	| "paste"
	| "pasteMove"
	| "move"
	| "trash"
	| "download"
	| "upload"

export interface FileManagerTreeRow {
	level: number
	expanded: boolean
	expandable: boolean
}

export interface FileManagerActions {
	execute: (command: FileManagerCommand) => void
	canExecute: (command: FileManagerCommand) => boolean
	getDisabledReason: (command: FileManagerCommand) => string | undefined
	shortcuts: Record<"cut" | "copy" | "paste", string>
}

export interface FileManagerLocationState {
	directoryId: string | null
	selectedIds: Set<string>
	focusedId: string | null
	anchorId: string | null
	scrollTop: number
	scrollLeft: number
	query: string
}

export interface FileManagerPathItem {
	id: string | null
	name: string
}

export interface FileManagerRevealRequest {
	fileId: string
	/** 每次显式定位递增；重复点击同一文件也应重新滚动到该行。 */
	requestId: number
}

interface FileManagerBaseProps {
	onPreviewFile?: (file: FileItem, activate: boolean) => void
	onPreviewRemoved?: (recordIds: string[]) => void
	/** 宿主提供独立回收站 Tab 时，管理器只请求打开，不切换自身内容。 */
	onOpenRecycle?: () => void
	hidePlaces?: boolean
	defaultView?: FileManagerView
	/** 选择模式下显示在文件导航工具栏最左侧的返回入口。 */
	toolbarLeading?: ReactNode
	defaultWritePath?: string
	/** 包含用户、组织与空间；身份变化时由入口以此 key 重新创建管理器。 */
	scopeKey: string
	identityKey: string
	/** 已知范围尚未创建目录时为 null；提交写入后由原目录回调准备真实 ID。 */
	rootId: string | null
	rootName: string
	initialDirectoryId?: string
	initialState?: FileManagerLocationSnapshot
	revealRequest?: FileManagerRevealRequest
	areaRequest?: FileManagerAreaRequest
	onStateChange?: (
		state: FileManagerLocationSnapshot,
		options?: FileManagerStateChangeOptions,
	) => void
	/** 只有所属范围完整加载成功，才能判断保存的目录已失效。 */
	dataReady?: boolean
	attachments: AttachmentItem[]
	context: FileHelpContext
	isActive: boolean
	loading?: boolean
	error?: boolean
	onRefresh: () => void
	onOpen: (file: AttachmentItem) => void
	onDirectoryChange?: (id: string) => void
	placesBefore?: ReactNode
	renderTag?: (file: AttachmentItem) => ReactNode
	projectId?: string
	selectedProject?: ProjectListItem | null
	selectedTopic?: Topic | null
	allowEdit?: boolean
	allowDownload?: boolean
	spaceConfig?: TopicFilesSpaceConfig
	isItemMutable?: (file: AttachmentItem) => boolean
	projectFilesStore?: ProjectFilesStore
}

export interface FileManagerCheckChange {
	added: AttachmentItem[]
	removedIds: string[]
}

export type FileManagerProps = FileManagerBaseProps &
	(
		| { mode?: "manage"; checkedIds?: never; onCheckChange?: never }
		| {
				mode: "destination"
				/** 移动目录时禁止进入自身及后代；复制传空集合。 */
				disabledFolderIds: ReadonlySet<string>
				checkedIds?: never
				onCheckChange?: never
		  }
		| {
				mode: "select"
				/** 调用方持有当前项目的完整勾选集，目录折叠、搜索和导航不能删除它。 */
				checkedIds: ReadonlySet<string>
				onCheckChange: (change: FileManagerCheckChange) => void
		  }
	)

/** 内容布局同时用于虚拟行和框选命中，不能从已挂载的 DOM 推断完整选择范围。 */
export interface FileManagerLayout {
	columns: number
	columnWidth: number
	rowHeight: number
	itemHeight: number
	gap: number
	padding: number
}
