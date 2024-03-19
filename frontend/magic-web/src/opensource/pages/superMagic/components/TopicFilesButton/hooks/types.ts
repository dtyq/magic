// 附件来源
export enum AttachmentSource {
	DEFAULT = 0,
	// 1 和 2 为用户上传
	HOME = 1,
	PROJECT_DIRECTORY = 2,
	// Agent容器生成
	AGENT = 3,
	COPY = 4,
	/* AI生成文件 */
	AI = 5,
}

// 共享的附件项类型定义
export interface AttachmentItem {
	file_id?: string
	file_name?: string
	filename?: string
	file_extension?: string
	is_directory?: boolean
	name?: string
	path?: string
	parent_id?: string | null
	children?: AttachmentItem[]
	display_filename?: string
	is_hidden?: boolean
	// 拖拽排序相关字段
	sortOrder?: number
	isDragging?: boolean
	canDrop?: boolean
	[key: string]: any
	relative_file_path?: string
	source: AttachmentSource
	task_id?: string
	topic_id?: string
}

// 文件夹项类型
export interface FolderItem {
	name: string
	type: string
	is_directory: true
	children: (AttachmentItem | FolderItem)[]
	path: string
	is_hidden?: boolean
	[key: string]: any
}

// 文件操作回调函数类型
export interface FileOperationCallbacks {
	onOpenFile?: (item: AttachmentItem) => void
	onCreateFile?: (item?: AttachmentItem, fileType?: string) => void
	onCreateFolder?: (item?: AttachmentItem) => void
	onUploadFile?: (item?: AttachmentItem) => void
	onRename?: (itemId: string, newName: string) => Promise<void>
	onShare?: (item: AttachmentItem) => void
	onDelete?: (item: AttachmentItem) => void
	onDownloadOriginal?: (item: AttachmentItem) => void
	onDownloadPdf?: (item: AttachmentItem) => void
}

// 拖拽状态类型
export interface DragState {
	activeId: string | null
	overId: string | null
	draggedItem: AttachmentItem | null
	insertPosition: "before" | "after" | null
}

// 拖拽事件回调类型
export interface DragCallbacks {
	onItemMove: (draggedId: string, targetId: string, position: "before" | "after") => Promise<void>
	onItemSort: (draggedId: string, targetId: string, newIndex: number) => Promise<void>
}

// 拖拽验证结果类型
export interface DropValidationResult {
	canDrop: boolean
	reason?: string
}

// 插入位置信息类型
export interface InsertPosition {
	targetId: string
	position: "before" | "after"
	parentPath?: string
}
