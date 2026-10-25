import type { MagicModalProps } from "@/components/base/MagicModal"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

/** Share type */
export enum ShareType {
	None = 0, // 默认
	Organization = 2, // 团队内分享
	Public = 4, // 公开访问（原互联网可访问）
	PasswordProtected = 5, // 密码保护
}

/** Share mode */
export enum ShareMode {
	Topic = "topic",
	File = "file",
	Project = "project",
}

/**
 * Selects the administrator permission group applied to a share.
 * Topics own a group, so their public access can be closed without affecting projects or files.
 */
export type SharePermissionResource = "microApp" | "project" | "topic"

/** Share context type */
export enum ShareContextType {
	/** Topic */
	Topic = 1,
}

export enum ResourceType {
	/** Topic */
	Topic = 5,
	Project = 12,
	/** File Collection (多文件分享) */
	FileCollection = 13,
	File = 15,
}

/** Share context */
export type ShareContext = TopicShareContext

/** Share context - Topic */
export interface TopicShareContext {
	resource_type: ResourceType.Topic | ResourceType.FileCollection | ResourceType.Project
	resource_id: string
}

/** File info for file sharing */
export interface FileInfo {
	fileId: string
	fileName: string
	fileType?: string
}

/** UI overrides for file-share scenarios such as recording detail sharing. */
export interface FileShareUiConfig {
	/** Full attachment snapshot used only to resolve hidden document dependencies. */
	dependencyAttachments?: AttachmentItem[]
	/** Recording bundle root used to prevent cross-bundle dependency matching. */
	dependencyBundleRootPath?: string
	/** Enables silent multi-document dependency inclusion for specialized shares. */
	analyzeSelectedDocuments?: boolean
	autoIncludeDocumentDependencies?: boolean
	displayNameByFileId?: Record<string, string> // UI-only labels keyed by original file ID
	displayNameByFileName?: Record<string, string> // Fallback labels for refreshed attachment IDs
	/** Reuses the existing project_mode semantic so recording shares do not invent another scene field. */
	projectMode?: string | null
	hideShareProjectToggle?: boolean
	hideShowFileListSetting?: boolean
	forceViewFileList?: boolean
	showSelectAll?: boolean
	lockShareProject?: boolean
	/** Use the recording share sheet title ("Share") instead of generic file-share copy. */
	useRecordingShareCreateTitle?: boolean
	/** Hide generic share-management shortcuts when a scene owns a specialized manager. */
	hideManageShareLinks?: boolean
}

/** Share extra data */
export interface ShareExtraData {
	passwordEnabled?: boolean
	password?: string
	shareUrl?: string
	// File sharing specific fields
	fileId?: string
	fileName?: string
	fileIds?: string[]
	selectedFiles?: any[] // AttachmentItem[]
	// More settings for file sharing
	allowCopy?: boolean
	showFileList?: boolean
	hideCreatorInfo?: boolean
	// More settings for topic sharing
	showOriginalInfo?: boolean
	view_file_list?: boolean // 话题分享：可查看文件列表
	project_id?: string
	allowDownloadProjectFile?: boolean // 允许下载及导出（后端字段: allow_download_project_file）
	pureMode?: boolean // 纯净模式（后端字段: pure_mode）
}

export interface ShareProps {
	shareContext?: ShareContext // Make optional for file sharing mode
	types: ShareType[]
	type: ShareType
	onChangeType?: (type: ShareType) => void
	extraData?: ShareExtraData
	setExtraData?: (data: ShareExtraData) => void
	/** Get share settings validation function */
	getValidateShareSettings?: (validator: () => boolean) => void
	handleOk?: (type: ShareType, data: ShareExtraData) => void
	// File sharing props
	shareMode?: ShareMode
	// Topic sharing props
	topicTitle?: string
}

export interface ShareModalProps extends Omit<ShareProps, "type">, MagicModalProps {
	// File sharing specific props - make shareContext optional for file sharing mode
	shareContext?: ShareContext // 话题分享需要：resource_id（topicId）、resource_type
	// File sharing mode specific props
	shareMode?: ShareMode
	attachments?: any[] // File tree for FileShareModal（可选，如果没有 resourceId 时使用）
	attachmentList?: any[] // 扁平化的文件列表（可选）
	resourceId?: string // 资源ID（可选，外部传入的资源ID）
	defaultSelectedFileIds?: string[] // 默认选中的文件ID列表
	requiredFileIds?: string[] // 提交时始终补齐的文件ID（不改变UI可见选择）
	defaultOpenFileId?: string // 默认打开的文件ID
	displayNameByFileId?: Record<string, string> // UI-only labels keyed by original file ID
	displayNameByFileName?: Record<string, string> // Fallback labels for refreshed attachment IDs
	projectName?: string // 项目名称（用于项目分享模式）
	projectId?: string // 项目ID（用于创建分享时使用，可选，如果不传则从API获取）
	onCancel?: (e?: React.MouseEvent<HTMLButtonElement>) => void
	onCancelShare?: (resourceId: string) => void // 取消分享的回调，用于更新列表
	onSaveSuccess?: () => void // 保存成功的回调
	fileShareUiConfig?: FileShareUiConfig
}

// API types for file sharing
export interface FileShareSettingsRequest {
	topicId: string
	fileIds: string[] // Changed from fileId to support multiple files
	shareType: ShareType
	extraData: ShareExtraData
}

export interface FileShareSettingsResponse {
	success: boolean
	message?: string
}

export interface FileShareAccessRequest {
	topicId: string
	fileIds: string[] // Changed from fileId to support multiple files
	password?: string
}

export interface FileShareAccessResponse {
	success: boolean
	data?: any
	message?: string
}

// VIP feature configuration
export interface VipFeatureConfig {
	isVipFeature: boolean
	featureName?: string
}
