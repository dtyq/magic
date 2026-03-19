import { ShareType, ResourceType } from "../Share/types"

// 分享状态过滤枚举
export enum SharedTopicFilterStatus {
	All = "all", // 全部
	Active = "active", // 分享中 (actively sharing)
	Expired = "expired", // 已失效 (expired/no longer valid)
	Cancelled = "cancelled", // 已取消 (cancelled by user)
}

// 一级资源类型枚举（用于Tab切换）
export enum SharedResourceType {
	Project = "project", // 分享的项目
	File = "file", // 分享的文件
	Topic = "topic", // 分享的话题
}

// 分享列表刷新类型（用于PubSub事件）
export enum ShareListRefreshType {
	Project = "project", // 刷新项目分享列表
	File = "file", // 刷新文件分享列表
	Topic = "topic", // 刷新话题分享列表
}

// API 返回的原始数据结构
export interface ShareResourceApiItem {
	id: number
	resource_id: string
	resource_name: string
	resource_type: number
	created_at: string
	created_uid: string
	share_type: number
	project_id?: string
	project_name?: string
	workspace_id?: string
	workspace_name?: string
	view_count?: number // 用户查看分享次数
	extend: {
		file_count?: number
		copy_count?: number // 复制项目次数
	}
	expire_days?: number // 有效时间（天数）
	expire_at?: string // 过期时间（格式：xxxx/xx/xx）
	has_password?: boolean // 是否开启密码（已废弃，使用is_password_enabled）
	is_password_enabled?: boolean // 是否开启密码
	password?: string // 分享密码
	topic_mode?: string // 话题模式
	shared_at?: string // 分享时间
	share_project?: boolean // 是否分享整个项目（仅文件分享时有效）
	deleted_at?: string // 删除时间（如果存在则表示已删除，不允许操作）
}

// 组件使用的数据结构
export interface TopicShareItem {
	title: string
	topic_id: string
	project_id: string
	project_name: string
	workspace_id: string
	workspace_name: string
	resource_type: ResourceType.Topic
	share_type: ShareType
	resource_id: string
	has_password: boolean // 是否开启密码（兼容字段）
	is_password_enabled?: boolean // 是否开启密码
	password?: string // 分享密码
	shared_at: string // 分享时间
	topic_mode?: string // 话题模式
	created_at: string // 创建时间
	view_count?: number // 用户查看分享次数
	expire_days?: number // 有效时间（天数）
	expire_at?: string // 过期时间（格式：xxxx/xx/xx）
	deleted_at?: string // 删除时间（如果存在则表示已删除，不允许操作）
	share_url?: string // 分享链接
}

export interface FileShareItem {
	title: string
	project_id: string
	project_name: string
	workspace_id: string
	workspace_name: string
	resource_type: ResourceType
	share_type: ShareType
	resource_id: string
	has_password: boolean
	password?: string // 分享密码
	main_file_name?: string
	file_ids?: string[] // 文件ID列表，用于查找 metadata
	extend: {
		file_count?: number
		copy_count?: number // 复制项目次数
	}
	view_count?: number // 用户查看分享次数
	copy_count?: number // 复制项目次数
	expire_days?: number // 有效时间（天数）
	expire_at?: string // 过期时间（格式：xxxx/xx/xx）
	created_at: string // 创建时间
	share_project?: boolean
	deleted_at?: string // 删除时间（如果存在则表示已删除，不允许操作）
}

export interface ProjectShareItem {
	title: string
	project_name: string
	project_id: string
	workspace_id: string
	workspace_name: string
	resource_type: ResourceType.Project
	share_type: ShareType
	resource_id: string
	has_password: boolean
	password?: string // 分享密码
	main_file_name?: string
	view_count?: number // 用户查看分享次数
	copy_count?: number // 复制项目次数
	expire_days?: number // 有效时间（天数）
	expire_at?: string // 过期时间（格式：xxxx/xx/xx）
	created_at: string // 创建时间
	deleted_at?: string // 删除时间（如果存在则表示已删除，不允许操作）
	extend?: {
		file_count?: number
		copy_count?: number // 复制项目次数
	}
}

export interface ShareListParams {
	page: number
	page_size: number
	keyword?: string
	resource_type: ResourceType | ResourceType[]
	project_id?: string
	filter_type?: SharedTopicFilterStatus // 状态过滤
	share_project?: boolean // 是否为项目分享
}

export interface ShareListApiResponse {
	list: ShareResourceApiItem[]
	total: number
}

export interface ShareListResponse {
	list: (TopicShareItem | FileShareItem | ProjectShareItem)[]
	total: number
	page: number
	page_size: number
	has_more: boolean
}

// 工作区项目树结构
export interface WorkspaceProjectTree {
	workspace_id: string
	workspace_name: string
	projects: ProjectInTree[]
}

export interface ProjectInTree {
	project_id: string
	project_name: string
}
