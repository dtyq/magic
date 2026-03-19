import { AttachmentItem } from "../TopicFilesButton/hooks"
import type { ProjectListItem, Workspace } from "../../pages/Workspace/types"

export interface FileItem {
	file_id: string
	task_id: string
	project_id: string
	file_type: "user_upload" | "system" | "generated"
	file_name: string
	file_extension: string
	file_key: string
	file_size: number
	relative_file_path: string
	file_url: string
	is_hidden: boolean
	topic_id: string
	is_directory: boolean
	updated_at: string
	metadata: any
	sort: number
	type: "file" | "directory"
	children: FileItem[]
	name: string
	parent_id?: string
}

export interface BreadcrumbItem {
	name: string
	id: string
	operation?: string
	children?: BreadcrumbItem[]
	isWorkspace?: boolean
	isProject?: boolean
	projectList?: ProjectListItem[]
}

export interface SelectPathModalProps {
	visible: boolean
	title?: string
	// 更改为使用 AttachmentItem
	defaultPath?: AttachmentItem[]
	onCreateDirectory?: (data: { id: string; projectId: string; parentId: string }) => void
	onClose?: () => void
	isShowCreateDirectory?: boolean
	// 更改为使用 AttachmentItem
	onSubmit?: (result: { path: AttachmentItem[] }) => void
	fileType?: string[]
	placeholder?: string
	emptyDataTip?: string
	tips?: string
	projectId: string
	// 新增 attachments 参数，包含完整的文件树结构
	attachments?: AttachmentItem[]
	okText?: string
	cancelText?: string
}

export interface CreateFileRequest {
	project_id: string
	parent_id?: string
	file_name: string
	is_directory: boolean
}

export type ViewMode = "workspace" | "project" | "directory"

export interface CrossProjectFileOperationModalProps {
	visible: boolean
	title: string
	operationType: "move" | "copy"
	selectedWorkspace?: Workspace
	selectedProject?: ProjectListItem
	workspaces: Workspace[]
	fileIds: string[]
	sourceAttachments: AttachmentItem[]
	initialPath?: AttachmentItem[]
	selectProjectOnly?: boolean
	onClose: () => void
	onSubmit: (data: {
		targetProjectId: string
		targetPath: AttachmentItem[]
		targetAttachments: AttachmentItem[]
		sourceAttachments: AttachmentItem[]
	}) => void
}
