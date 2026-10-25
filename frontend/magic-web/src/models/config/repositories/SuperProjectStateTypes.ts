import type { FileReference } from "@/apis/modules/superMagic"

/** 管理器只保存浏览位置和布局；文件内容、目录树及进行中的写操作不进入缓存。 */
export interface FileManagerLocationSnapshot {
	directoryId: string
	ancestorIds: string[]
	view: "grid" | "list"
	sort: "name" | "size" | "type" | "modified" | "created" | "source" | "path"
	sortDirection: "ascending" | "descending"
	area: "files" | "recycle"
	query: string
	selectedIds: string[]
	focusedId: string | null
	anchorId: string | null
	scrollTop: number
	scrollLeft: number
	expandedIds: string[]
	places: FileManagerPlacesSnapshot
	columns: FileManagerColumnsSnapshot
}

export interface FileManagerColumnsSnapshot {
	visibleIds: FileManagerLocationSnapshot["sort"][]
	widths: Partial<Record<FileManagerLocationSnapshot["sort"], number>>
}

export interface FileManagerPlacesSnapshot {
	expandedIds: string[]
	rootExpanded: boolean
	scrollTop: number
}

export interface ProjectFileManagerSnapshot {
	spaceType: "project"
	identityKey: string
	projectId: string
	location?: FileManagerLocationSnapshot
}

export interface UserFileManagerSnapshot {
	spaceType: "user"
	identityKey: string
	view: "files" | "memory"
	filesLocation?: FileManagerLocationSnapshot
	/** 仅保留最后浏览的记忆范围，不按全部项目积累位置。 */
	memory?: {
		projectId: string | null
		query: string
		scrollTop: number
		location?: FileManagerLocationSnapshot
	}
}

export type FileManagerSnapshot = ProjectFileManagerSnapshot | UserFileManagerSnapshot

// 文件Tab信息接口
export interface CachedFileTab {
	id: string
	type?: "file" | "website" | "knowledge_base" | "playback"
	title: string
	fileData: {
		file_id: string
		file_name?: string
		filename?: string
		display_filename?: string
		file_extension?: string
		relative_file_path?: string
		display_config?: any
		updated_at?: string
		file_reference?: FileReference
		space_type?: FileReference["space_type"]
		project_id?: string
		url?: string
		parent_id?: string | number
		is_directory?: boolean
		source?: number
	}
	active: boolean
	filePath?: string
	display_config?: any
}

/** 界面 Tab 没有文件 ID，不能按文件缓存校验或发送给文件接口。 */
export interface CachedFileManagerTab {
	type: "file_manager"
	/** 项目回收站独立保存标签位置，不覆盖文件管理器的浏览快照。 */
	area?: "recycle"
	identityKey?: string
	id: string
	title: string
	active: boolean
	returnTabId?: string
	filePath?: never
}

export type CachedTabItem = CachedFileTab | CachedFileManagerTab

/** 已发布微应用 Tab 不是文件，只需应用 ID、标题和激活状态即可重建。 */
export interface CachedMicroAppTab {
	appId: string
	appName?: string
	active: boolean
	createdAt: number
}

// 文件状态接口
export interface FileState {
	tabs: CachedTabItem[]
	/** 微应用 Tab 独立于文件 Tab 存储；缺省表示没有打开的微应用。 */
	microAppTabs?: CachedMicroAppTab[]
	/** ID 顺序包含个人 Tab 的位置引用，个人打开集合仍由个人仓储持有。 */
	tabOrder?: string[]
	activeTabId?: string
	fileManagerState?: ProjectFileManagerSnapshot
	detailState?: {
		autoDetail?: any
		userDetail?: any
	}
	pptActiveIndexMap?: Record<string, number>
	playbackTabExists?: boolean // 记录playback tab是否存在
	playbackTabActive?: boolean // 记录playback tab是否激活
}

// 树形展开状态接口
export interface TreeState {
	expandedKeys: string[]
}

// 搜索状态接口
export interface SearchState {
	searchValue?: string
	filters?: {
		documents?: boolean
		multimedia?: boolean
		code?: boolean
	}
}

// UI状态接口
export interface UIState {
	sidebarCollapsed?: boolean
	viewMode?: string
	panelSizes?: number[]
}

// 项目状态缓存接口
export interface ProjectState {
	id?: string
	organization_code: string
	project_id: string
	fileState?: FileState
	treeState?: TreeState
	searchState?: SearchState
	uiState?: UIState
	createdAt?: number
	updatedAt?: number
}
