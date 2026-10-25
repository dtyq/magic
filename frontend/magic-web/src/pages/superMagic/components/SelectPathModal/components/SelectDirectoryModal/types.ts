import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import type { ProjectResourceSelection } from "../../types"

import { AttachmentItem } from "../../../TopicFilesButton/hooks"

export interface SelectDirectorySubmitParams {
	path: AttachmentItem[]
	targetWorkspaceId?: string
	targetProjectId?: string
	targetAttachments?: AttachmentItem[]
	sourceAttachments?: AttachmentItem[]
	selection?: ProjectResourceSelection
	selections?: ProjectResourceSelection[]
}

export interface MobileCrossProjectConfig {
	currentProject?: Pick<ProjectListItem, "id" | "project_name" | "workspace_id">
	currentWorkspace?: Pick<Workspace, "id" | "name">
	sourceAttachments: AttachmentItem[]
	isChatProject?: boolean
	initialViewMode?: "workspace" | "project" | "directory"
	workspaces?: Array<Pick<Workspace, "id" | "name" | "project_count" | "workspace_type">>
	includeSpecialWorkspaces?: boolean
	allowWorkspaceSubmit?: boolean
	selectionMode?: "destination" | "mention" | "import"
	excludeProjectIds?: string[]
}

/** 按目录读取的来源；根与子节点必须属于同一已授权空间。 */
export interface DirectorySource {
	root: AttachmentItem
	identityKey: string
	loadChildren: (parentId: string, signal: AbortSignal) => Promise<AttachmentItem[]>
}

export interface SelectDirectoryModalProps {
	visible: boolean
	title?: string
	defaultPath?: AttachmentItem[]
	onCreateDirectory?: (params: { id: string; projectId: string; parentId: string }) => void
	onClose?: () => void
	isShowCreateDirectory?: boolean
	onSubmit?: (params: SelectDirectorySubmitParams) => void
	fileType?: string[]
	placeholder?: string
	emptyDataTip?: string
	tips?: string
	projectId?: string
	directorySource?: DirectorySource
	attachments?: AttachmentItem[]
	okText?: string
	cancelText?: string
	// 禁用的文件夹ID列表，这些文件夹将不能被选择为移动目标
	disabledFolderIds?: string[]
	mobileCrossProjectConfig?: MobileCrossProjectConfig
}
