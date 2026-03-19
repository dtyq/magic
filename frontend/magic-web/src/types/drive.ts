import type {
	DepartmentSelectItem,
	UserSelectItem,
} from "@/components/business/OrganizationPanel/originTypes"
import type { Operator } from "./other"

// 所有权限类型
export const enum UserOperationType {
	all = "all",
	edit = "edit",
	read = "read",
	download = "download",
}

/**
 * 空间类型
 */
export const enum DriveSpaceType {
	All = -1,
	Me = 1,
	Shared = 2,
}

/**
 * 文件类型
 */
export const enum DriveItemFileType {
	ALL = -1,
	FOLDER = 0, // 文件夹
	MULTI_TABLE = 1, // 多维表格
	WORD = 2,
	EXCEL = 3,
	MIND_NOTE = 4, // 思维笔记
	PPT = 5,
	PDF = 6,
	CLOUD_DOC = 7, // 云文档旧版
	LINK = 8, // 链接
	KNOWLEDGE_BASE = 9, // 知识库
	IMAGE = 10, // 图片
	VIDEO = 11, // 视频
	AUDIO = 12, // 音频
	COMPRESS = 13,
	UNKNOWN = 14, // 其他文件类型
	MARKDOWN = 15, // markdown文件
	CLOUD_DOCX = 16, // 云文档
	HTML = 17, // html
	TXT = 18, // txt
	XMIND = 19, // xmind
	PAGE = 20, // Keewood 页面
	APPLICATION = 21, // Keewood 应用
	WHITEBOARD = 22, // 白板
	CSV = 23, // CSV
	MAGIC_APPLICATION = 24, // 神奇应用
	MIND_MAP = 25, // 思维导图
	JSON = 27, // JSON
}

interface DriveItemPath {
	id: string
	name: string
	type: "space"
	operation: UserOperationType
	space_type: DriveSpaceType
}

export interface DriveItem {
	is_template: 0
	cover_updated_at: null
	knowledge_base_id: null
	id: string
	file_id: string
	name: string
	file_type: DriveItemFileType
	extension: string
	operation: UserOperationType
	is_favorite: 0 | 1
	is_quick_file: 0 | 1
	is_subscribe: 0 | 1
	path: DriveItemPath[]
	creator: Operator
	created_at: string
	modifier: Operator
	modified_at: string
	recent_opened_at: null
	shared_at: string
	attributes: {
		advanced_permission_status: 0
		inherited_permission_status: 1
		open_share: 0
		share_type: 0
		enable_share_password: 0
		share_password: ""
	}
	space_type: DriveSpaceType
	organization_code: string
}

export interface UploadFileInfo {
	key: string
	name: string
	uid: string
	url: string
	fsize: number
}

export interface DrivePermissionBaseItem {
	id: string
	operation?: UserOperationType
	modify: 0 | 1
}

export const enum DrivePermissionItemType {
	Department = "department",
	User = "user",
}

export interface DrivePermissionDepartmentItem extends DrivePermissionBaseItem {
	type: DrivePermissionItemType.Department
	information: DepartmentSelectItem
}

export interface DrivePermissionUserItem extends DrivePermissionBaseItem {
	type: DrivePermissionItemType.User
	information: UserSelectItem
}

export interface DriveTemplateLibraryCategory {
	id: string
	name: string
}

export interface DriveTemplateLibraryFile {
	id: string
	name: string
	cover: FileIdentify
	used_time: string
	file_type: 16
	shared_at: string
	created_at: string
	shared_user: {
		id: string
		real_name: string
		avatar: string
		description: string
		position: string
		relation_number: string
		departments: []
		email: string
	}
}

export interface FileIdentify {
	uid: string
	name: string
	key: string
}

export interface FileData extends FileIdentify {
	url: string
}

/**
 * 回收站子项
 */
export interface DriveTrashItem {
	id: string
	file_type: DriveItemFileType
	creator: Operator
	name: string
	remain_day: number
	operation: UserOperationType
	parent_status: 1
	parent_name: string
}
